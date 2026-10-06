/** A preformatted label, or a timestamp formatted in the viewer's browser. */
export type QuizTiming =
  string | { prefix?: string; at: string; format: 'date' | 'dateTime' };

export type Quiz = {
  id: string;
  publicId?: string;
  /** Completed quizzes a participant registered for: their summary page. */
  liveSessionId?: string;
  project: string;
  role: 'host' | 'participant';
  status: 'live' | 'scheduled' | 'draft' | 'completed';
  statusLabel?: string;
  title: string;
  description: string;
  timing: QuizTiming;
  detail: string;
  action: string;
};
