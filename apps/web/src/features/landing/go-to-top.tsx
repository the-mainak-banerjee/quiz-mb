'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

export function GoToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 320);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <Button
      variant="ghost"
      aria-label="Back to top"
      className="fixed right-space-md bottom-space-md z-30 size-control rounded-pill bg-surface shadow-floating transition-all duration-300 ease-in-out motion-reduce:transition-none"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transform: visible ? 'translateY(0)' : 'translateY(120%)',
      }}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      icon={<ArrowUp size={18} aria-hidden="true" />}
    >
      <span className="sr-only">Back to top</span>
    </Button>
  );
}
