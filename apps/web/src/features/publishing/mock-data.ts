import type { Quiz } from '@/features/dashboard/types';

// Development preview fixtures only; never used by product routes.
export const upcomingParticipantQuizzes: Quiz[] = [
  {
    id: 'token-sync-2026',
    project: 'Product Design Community',
    role: 'participant',
    status: 'scheduled',
    statusLabel: 'Registered',
    title: 'Design Systems & Token Architecture Sync',
    description: 'Hosted by Elena Rostova · Room opens when the host starts.',
    timing: 'Saturday, Oct 24 · 7:00 PM EST',
    detail: '42 registered',
    action: 'View Details',
  },
  {
    id: 'accessibility-drill',
    project: 'Product Design Community',
    role: 'participant',
    status: 'scheduled',
    statusLabel: 'Registered',
    title: 'WCAG 2.2 Accessibility Drill & Color Contrast',
    description: 'Hosted by Aidan Chen · 30 timed inquiries.',
    timing: 'Thursday, Oct 29 · 6:30 PM EST',
    detail: '28 registered',
    action: 'View Details',
  },
  {
    id: 'frontend-architecture',
    project: 'Frontend Onboarding & Standards',
    role: 'participant',
    status: 'scheduled',
    statusLabel: 'Registered',
    title: 'Frontend Architecture & SSR Mental Models',
    description: 'Hosted by Marcus Webb · Readiness syllabus shared.',
    timing: 'Tuesday, Nov 3 · 5:00 PM EST',
    detail: '56 registered',
    action: 'View Details',
  },
];
