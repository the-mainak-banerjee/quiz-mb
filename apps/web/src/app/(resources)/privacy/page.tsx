import type { Metadata } from 'next';
import { Privacy } from '@/features/resources/privacy';
export const metadata: Metadata = {
  title: 'Privacy Policy · QuizMB',
  description:
    'How QuizMB uses account information, quiz content, and participation data.',
};
export default function PrivacyPage() {
  return <Privacy />;
}
