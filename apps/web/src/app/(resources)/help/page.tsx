import type { Metadata } from 'next';
import { HelpCenter } from '@/features/resources/help-center';
export const metadata: Metadata = {
  title: 'Help Center · QuizMB',
  description:
    'Answers to common questions about QuizMB accounts, registration, and hosting.',
};
export default function HelpPage() {
  return <HelpCenter />;
}
