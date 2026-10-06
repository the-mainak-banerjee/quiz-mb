import { notFound } from 'next/navigation';
import { MiloGallery } from './milo-gallery';

// Development reference for the mascot, never available in production.
export default function MiloPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return (
    <main className="mx-auto w-full max-w-content px-margin-sm py-space-lg md:px-margin">
      <MiloGallery />
    </main>
  );
}
