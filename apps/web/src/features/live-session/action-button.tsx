import { Button, type ButtonProps } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';

/**
 * Live console action: runs `onAction` when wired to the realtime session,
 * otherwise shows the development preview notice for `preview`.
 */
export function ActionButton({
  onAction,
  preview,
  ...props
}: Omit<ButtonProps, 'onClick'> & {
  onAction?: (() => void) | undefined;
  preview: string;
}) {
  return onAction ? (
    <Button {...(props as ButtonProps)} onClick={onAction} />
  ) : (
    <PreviewButton {...(props as ButtonProps)} action={preview} />
  );
}
