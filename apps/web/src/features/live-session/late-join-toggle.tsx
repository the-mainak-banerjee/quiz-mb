'use client';

import { useId, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { Switch, Text } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Host control for the PRD "Allow New Participants" setting. Controlled by
 * the live session when `onAllowedChange` is given; local-only in previews.
 */
export function LateJoinToggle({
  initialAllowed,
  description,
  layout,
  onAllowedChange,
  disabled = false,
}: {
  initialAllowed: boolean;
  description: string;
  /** banner: full-width lobby strip; panel: compact row inside a card. */
  layout: 'banner' | 'panel';
  onAllowedChange?: ((allowed: boolean) => void) | undefined;
  disabled?: boolean;
}) {
  const [localAllowed, setLocalAllowed] = useState(initialAllowed);
  const allowed = onAllowedChange ? initialAllowed : localAllowed;
  const setAllowed = onAllowedChange ?? setLocalAllowed;
  const labelId = useId();
  const descriptionId = useId();
  const banner = layout === 'banner';

  return (
    <div
      className={cn(
        'flex justify-between gap-space-sm',
        banner
          ? 'flex-col md:flex-row md:items-center'
          : 'items-center rounded-control bg-surface-low p-space-sm',
      )}
    >
      <div className="flex min-w-0 items-start gap-space-sm md:items-center">
        {banner && (
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-high text-text-primary"
          >
            <DoorOpen size={20} />
          </span>
        )}
        <div className="min-w-0">
          <Text id={labelId} variant={banner ? 'card-title' : 'label'}>
            Allow new participants
          </Text>
          <Text
            id={descriptionId}
            variant={banner ? 'body-secondary' : 'caption'}
            tone="secondary"
          >
            {description}
          </Text>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-space-xs self-end md:self-auto">
        {banner && (
          <Text as="span" variant="caption" tone="secondary" aria-hidden="true">
            {allowed ? 'Enabled' : 'Disabled'}
          </Text>
        )}
        <Switch
          checked={allowed}
          disabled={disabled}
          onCheckedChange={setAllowed}
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
        />
      </div>
    </div>
  );
}
