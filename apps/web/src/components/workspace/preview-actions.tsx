'use client';
import { Button, type ButtonProps } from '@/components/ui';
import { usePreview } from '@/contexts/preview-context';

export function PreviewButton({
  action,
  ...props
}: ButtonProps & { action: string }) {
  const notify = usePreview();
  return <Button {...props} onClick={() => notify(action)} />;
}
