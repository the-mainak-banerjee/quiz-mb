'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Marks its block `data-inview` the first time it scrolls into view, so CSS
 * (styles/landing.css) can play entrance sequences then. Without
 * JavaScript, or with reduced motion, everything is simply shown.
 */
export function InView({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      data-reveal=""
      {...(seen ? { 'data-inview': '' } : {})}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
