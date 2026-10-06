import { notFound } from 'next/navigation';
import { AUTH_PREVIEW_SCREENS } from '@/features/auth/preview-list';
import { AuthPreviewScreen } from '@/features/auth/preview-screens';

// Fixture previews of the verification and recovery screens; development only.
export default async function AuthScreenPreviewPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { screen } = await params;
  const preview = AUTH_PREVIEW_SCREENS.find((item) => item.slug === screen);
  if (!preview) notFound();
  return <AuthPreviewScreen screen={preview.slug} />;
}
