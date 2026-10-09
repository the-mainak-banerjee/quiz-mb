import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LandingFinal } from '@/features/landing/final/landing-final';

export const metadata: Metadata = {
  title: 'QuizMB · Live quizzes for cohort courses',
};

// Keep a signed-out landing preview available in development.
export default function LandingPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <LandingFinal />;
}
