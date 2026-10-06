import { MiloLoading } from '@/components/milo/milo-states';

/** Covers the page while a blocking action runs (e.g. publishing). */
export function GlobalLoader({
  label = 'Loading…',
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-canvas/85 p-gutter backdrop-blur-md">
      <MiloLoading label={label} {...(hint ? { hint } : {})} />
    </div>
  );
}
