'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { MediaDto } from '@quizmb/contracts';
import { cn } from '@/lib/utils';

export function QuizCover({
  cover,
  title,
}: {
  cover: MediaDto | null;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!cover) return null;

  return (
    <div className="relative aspect-video overflow-hidden rounded-card border border-border-surface bg-surface-low shadow-card">
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-surface-muted transition-opacity duration-(--motion-duration) motion-safe:animate-pulse motion-reduce:transition-none',
          loaded && 'pointer-events-none opacity-0',
        )}
      />
      <Image
        unoptimized
        fill
        sizes="(min-width: 1024px) 70vw, 100vw"
        src={cover.url}
        alt={`${title} cover artwork`}
        onLoad={() => setLoaded(true)}
        className={cn(
          'object-cover transition-opacity duration-(--motion-duration) motion-reduce:transition-none',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
