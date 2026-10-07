import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@quizmb/database';
import type { Logger } from 'pino';
import {
  ACCOUNT_LIMITS,
  ERROR_CODE,
  MEDIA_STATUS,
  type MediaDto,
  type MediaPurpose,
  type UploadDto,
  type UploadFileInput,
  type UploadInput,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import { lockEditableQuiz, mediaEditScope } from '../quizzes/repository.js';
import { limitsFor } from '../../config/account-limits.js';
import { lockAccount, requireAllowance } from '../usage/allowances.js';
import { DAY_MS } from '../../infrastructure/rolling-window.js';
import type { SupabaseStorage } from './storage.js';
type Asset = Prisma.MediaAssetGetPayload<object>;
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const;

const MB = 1024 * 1024;
/**
 * Platform-wide stored media (pending reservations included) against the
 * storage plan (1 GB): a warning is logged from 600 MB and new uploads are
 * paused from 800 MB.
 */
export const PLATFORM_STORAGE = { warnBytes: 600 * MB, pauseBytes: 800 * MB };
/** Uploads never attached to anything are removed after this long. */
export const PENDING_UPLOAD_TTL_MS = DAY_MS;

/** "1.2 MB", "350 KB". */
const size = (bytes: number) =>
  bytes >= MB
    ? `${(bytes / MB).toFixed(1).replace(/\.0$/, '')} MB`
    : `${Math.ceil(bytes / 1024)} KB`;

/** Stored images that still count: pending reservations and ready files. */
const counted = { status: { not: MEDIA_STATUS.DELETED } } as const;
/** A ready image that no quiz cover or question uses any more. */
const detached = {
  status: MEDIA_STATUS.READY,
  covers: { none: {} },
  images: { none: {} },
} as const;
/**
 * Images go from the browser straight to storage. An upload is recorded as
 * PENDING with a signed upload ticket, and becomes READY only when it is
 * attached to a quiz or question: the stored file is checked first.
 */
export class MediaService {
  constructor(
    private db: PrismaClient,
    private storage: SupabaseStorage | undefined,
    private logger?: Pick<Logger, 'error' | 'warn'>,
  ) {}
  private warnedDay = '';
  get available() {
    return !!this.storage;
  }
  private adapter() {
    if (!this.storage)
      throw new ApiError(
        503,
        ERROR_CODE.STORAGE_UNAVAILABLE,
        'Image storage is not configured yet.',
      );
    return this.storage;
  }
  async dto(asset: Asset | null): Promise<MediaDto | null> {
    if (!asset || asset.status !== MEDIA_STATUS.READY) return null;
    return {
      id: asset.id,
      fileName: asset.fileName,
      url: await this.adapter().read(asset.objectPath),
    };
  }
  /** A PENDING upload row; the caller creates it in its own transaction. */
  pendingAsset(
    userId: string,
    quizId: string,
    purpose: MediaPurpose,
    file: UploadFileInput,
  ) {
    const id = randomUUID();
    return {
      id,
      ownerUserId: userId,
      quizId,
      purpose,
      bucket: this.adapter().bucket,
      objectPath: `${userId}/${quizId}/${id}.${EXTENSIONS[file.mimeType]}`,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
    } satisfies Prisma.MediaAssetUncheckedCreateInput;
  }
  /** The signed URL the browser uploads this asset's file to. */
  async ticket(asset: { id: string; objectPath: string }): Promise<UploadDto> {
    return {
      mediaId: asset.id,
      upload: await this.adapter().authorize(asset.objectPath),
    };
  }
  async request(userId: string, input: UploadInput) {
    const { purpose, resource, ...file } = input;
    const limits = await limitsFor(userId);
    // Ownership and edit locks are checked before storage availability.
    const asset = await this.db.$transaction(async (tx) => {
      // Account before quiz, the order every transaction locks them in
      // (opening a lobby does the same), so the two cannot deadlock.
      await lockAccount(tx, userId);
      await lockEditableQuiz(
        tx,
        resource.quizId,
        userId,
        mediaEditScope(purpose),
      );
      const data = this.pendingAsset(userId, resource.quizId, purpose, file);
      await this.reserve(tx, userId, file.sizeBytes, limits);
      return tx.mediaAsset.create({ data });
    }, lockedTransaction);
    return this.ticket(asset);
  }

  /**
   * Reserves room for one upload before its ticket is issued, under a lock
   * on the account (the pending row created in the same transaction is the
   * reservation): the daily upload allowance, the account's stored-media
   * quota and the platform storage pause. Refusals are clear messages.
   */
  async reserve(
    tx: Prisma.TransactionClient,
    userId: string,
    sizeBytes: number,
    limits: Pick<typeof ACCOUNT_LIMITS, 'mediaBytes' | 'uploadsPerDay'>,
  ) {
    await lockAccount(tx, userId);
    await requireAllowance(
      tx,
      userId,
      'MEDIA_UPLOADED',
      limits.uploadsPerDay,
      (wait) =>
        `You can upload up to ${limits.uploadsPerDay} images a day. You can upload another ${wait}.`,
    );
    const used =
      (
        await tx.mediaAsset.aggregate({
          where: { ownerUserId: userId, ...counted },
          _sum: { sizeBytes: true },
        })
      )._sum.sizeBytes ?? 0;
    if (used + sizeBytes > limits.mediaBytes)
      throw new ApiError(
        409,
        ERROR_CODE.LIMIT_REACHED,
        `Your images use ${size(used)} of ${size(limits.mediaBytes)}. Remove an image from a quiz to upload a new one.`,
      );
    const total =
      (
        await tx.mediaAsset.aggregate({
          where: counted,
          _sum: { sizeBytes: true },
        })
      )._sum.sizeBytes ?? 0;
    if (total + sizeBytes > PLATFORM_STORAGE.pauseBytes) {
      this.logger?.error(
        { totalBytes: total },
        'Platform media storage at 800 MB: new uploads paused',
      );
      throw new ApiError(
        503,
        ERROR_CODE.STORAGE_UNAVAILABLE,
        'Image uploads are paused for now. You can keep editing text; please try adding images later.',
      );
    }
    const day = new Date().toISOString().slice(0, 10);
    if (
      total + sizeBytes >= PLATFORM_STORAGE.warnBytes &&
      this.warnedDay !== day
    ) {
      this.warnedDay = day;
      this.logger?.warn(
        { totalBytes: total },
        'Platform media storage passed 600 MB',
      );
    }
  }

  /**
   * Deletes this quiz's images that a save just detached (replaced or
   * removed), freeing their quota. The file goes first; the row is marked
   * deleted only once it is gone, so quota is never released for a file
   * still in storage. A failure is left for the hourly cleanup.
   */
  async releaseDetached(quizId: string) {
    try {
      await this.release({ quizId, ...detached });
    } catch (error) {
      this.logger?.error({ err: error }, 'Detached images not released yet');
    }
  }

  private async release(where: Prisma.MediaAssetWhereInput) {
    const assets = await this.db.mediaAsset.findMany({
      where,
      select: { id: true, objectPath: true },
    });
    if (!assets.length || !this.storage) return 0;
    await this.storage.remove(...assets.map((asset) => asset.objectPath));
    const { count } = await this.db.mediaAsset.updateMany({
      where: { id: { in: assets.map((asset) => asset.id) }, ...where },
      data: { status: MEDIA_STATUS.DELETED },
    });
    return count;
  }

  /**
   * Hourly: uploads never attached within 24 hours (abandoned forms) and
   * any detached image a save could not release are deleted.
   */
  async cleanUp(now = Date.now()) {
    const abandoned = await this.release({
      status: MEDIA_STATUS.PENDING,
      createdAt: { lt: new Date(now - PENDING_UPLOAD_TTL_MS) },
    });
    const orphaned = await this.release(detached);
    return { abandoned, orphaned };
  }
  /**
   * Before attaching an image: when it is still PENDING, check the stored
   * file matches the declared type and size. Runs outside any transaction
   * (it calls storage); the attach transaction then re-checks the row and
   * marks it READY. Returns whether a PENDING upload was verified.
   */
  async verifyPending(
    id: string | null,
    quizId: string,
    userId: string,
    purpose: MediaPurpose,
  ) {
    if (!id) return false;
    const asset = await this.db.mediaAsset.findFirst({
      where: {
        id,
        quizId,
        ownerUserId: userId,
        purpose,
        status: MEDIA_STATUS.PENDING,
      },
    });
    // READY or unknown images are checked by the attach transaction.
    if (!asset) return false;
    const storage = this.adapter();
    await storage.verify(asset.objectPath, asset.sizeBytes, asset.mimeType);
    // The response shows the image: start signing its read URL now.
    storage.read(asset.objectPath).catch(() => undefined);
    return true;
  }
  /**
   * Removes the stored files of deleted quizzes. Their rows are already gone,
   * so a storage failure only leaves unreachable files: it is logged rather
   * than failing the deletion.
   */
  async removeFiles(paths: string[]) {
    if (!this.storage || !paths.length) return;
    await this.storage.remove(...paths).catch((error: unknown) => {
      this.logger?.error(
        { err: error, files: paths.length },
        'Deleted quiz media could not be removed from storage',
      );
    });
  }
  private async owned(id: string, userId: string) {
    const asset = await this.db.mediaAsset.findFirst({
      where: { id, ownerUserId: userId, status: { not: MEDIA_STATUS.DELETED } },
    });
    if (!asset)
      throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Image not found.');
    return asset;
  }
  async remove(id: string, userId: string) {
    const asset = await this.owned(id, userId);
    await this.db.$transaction(async (tx) => {
      await lockEditableQuiz(
        tx,
        asset.quizId,
        userId,
        mediaEditScope(asset.purpose),
      );
      if (
        (await tx.quiz.count({ where: { coverMediaId: id } })) ||
        (await tx.question.count({ where: { imageMediaId: id } }))
      )
        throw new ApiError(
          409,
          ERROR_CODE.MEDIA_IN_USE,
          'Save removal from the quiz before deleting this image.',
        );
      await this.adapter().remove(asset.objectPath);
      await tx.mediaAsset.update({
        where: { id },
        data: { status: MEDIA_STATUS.DELETED },
      });
    }, lockedTransaction);
  }
}
