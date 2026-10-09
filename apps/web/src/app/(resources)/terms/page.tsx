import { publicPageMetadata } from '@/config/seo';
import { Terms } from '@/features/resources/terms';
export const metadata = publicPageMetadata({
  path: '/terms',
  title: 'Terms of Service',
  description: 'Guidelines for using QuizMB during free early access.',
});
export default function TermsPage() {
  return <Terms />;
}
