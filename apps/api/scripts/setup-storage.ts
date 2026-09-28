import { createStorage } from '../src/modules/media/storage.js';
import { MEDIA_LIMITS } from '@quizmb/contracts';

if (process.env.NODE_ENV === 'production')
  throw new Error('Development setup only');
const storage = createStorage(process.env);
if (!storage)
  throw new Error(
    'Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally',
  );
const existing = await storage.client.listBuckets();
if (existing.error) throw new Error('Unable to inspect Storage buckets');
const bucket = existing.data.find((entry) => entry.id === storage.bucket);
if (!bucket) {
  const result = await storage.client.createBucket(storage.bucket, {
    public: false,
    fileSizeLimit: MEDIA_LIMITS.maxBytes,
    allowedMimeTypes: [...MEDIA_LIMITS.mimeTypes],
  });
  if (result.error)
    throw new Error('Unable to create development media bucket');
} else if (
  bucket.public ||
  Number(bucket.file_size_limit) !== MEDIA_LIMITS.maxBytes ||
  JSON.stringify([...(bucket.allowed_mime_types ?? [])].sort()) !==
    JSON.stringify([...MEDIA_LIMITS.mimeTypes].sort())
) {
  throw new Error('Existing bucket settings differ; no changes made');
}
console.log('Private media bucket verified: PNG/JPEG/WebP, 10 MiB maximum.');
