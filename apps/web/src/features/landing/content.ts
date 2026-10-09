import { ACCOUNT_LIMITS } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';

/** New hosts sign up; returning users continue to their dashboard.
 * Plain links, no return-to query. */
export const START_HREF = APP_LINKS.AUTH.SIGNUP;
export const SIGN_IN_HREF = APP_LINKS.AUTH.LOGIN;

/** Resolve conversion links from verified server-side authentication. */
export function landingAction(signedIn: boolean) {
  return signedIn
    ? { href: APP_LINKS.WORKSPACE.DASHBOARD, label: 'Go to dashboard' }
    : { href: START_HREF, label: 'Create your first quiz, free' };
}

export const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Who it’s for', href: '#who-its-for' },
  { label: 'FAQ', href: '#faq' },
] as const;

/** The app's domain, and the links shown in the page's illustrations. */
const SITE_HOST = 'quizmb.themainakb.com';
export const SHARE_LINK = `${SITE_HOST}/quiz/cohort-3-week-4`;
export const HOST_LINK = `${SITE_HOST}/quizzes/cohort-3-week-4/live`;

export const STEPS = [
  {
    title: 'Build your quiz',
    body: 'Single choice, multiple choice or short answers, grouped into a project for each course or cohort.',
  },
  {
    title: 'Share the link before class',
    body: 'Post the link or QR code in your course email or community. Learners register once, ahead of time.',
  },
  {
    title: 'Host it live',
    body: 'Start each question when you are ready, watch answers arrive, explain, then reveal the leaderboard.',
  },
] as const;

export const AUDIENCES = [
  {
    eyebrow: 'Primary',
    title: 'Course creators and coaches running live cohorts',
    scenario:
      '“Week 4 recap for Cohort 3.” Warm up with five questions, pause on the one half the group missed, and end the call with a leaderboard.',
    points: [
      'A project for each cohort',
      'Scores and history across the course',
      'Runs beside your usual video call',
    ],
  },
  {
    eyebrow: 'Also great for',
    title: 'Learning communities with a weekly challenge',
    scenario:
      '“Friday topic quiz.” Members join from the link in your community post, compete on speed, and come back next week to climb the board.',
    points: [
      'One link to share each week',
      'Friendly, speed-based competition',
      'Members keep their quiz history',
    ],
  },
] as const;

export const FAQ = [
  {
    question: 'Do my learners need an account?',
    answer:
      'Yes, once. Share the registration link or QR code before the session, in your course email or community post, so nobody signs up during the live moment. Learners then keep their scores and quiz history across everything you run.',
  },
  {
    question: 'Does QuizMB replace Zoom or Google Meet?',
    answer:
      'No. Keep your usual call, or run it in the room. QuizMB hosts the quiz; learners answer on their phone or in a second tab while you keep talking.',
  },
  {
    question: 'Who controls the pace?',
    answer:
      'You do. Start each question when you are ready. When its timer ends, answers lock and the correct answer is shown automatically, so plan your explanation for right after. Show the leaderboard whenever you choose.',
  },
  {
    question: 'How does scoring work?',
    answer:
      'Correct answers earn points, and faster correct answers earn more. The leaderboard ranks everyone by total points.',
  },
  {
    question: 'How many people can join?',
    answer: `Up to ${ACCOUNT_LIMITS.participantsPerSession} participants per quiz, and ${ACCOUNT_LIMITS.hostedSessionsPerMonth} live quizzes per month during early access.`,
  },
  {
    question: 'Is it free?',
    answer:
      'Yes, QuizMB is free during early access, with fair-use limits so it stays fast for everyone.',
  },
  {
    question: 'What isn’t included yet?',
    answer:
      'No AI-generated questions, certificates, advanced analytics or exam proctoring. QuizMB is built for live practice and engagement, not formal assessment.',
  },
] as const;
