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
  plannedStartAt: string;
  date: string;
  dateTileMonth: string;
  dateTileDay: string;
  time: string;
  cover: MediaDto | null;
  registrationLimit: number;
  registeredCount: number;
  publicUrl: string;
};
