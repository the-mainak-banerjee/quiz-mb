import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@quizmb/database';
import type { Logger } from 'pino';
import {
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
import type { SupabaseStorage } from './storage.js';
type Asset = Prisma.MediaAssetGetPayload<object>;
const EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
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
    private logger?: Pick<Logger, 'error'>,
  ) {}
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
    // Ownership and edit locks are checked before storage availability.
    const asset = await this.db.$transaction(async (tx) => {
      await lockEditableQuiz(
        tx,
        resource.quizId,
        userId,
        mediaEditScope(purpose),
      );
      return tx.mediaAsset.create({
        data: this.pendingAsset(userId, resource.quizId, purpose, file),
      });
    }, lockedTransaction);
    return this.ticket(asset);
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
