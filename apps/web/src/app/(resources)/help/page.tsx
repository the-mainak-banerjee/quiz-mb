import { publicPageMetadata } from '@/config/seo';
import { HelpCenter } from '@/features/resources/help-center';
export const metadata = publicPageMetadata({
  path: '/help',
  title: 'Help Center',
  description:
    'Answers to common questions about QuizMB accounts, registration, and hosting.',
});
export default function HelpPage() {
  return <HelpCenter />;
}
