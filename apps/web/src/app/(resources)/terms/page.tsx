import type { Metadata } from 'next';
import { Terms } from '@/features/resources/terms';
export const metadata: Metadata = {
  title: 'Terms of Service · QuizMB',
  description: 'Guidelines for using QuizMB during free early access.',
};
export default function TermsPage() {
  return <Terms />;
}
