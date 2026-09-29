import { notFound } from 'next/navigation';
import { APP_LINKS } from '@/config/navigation';
import { liveQuiz } from '@/features/live-session/mock-data';
import {
  LIVE_PREVIEW_SCREENS,
  LivePreviewScreen,
} from '@/features/live-session/preview-screens';
import { getAppOrigin } from '@/lib/app-origin';

// Static fixture previews of the Phase 5 live screens; development only.
export default async function LiveScreenPreviewPage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { screen } = await params;
  const preview = LIVE_PREVIEW_SCREENS.find((item) => item.slug === screen);
  if (!preview) notFound();
  const publicUrl = `${await getAppOrigin()}${APP_LINKS.PUBLIC_QUIZ(liveQuiz.publicId)}`;

  return <LivePreviewScreen screen={preview.slug} publicUrl={publicUrl} />;
}
