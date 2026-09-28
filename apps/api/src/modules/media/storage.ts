import { StorageClient } from '@supabase/storage-js';
import { MEDIA_LIMITS } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
export function createStorage(env: NodeJS.ProcessEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
  return new SupabaseStorage(
    new StorageClient(`${url.origin}/storage/v1`, {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    }),
    env.SUPABASE_STORAGE_BUCKET || 'quizmb-media',
  );
}
export function isImage(bytes: Uint8Array, mime: string) {
  if (mime === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n);
  if (mime === 'image/jpeg')
    return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return (
    mime === 'image/webp' &&
    Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' &&
    Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP'
  );
}
export class SupabaseStorage {
  constructor(
    readonly client: StorageClient,
    readonly bucket: string,
  ) {}
  async authorize(path: string) {
    const b = await this.client.getBucket(this.bucket);
    if (
      b.error ||
      b.data.public ||
      !b.data.file_size_limit ||
      b.data.file_size_limit > MEDIA_LIMITS.maxBytes ||
      !b.data.allowed_mime_types ||
      b.data.allowed_mime_types.some(
        (t) => !(MEDIA_LIMITS.mimeTypes as readonly string[]).includes(t),
      )
    )
      throw new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        'Image storage needs configuration.',
      );
    const { data, error } = await this.client
      .from(this.bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error)
      throw new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        'Could not authorize image upload.',
      );
    return { url: data.signedUrl, token: data.token, path: data.path };
  }
  async verify(path: string, size: number, mime: string) {
    const { data, error } = await this.client.from(this.bucket).download(path);
    if (error)
      throw new ApiError(
        422,
        'UPLOAD_INCOMPLETE',
        'Upload the image before confirming it.',
      );
    if (
      data.size !== size ||
      data.size > MEDIA_LIMITS.maxBytes ||
      data.type !== mime ||
      !isImage(new Uint8Array(await data.slice(0, 12).arrayBuffer()), mime)
    )
      throw new ApiError(
        422,
        'INVALID_MEDIA',
        'The uploaded file does not match the declared image type or size.',
      );
  }
  async read(path: string) {
    const { data, error } = await this.client
      .from(this.bucket)
      .createSignedUrl(path, 3600);
    if (error)
      throw new ApiError(503, 'STORAGE_UNAVAILABLE', 'Could not load image.');
    return data.signedUrl;
  }
  async remove(path: string) {
    const { error } = await this.client.from(this.bucket).remove([path]);
    if (error)
      throw new ApiError(503, 'STORAGE_UNAVAILABLE', 'Could not remove image.');
  }
}
