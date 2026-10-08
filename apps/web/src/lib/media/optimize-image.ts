import { MEDIA_LIMITS } from '@quizmb/contracts';

/** Quality steps tried in order until the image fits MEDIA_LIMITS.maxBytes. */
const QUALITIES = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.35];

export class ImageOptimizationError extends Error {}

/** Why this file cannot be picked as an image, or null when it can. */
export function selectionProblem(file: File) {
  if (!(MEDIA_LIMITS.mimeTypes as readonly string[]).includes(file.type))
    return 'Choose a PNG, JPEG or WebP image.';
  if (!file.size) return 'This image file is empty.';
  if (file.size > MEDIA_LIMITS.maxSelectedBytes)
    return `Choose an image up to ${MEDIA_LIMITS.maxSelectedBytes / 1024 / 1024} MB.`;
  return null;
}

/** Reads the image's size from its header before it is drawn. */
function dimensions(url: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () =>
      reject(new ImageOptimizationError('This image could not be read.'));
    image.src = url;
  });
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
}

/**
 * Prepares a picked image for upload, in the browser (security design 1.5):
 * scales it to at most MEDIA_LIMITS.maxDimension px on the longest side
 * (never upscaling), re-encodes it as WebP (JPEG where WebP encoding is not
 * supported) and lowers the quality until it is at most MEDIA_LIMITS.maxBytes.
 * Re-encoding drops all metadata (EXIF, GPS); animated images keep their
 * first frame. The original never leaves the browser. Throws
 * ImageOptimizationError with a message for the user when it cannot.
 */
export async function optimizeImage(file: File): Promise<File> {
  const problem = selectionProblem(file);
  if (problem) throw new ImageOptimizationError(problem);
  const url = URL.createObjectURL(file);
  try {
    const { width, height } = await dimensions(url);
    if (!width || !height)
      throw new ImageOptimizationError('This image could not be read.');
    // Checked before decoding into a canvas, so a decompression bomb
    // cannot freeze the page.
    if (width * height > MEDIA_LIMITS.maxSelectedPixels)
      throw new ImageOptimizationError(
        'This image has too many pixels. Choose one under 40 megapixels.',
      );
    const scale = Math.min(
      1,
      MEDIA_LIMITS.maxDimension / Math.max(width, height),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context)
      throw new ImageOptimizationError('This image could not be prepared.');
    const image = new Image();
    image.src = url;
    await image.decode();
    for (const type of ['image/webp', 'image/jpeg'] as const) {
      // JPEG has no transparency: paint it on white instead of black.
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (type === 'image/jpeg') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of QUALITIES) {
        const blob = await encode(canvas, type, quality);
        // A browser that cannot encode this type returns PNG instead.
        if (!blob || blob.type !== type) break;
        if (blob.size <= MEDIA_LIMITS.maxBytes) {
          const name = file.name.replace(/\.[^.]+$/, '') || 'image';
          return new File(
            [blob],
            `${name}.${type === 'image/webp' ? 'webp' : 'jpg'}`,
            {
              type,
            },
          );
        }
      }
    }
    throw new ImageOptimizationError(
      `This image could not be made small enough (${MEDIA_LIMITS.maxBytes / 1024} KB). Try a simpler image.`,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
