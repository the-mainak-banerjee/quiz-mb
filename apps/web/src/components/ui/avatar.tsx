import type { ComponentProps } from 'react';
import { cn, getInitials } from '@/lib/utils';

export type AvatarProps = Omit<ComponentProps<'span'>, 'children'> & {
  name: string;
  size?: 'small' | 'medium' | 'large';
  tone?: 'accent' | 'neutral' | 'muted';
  /** Small presence dot in the corner. */
  status?: 'positive' | 'neutral';
  /** Hide from assistive technology when the name is already shown nearby. */
  decorative?: boolean;
};

const sizes = {
  small: 'size-7 text-caption',
  medium: 'size-8 text-caption',
  large: 'size-10 text-card-title',
};
const tones = {
  accent: 'bg-action-secondary text-accent',
  neutral: 'bg-surface-high text-text-primary',
  muted: 'bg-surface-muted text-text-secondary',
};

/** Initials avatar. The name is announced unless the avatar is decorative. */
export function Avatar({
  name,
  size = 'medium',
  tone = 'accent',
  status,
  decorative = false,
  className,
  ...props
}: AvatarProps) {
  return (
    <span
      {...props}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': name })}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-pill font-semibold',
        sizes[size],
        tones[tone],
        className,
      )}
    >
      <span aria-hidden="true">{getInitials(name)}</span>
      {status && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute right-0 bottom-0 size-2 rounded-pill border-(length:--stroke-width) border-surface',
            status === 'positive' ? 'bg-accent' : 'bg-border-control',
          )}
        />
      )}
    </span>
  );
}
