import screenshots from './screenshots.json';

export type ScreenshotName = keyof typeof screenshots;

// An inline fallback prevents hidden, desktop-only visuals making requests.
const EMPTY_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';

function srcSet(name: ScreenshotName) {
  return screenshots[name].variants
    .map(({ src, width }) => `${src} ${width}w`)
    .join(', ');
}

/** Pre-optimized screenshots; media sources select one capture without JS. */
export function LandingScreenshot({
  name,
  alt,
  sizes,
  mobile,
  minWidth,
  priority = false,
}: {
  name: ScreenshotName;
  alt: string;
  sizes: string;
  mobile?: { name: ScreenshotName; sizes: string };
  minWidth?: '48rem' | '80rem';
  priority?: boolean;
}) {
  const image = screenshots[name];
  return (
    <picture>
      {mobile && (
        <source
          media="(width < 48rem)"
          srcSet={srcSet(mobile.name)}
          sizes={mobile.sizes}
          width={screenshots[mobile.name].width}
          height={screenshots[mobile.name].height}
        />
      )}
      <source
        media={minWidth ? `(min-width: ${minWidth})` : undefined}
        srcSet={srcSet(name)}
        sizes={sizes}
        width={image.width}
        height={image.height}
      />
      {/* Assets are already resized/compressed; Next Image would re-encode them. */}
      <img
        src={minWidth ? EMPTY_IMAGE : image.variants[0]!.src}
        alt={alt}
        width={image.width}
        height={image.height}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="h-auto w-full"
      />
    </picture>
  );
}
