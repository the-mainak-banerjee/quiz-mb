'use client';

import { useEffect, useState } from 'react';
import { Text } from '@/components/ui';

/** How long a request runs before the note appears. */
const NOTICE_DELAY_MS = 5_000;

/**
 * Under a form's submit button: once a request has taken a while, explains
 * that the server may be waking up (the API sleeps when idle), so people
 * wait instead of retrying. Empty while there is nothing to say.
 */
export function WakingNotice({ active }: { active: boolean }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setSlow(true), NOTICE_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [active]);
  return (
    <Text
      role="status"
      variant="caption"
      tone="secondary"
      className="text-center empty:hidden"
    >
      {slow
        ? 'Waking up the server… this can take up to a minute after a quiet spell.'
        : null}
    </Text>
  );
}
