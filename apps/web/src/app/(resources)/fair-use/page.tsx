import { publicPageMetadata } from '@/config/seo';
import { FairUse } from '@/features/resources/fair-use';
export const metadata = publicPageMetadata({
  path: '/fair-use',
  title: 'Fair Use Policy',
  description: 'Current QuizMB account allowances and fair use rules.',
});
export default function FairUsePage() {
  return <FairUse />;
}
