'use client';

import { useSyncExternalStore } from 'react';

const formats = {
  date: { dateStyle: 'medium' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const subscribe = () => () => {};

/**
 * A timestamp in the viewer's locale and time zone. It is formatted only in
 * the browser (the server's locale and zone may differ), so server-rendered
 * markup never mismatches during hydration.
 */
export function LocalDateTime({
  value,
  format = 'dateTime',
}: {
  value: string;
  format?: keyof typeof formats;
}) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={value}>
      {inBrowser
        ? new Date(value).toLocaleString(undefined, formats[format])
        : ''}
    </time>
  );
}
