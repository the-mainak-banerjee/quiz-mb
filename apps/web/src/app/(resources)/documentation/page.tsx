import type { Metadata } from 'next';
import { Documentation } from '@/features/resources/documentation';
export const metadata: Metadata = {
  title: 'Documentation · QuizMB',
  description: 'Learn to create, host, and participate in QuizMB live quizzes.',
};
export default function DocumentationPage() {
  return <Documentation />;
}
