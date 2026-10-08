import type { Metadata } from 'next';
import { FairUse } from '@/features/resources/fair-use';
export const metadata: Metadata = {
  title: 'Fair Use Policy · QuizMB',
  description: 'Current QuizMB account allowances and fair use rules.',
};
export default function FairUsePage() {
  return <FairUse />;
}
