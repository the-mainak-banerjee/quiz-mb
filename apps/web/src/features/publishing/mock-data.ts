import type { Quiz } from '@/features/dashboard/mock-data';
import type { MediaDto } from '@quizmb/contracts';

export type PublicQuizState =
  'logged-out' | 'open' | 'registered' | 'full' | 'closed';

export type PublishedQuizViewModel = {
  id: string;
  slug: string;
  title: string;
  description: string;
  project: string;
  host: string;
  hostRole: string;
  plannedStartAt: string;
  date: string;
  dateTileMonth: string;
  dateTileDay: string;
  time: string;
  cover: MediaDto | null;
  registrationLimit: number;
  registeredCount: number;
  publicUrl: string;
  outline: readonly string[];
};

export const publishedQuiz: PublishedQuizViewModel = {
  id: 'token-sync-2026',
  slug: 'token-sync-2026',
  title: 'Design Systems & Token Architecture Sync',
  description:
    'A masterclass interactive session unpacking unified token taxonomies, cross-platform aliases, and multi-brand theming workflows with real-time exercises.',
  project: 'Product Design Community',
  host: 'Elena Rostova',
  hostRole: 'Lead Design Architect',
  plannedStartAt: '2026-10-24T19:00:00-04:00',
  date: 'Saturday, Oct 24, 2026',
  dateTileMonth: 'OCT',
  dateTileDay: '24',
  time: '7:00 PM EST',
  cover: null,
  registrationLimit: 100,
  registeredCount: 42,
  publicUrl: 'https://quizmb.com/quiz/token-sync-2026',
  outline: [
    'Design Token Taxonomies',
    'Cross-Platform Syncing',
    'Automated CI/CD Linting',
  ],
};

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

export const registeredParticipants = [
  { initials: 'SL', name: 'Sophia Lin', detail: 'Staff Designer · 4 mins ago' },
  {
    initials: 'MV',
    name: 'Marcus Vance',
    detail: 'Lead Systems Engineer · 18 mins ago',
  },
  {
    initials: 'AR',
    name: 'Amara Rhee',
    detail: 'Principal Architect · 1 hr ago',
  },
  {
    initials: 'DT',
    name: 'David Thorne',
    detail: 'UI/UX Consultant · 2 hrs ago',
  },
] as const;
