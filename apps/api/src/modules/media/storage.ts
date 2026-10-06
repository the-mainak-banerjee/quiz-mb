import { StorageClient } from '@supabase/storage-js';
import { MEDIA_LIMITS, ERROR_CODE } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
export function createStorage(env: NodeJS.ProcessEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return undefined;
  const url = new URL(env.SUPABASE_URL);
  if (url.protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS');
  const endpoint = `${url.origin}/storage/v1`;
  const headers = {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  };
  return new SupabaseStorage(
    new StorageClient(endpoint, headers),
    env.SUPABASE_STORAGE_BUCKET || 'quizmb-media',
    { endpoint, headers },
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
/** Signed read URLs live this long; a cached one is reused until near expiry. */
const SIGNED_URL_TTL_SECONDS = 3600;
const SIGNED_URL_REUSE_MS = (SIGNED_URL_TTL_SECONDS - 10 * 60) * 1000;
const SIGNED_URL_CACHE_LIMIT = 2000;
/** A passed bucket configuration check is trusted this long. */
const BUCKET_CHECK_REUSE_MS = 10 * 60 * 1000;
/** Bytes read to check an upload's file signature. */
const SIGNATURE_BYTES = 12;

export class SupabaseStorage {
  /**
   * Signed URLs by object path. Every quiz response lists its images, so
   * without this each save would sign every image again (one Storage call
   * each) and the browser would download them again under new URLs.
   */
  private signed = new Map<string, { url: string; reuseUntil: number }>();
  private signing = new Map<string, Promise<string>>();
  /** When the bucket configuration last passed its check. */
  private bucketCheckedAt = 0;
  constructor(
    readonly client: StorageClient,
    readonly bucket: string,
    private api: { endpoint: string; headers: Record<string, string> },
  ) {}
  async authorize(path: string) {
    await this.checkBucket();
    const { data, error } = await this.client
      .from(this.bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error)
      throw new ApiError(
        503,
        ERROR_CODE.STORAGE_UNAVAILABLE,
        'Could not authorize image upload.',
      );
    return { url: data.signedUrl, token: data.token, path: data.path };
  }
  /** Uploads need a private bucket that enforces the image limits. */
  private async checkBucket() {
    if (Date.now() - this.bucketCheckedAt < BUCKET_CHECK_REUSE_MS) return;
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
        ERROR_CODE.STORAGE_UNAVAILABLE,
        'Image storage needs configuration.',
      );
    this.bucketCheckedAt = Date.now();
  }
  /**
   * Reads only the file signature; the stored size and type come from the
   * same response, so the whole image is never downloaded.
   */
  async verify(path: string, size: number, mime: string) {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const response = await fetch(
      `${this.api.endpoint}/object/authenticated/${this.bucket}/${encoded}`,
      {
        headers: {
          ...this.api.headers,
          range: `bytes=0-${SIGNATURE_BYTES - 1}`,
        },
      },
    ).catch(() => undefined);
    if (!response?.ok)
      throw new ApiError(
        422,
        ERROR_CODE.UPLOAD_INCOMPLETE,
        'Upload the image before confirming it.',
      );
    const head = new Uint8Array(await response.arrayBuffer());
    // A ranged answer states the full size ("bytes 0-11/123456"); a file
    // shorter than the range comes back whole.
    const stored =
      response.status === 206
        ? Number(response.headers.get('content-range')?.split('/')[1])
        : head.byteLength;
    if (
      stored !== size ||
      stored > MEDIA_LIMITS.maxBytes ||
      response.headers.get('content-type') !== mime ||
      !isImage(head, mime)
    )
      throw new ApiError(
        422,
        ERROR_CODE.INVALID_MEDIA,
        'The uploaded file does not match the declared image type or size.',
      );
  }
  async read(path: string) {
    const cached = this.signed.get(path);
    if (cached && cached.reuseUntil > Date.now()) return cached.url;
    // Concurrent reads of one path share a single signing request.
    let signing = this.signing.get(path);
    if (!signing) {
      signing = this.sign(path).finally(() => this.signing.delete(path));
      this.signing.set(path, signing);
    }
    return signing;
  }
  private async sign(path: string) {
    const { data, error } = await this.client
      .from(this.bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error)
      throw new ApiError(
        503,
        ERROR_CODE.STORAGE_UNAVAILABLE,
        'Could not load image.',
      );
    if (this.signed.size >= SIGNED_URL_CACHE_LIMIT) this.signed.clear();
    this.signed.set(path, {
      url: data.signedUrl,
      reuseUntil: Date.now() + SIGNED_URL_REUSE_MS,
    });
    return data.signedUrl;
  }
  async remove(path: string) {
    this.signed.delete(path);
    const { error } = await this.client.from(this.bucket).remove([path]);
    if (error)
      throw new ApiError(
        503,
        ERROR_CODE.STORAGE_UNAVAILABLE,
        'Could not remove image.',
      );
  }
}
