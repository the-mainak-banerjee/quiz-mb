import { EventEmitter } from 'node:events';
import type { PublicQuizStatus } from '@quizmb/contracts';

export type RegistrationChange = {
  quizId: string;
  userId: string;
  registered: boolean;
};

/**
 * In-process notifications between modules (e.g. registrations → live
 * sessions) so one module never calls another's transport directly.
 * Single-instance only: with several API instances these would need Redis
 * pub/sub alongside the Socket.IO Redis adapter.
 */
export type QuizStatusChange = {
  quizId: string;
  status: PublicQuizStatus;
};

/** A live question closed (timer, recovery or quiz end). */
export type QuestionEnded = { liveSessionId: string; askedQuestionId: string };

/**
 * Sign-in session families were revoked (logout, refresh-token replay):
 * their open sockets are disconnected.
 */
export type AuthSessionsRevoked = { familyIds: string[] };

/** Names of the in-process events carried by `DomainEvents`. */
export const DOMAIN_EVENT = {
  registrationChanged: 'registrationChanged',
  quizStatusChanged: 'quizStatusChanged',
  questionEnded: 'questionEnded',
  authSessionsRevoked: 'authSessionsRevoked',
} as const;

export class DomainEvents extends EventEmitter<{
  [DOMAIN_EVENT.registrationChanged]: [RegistrationChange];
  [DOMAIN_EVENT.quizStatusChanged]: [QuizStatusChange];
  [DOMAIN_EVENT.questionEnded]: [QuestionEnded];
  [DOMAIN_EVENT.authSessionsRevoked]: [AuthSessionsRevoked];
}> {}
