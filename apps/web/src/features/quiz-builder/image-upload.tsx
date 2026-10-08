'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  MEDIA_LIMITS,
  MEDIA_PURPOSE,
  type MediaDto,
  type MediaPurpose,
} from '@quizmb/contracts';
import { Button, Input, Text } from '@/components/ui';
import { uploadImage } from '@/lib/api/authoring';
import { apiError } from '@/lib/api/client';
import {
  ImageOptimizationError,
  optimizeImage,
} from '@/lib/media/optimize-image';

/** The picked image, resized and compressed; or a message for the user. */
async function prepare(file: File) {
  try {
    return { file: await optimizeImage(file) };
  } catch (error) {
    return {
      error:
        error instanceof ImageOptimizationError
          ? error.message
          : 'This image could not be prepared. Try another image.',
    };
  }
}
export function ImageUpload({
  quizId,
  purpose,
  value,
  onChange,
  onBusy,
  readOnly = false,
  onDefer,
}: {
  quizId?: string | undefined;
  purpose: MediaPurpose;
  value: MediaDto | null;
  onChange: (media: MediaDto | null) => void;
  onBusy: (busy: boolean) => void;
  /** Show the saved image only, with no upload or remove controls. */
  readOnly?: boolean;
  /**
   * Before the quiz exists there is nowhere to upload: keep the chosen file
   * (null when removed) so the form uploads it right after the first save.
   */
  onDefer?: (file: File | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  /** Resizing and compressing the picked image before it is kept or sent. */
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const deferring = !quizId && !!onDefer;
  const [deferred, setDeferred] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Revoke the local preview URL when it is replaced or the field unmounts.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  async function keep(picked: File | null) {
    setError('');
    let file: File | null = null;
    if (picked) {
      setOptimizing(true);
      onBusy(true);
      const prepared = await prepare(picked);
      setOptimizing(false);
      onBusy(false);
      if ('error' in prepared) {
        setError(prepared.error ?? '');
        return;
      }
      file = prepared.file;
    }
    setDeferred(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    onDefer?.(file);
  }
  async function upload(picked: File | undefined) {
    if (!picked || !quizId) return;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      setOptimizing(true);
      const prepared = await prepare(picked);
      setOptimizing(false);
      if ('error' in prepared) {
        setError(prepared.error ?? '');
        return;
      }
      const file = prepared.file;
      const media = await uploadImage(quizId, purpose, file);
      // Its URL is a local preview of the file; release it when replaced.
      setPreview(media.url);
      onChange(media);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
      setOptimizing(false);
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <div className="space-y-space-sm">
      <Text variant="label">
        {purpose === MEDIA_PURPOSE.QUIZ_COVER
          ? 'Cover artwork'
          : 'Question image'}{' '}
        (optional)
      </Text>
      <div
        className="space-y-space-sm rounded-control border border-dashed border-border-control bg-surface-low p-space-md"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (busy || optimizing) return;
          if (deferring) void keep(e.dataTransfer.files[0] ?? null);
          else void upload(e.dataTransfer.files[0]);
        }}
      >
        {value && (
          <>
            <div className="overflow-hidden rounded-control">
              {/* Signed private image URL; no public optimization proxy. */}
              <Image
                unoptimized
                width={800}
                height={450}
                src={value.url}
                alt={value.fileName}
                className="max-h-64 w-full object-contain"
              />
            </div>
            <Text variant="caption" className="break-all">
              {value.fileName}
            </Text>
          </>
        )}
        {deferring && deferred && preview && (
          <>
            <div className="overflow-hidden rounded-control">
              {/* A local preview (blob URL) of the file chosen before saving. */}
              <Image
                unoptimized
                width={800}
                height={450}
                src={preview}
                alt={deferred.name}
                className="max-h-64 w-full object-contain"
              />
            </div>
            <Text variant="caption" className="break-all">
              {deferred.name} · uploads when you save the quiz
            </Text>
            <Button variant="ghost" onClick={() => void keep(null)}>
              Remove image
            </Button>
          </>
        )}
        {readOnly && !value && (
          <Text variant="body-secondary" tone="secondary">
            No image added.
          </Text>
        )}
        {value && !readOnly && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onChange(null)}
          >
            Remove image
          </Button>
        )}
        {!readOnly && (
          <>
            <label
              className="flex items-center gap-space-xs text-label"
              htmlFor={`upload-${purpose}`}
            >
              <Upload size={18} />
              {optimizing
                ? 'Optimizing image…'
                : busy
                  ? 'Uploading…'
                  : 'Drop an image here or browse files'}
            </label>
            <Input
              id={`upload-${purpose}`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={(!quizId && !deferring) || busy || optimizing}
              className="h-auto py-space-xs"
              onChange={(e) => {
                if (deferring) void keep(e.target.files?.[0] ?? null);
                else void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Text variant="caption" tone="secondary">
              PNG, JPEG or WebP · Resized to {MEDIA_LIMITS.maxDimension} px and{' '}
              {MEDIA_LIMITS.maxBytes / 1024} KB or less automatically
              {!quizId && !deferring
                ? ' · Save the quiz basics once to enable uploads.'
                : ''}
            </Text>
          </>
        )}
      </div>
      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
    </div>
  );
}
