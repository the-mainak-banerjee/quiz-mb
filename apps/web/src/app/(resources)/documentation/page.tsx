import { publicPageMetadata } from '@/config/seo';
import { Documentation } from '@/features/resources/documentation';
export const metadata = publicPageMetadata({
  path: '/documentation',
  title: 'Documentation',
  description: 'Learn to create, host, and participate in QuizMB live quizzes.',
});
export default function DocumentationPage() {
  return <Documentation />;
}
