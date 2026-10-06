'use client';

import { useSyncExternalStore } from 'react';

const formats = {
  date: { dateStyle: 'medium' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
  fullDateTime: { dateStyle: 'full', timeStyle: 'short' },
  /** e.g. Saturday, Oct 24, 2026 */
  longDate: {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
  /** e.g. 7:00 PM GMT+5:30 */
  time: { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' },
  month: { month: 'short' },
  day: { day: 'numeric' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type LocalDateTimeFormat = keyof typeof formats;

/** Formats in the current locale and time zone; call only in the browser. */
export function formatLocalDateTime(
  value: string,
  format: LocalDateTimeFormat = 'dateTime',
) {
  return new Date(value).toLocaleString(undefined, formats[format]);
}

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
  format?: LocalDateTimeFormat;
}) {
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <time dateTime={value}>
      {inBrowser ? formatLocalDateTime(value, format) : ''}
    </time>
  );
}
