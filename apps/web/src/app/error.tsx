'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p>Please try again.</p>

      {isDevelopment && (
        <pre className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {error.message}
        </pre>
      )}

      {error.digest ? (
        <p className="text-sm text-slate-500">Error ID: {error.digest}</p>
      ) : null}

      <button
        onClick={reset}
        className="rounded-lg bg-teal-800 px-4 py-2 text-white"
      >
        Try again
      </button>
    </section>
  );
}
