import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const variants = {
  display: 'text-display-mobile md:text-display',
  'page-title': 'text-page-title-mobile md:text-page-title',
  'section-heading': 'text-section-heading',
  'card-title': 'text-card-title',
  body: 'text-body',
  'body-secondary': 'text-body-secondary',
  label: 'text-label',
  caption: 'text-caption',
};
export type TextProps = HTMLAttributes<HTMLElement> & {
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  variant?: keyof typeof variants;
  tone?: 'primary' | 'secondary' | 'inverse';
};

const tones = {
  primary: 'text-text-primary',
  secondary: 'text-text-secondary',
  inverse: 'text-text-inverse',
};

export function Text({
  as: Tag = 'p',
  variant = 'body',
  tone = 'primary',
  className,
  ...props
}: TextProps) {
  return (
    <Tag {...props} className={cn(variants[variant], tones[tone], className)} />
  );
}
