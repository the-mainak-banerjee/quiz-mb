'use client';

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p>Please try again.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-teal-800 px-4 py-2 text-white"
      >
        Try again
      </button>
    </section>
  );
}
