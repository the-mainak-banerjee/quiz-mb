import type { PrismaClient } from '@quizmb/database';
import {
  ERROR_CODE,
  MEDIA_STATUS,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
} from '@quizmb/contracts';
import { publicUser } from '../auth/service.js';
import { ApiError } from '../../http/api-error.js';
import { lockAccount } from '../usage/allowances.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import {
  DOMAIN_EVENT,
  type DomainEvents,
} from '../../infrastructure/domain-events.js';
import type { MediaService } from '../media/service.js';

/** Quizzes that other people can still register for, join or play. */
const UNFINISHED = [
  QUIZ_STATUS.PUBLISHED,
  QUIZ_STATUS.LOBBY,
  QUIZ_STATUS.LIVE,
] as const;

export class UsersService {
  constructor(
    private db: PrismaClient,
    private media?: Pick<MediaService, 'removeFiles'>,
    private events?: DomainEvents,
  ) {}
  async updateName(id: string, name: string) {
    const user = await this.db.user.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, email: true },
    });
    return { ...publicUser(user), avatarUrl: null };
  }

  /**
   * Deletes an account and everything it owns: projects, quizzes (with
   * their questions, images, live sessions and the results in them), its
   * registrations, answers and results in other hosts' quizzes, sign-ins,
   * and email and usage records. Refused while the user hosts a quiz that is
   * published, in its lobby or live, or is registered for one that has not
   * finished: other people still depend on it. The password is checked by
   * the caller first. Every sign-in's live sockets are closed afterwards.
   */
  async deleteAccount(userId: string) {
    const { familyIds, files } = await this.db.$transaction(async (tx) => {
      // Serializes with the account's own limits and allowances.
      await lockAccount(tx, userId);
      const hosting = await tx.quiz.count({
        where: { creatorUserId: userId, status: { in: [...UNFINISHED] } },
      });
      const registered = await tx.quizRegistration.count({
        where: {
          userId,
          status: REGISTRATION_STATUS.REGISTERED,
          quiz: { status: { in: [...UNFINISHED] } },
        },
      });
      if (hosting || registered)
        throw new ApiError(
          409,
          ERROR_CODE.CONFLICT,
          hosting
            ? 'You host a quiz that is published or live. Finish it, or delete it while it is a draft, before deleting your account.'
            : 'You are registered for a quiz that has not finished. Unregister or wait for it to end before deleting your account.',
        );
      const families = await tx.authSession.findMany({
        where: { userId, revokedAt: null },
        select: { familyId: true },
        distinct: ['familyId'],
      });
      const assets = await tx.mediaAsset.findMany({
        where: { ownerUserId: userId, status: { not: MEDIA_STATUS.DELETED } },
        select: { objectPath: true },
      });
      // Quizzes, projects and images restrict deleting their owner, so they
      // go first (deleting a quiz removes its live sessions, results and
      // uploads); the rest is removed with the user row.
      await tx.quiz.deleteMany({ where: { creatorUserId: userId } });
      await tx.project.deleteMany({ where: { ownerUserId: userId } });
      await tx.mediaAsset.deleteMany({ where: { ownerUserId: userId } });
      await tx.liveQuizSession.deleteMany({ where: { hostUserId: userId } });
      await tx.user.delete({ where: { id: userId } });
      return {
        familyIds: families.map((session) => session.familyId),
        files: assets.map((asset) => asset.objectPath),
      };
    }, lockedTransaction);
    if (familyIds.length)
      this.events?.emit(DOMAIN_EVENT.authSessionsRevoked, { familyIds });
    // After the commit: a storage failure only leaves unreachable files.
    await this.media?.removeFiles(files);
  }
}
