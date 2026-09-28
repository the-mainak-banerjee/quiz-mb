import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma } from '@quizmb/database';
import type { UploadInput, MediaDto } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import { lockEditableQuiz } from '../quizzes/repository.js';
import type { SupabaseStorage } from './storage.js';
type Asset = Prisma.MediaAssetGetPayload<object>;
export class MediaService {
  constructor(
    private db: PrismaClient,
    private storage: SupabaseStorage | undefined,
  ) {}
  private adapter() {
    if (!this.storage)
      throw new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        'Image storage is not configured yet.',
      );
    return this.storage;
  }
  async dto(asset: Asset | null): Promise<MediaDto | null> {
    if (!asset || asset.status !== 'READY') return null;
    return {
      id: asset.id,
      fileName: asset.fileName,
      url: await this.adapter().read(asset.objectPath),
    };
  }
  async request(userId: string, input: UploadInput) {
    const storage = this.adapter();
    const id = randomUUID();
    const extension = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
    }[input.mimeType];
    const path = `${userId}/${input.resource.quizId}/${id}.${extension}`;
    await this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, input.resource.quizId, userId);
      await tx.mediaAsset.create({
        data: {
          id,
          ownerUserId: userId,
          quizId: input.resource.quizId,
          purpose: input.purpose,
          bucket: storage.bucket,
          objectPath: path,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
        },
      });
    });
    return { mediaId: id, upload: await storage.authorize(path) };
  }
  private async owned(id: string, userId: string) {
    const asset = await this.db.mediaAsset.findFirst({
      where: { id, ownerUserId: userId, status: { not: 'DELETED' } },
    });
    if (!asset) throw new ApiError(404, 'NOT_FOUND', 'Image not found.');
    return asset;
  }
  async complete(id: string, userId: string) {
    const asset = await this.owned(id, userId);
    await this.adapter().verify(
      asset.objectPath,
      asset.sizeBytes,
      asset.mimeType,
    );
    const ready = await this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, asset.quizId, userId);
      const current = await tx.mediaAsset.findUniqueOrThrow({ where: { id } });
      if (current.status === 'DELETED')
        throw new ApiError(409, 'INVALID_MEDIA', 'Image was removed.');
      return tx.mediaAsset.update({
        where: { id },
        data: { status: 'READY', readyAt: new Date() },
      });
    });
    return this.dto(ready);
  }
  async remove(id: string, userId: string) {
    const asset = await this.owned(id, userId);
    await this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, asset.quizId, userId);
      if (
        (await tx.quiz.count({ where: { coverMediaId: id } })) ||
        (await tx.question.count({ where: { imageMediaId: id } }))
      )
        throw new ApiError(
          409,
          'MEDIA_IN_USE',
          'Save removal from the quiz before deleting this image.',
        );
      await this.adapter().remove(asset.objectPath);
      await tx.mediaAsset.update({
        where: { id },
        data: { status: 'DELETED' },
      });
    });
  }
}
