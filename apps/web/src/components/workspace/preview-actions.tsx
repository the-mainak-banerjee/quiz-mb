'use client';
import { Button, type ButtonProps } from '@/components/ui';
import { usePreview } from '@/contexts/preview-context';
import { useRouter } from 'next/navigation';

export function PreviewButton({
  action,
  href,
  ...props
}: ButtonProps & { action: string; href?: string }) {
  const notify = usePreview();
  const router = useRouter();
  return (
    <Button
      {...props}
      onClick={() => {
        if (href) router.push(href);
        else if (action === 'Create quiz') router.push('/quizzes/new');
        else if (action === 'New project') router.push('/projects/new');
        else notify(action);
      }}
    />
  );
}
