'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import {
  MEDIA_PURPOSE,
  type MediaDto,
  type MediaPurpose,
} from '@quizmb/contracts';
import { Button, Input, Text } from '@/components/ui';
import { imageProblem, uploadImage } from '@/lib/api/authoring';
import { apiError } from '@/lib/api/client';
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
  function keep(file: File | null) {
    setError('');
    if (file) {
      const problem = imageProblem(file);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setDeferred(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    onDefer?.(file);
  }
  async function upload(file: File | undefined) {
    if (!file || !quizId) return;
    setBusy(true);
    onBusy(true);
    setError('');
    try {
      const media = await uploadImage(quizId, purpose, file);
      // Its URL is a local preview of the file; release it when replaced.
      setPreview(media.url);
      onChange(media);
    } catch (e) {
      setError(apiError(e).message);
    } finally {
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
          if (busy) return;
          if (deferring) keep(e.dataTransfer.files[0] ?? null);
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
            <Button variant="ghost" onClick={() => keep(null)}>
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
              {busy ? 'Uploading…' : 'Drop an image here or browse files'}
            </label>
            <Input
              id={`upload-${purpose}`}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={(!quizId && !deferring) || busy}
              className="h-auto py-space-xs"
              onChange={(e) => {
                if (deferring) keep(e.target.files?.[0] ?? null);
                else void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Text variant="caption" tone="secondary">
              PNG, JPEG or WebP · Up to 10 MB
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
