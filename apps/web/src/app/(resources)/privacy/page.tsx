import { publicPageMetadata } from '@/config/seo';
import { Privacy } from '@/features/resources/privacy';
export const metadata = publicPageMetadata({
  path: '/privacy',
  title: 'Privacy Policy',
  description:
    'How QuizMB uses account information, quiz content, and participation data.',
});
export default function PrivacyPage() {
  return <Privacy />;
}
