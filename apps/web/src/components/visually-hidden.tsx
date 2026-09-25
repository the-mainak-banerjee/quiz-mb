import { cn } from '@/lib/utils';

export function VisuallyHidden({
  as: Component = 'span',
  children,
  className,
  ...props
}: {
  as?: React.ElementType;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Component className={cn('sr-only', className)} {...props}>
      {children}
    </Component>
  );
}
