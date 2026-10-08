import {
  ACCOUNT_LIMITS,
  LIVE_SESSION_LIMITS,
  OTP_RULES,
} from '@quizmb/contracts';

export const HELP_CATEGORIES = [
  { value: 'all', label: 'All Topics' },
  { value: 'getting-started', label: 'Getting Started' },
  { value: 'live-quizzes', label: 'Live Quizzes' },
  { value: 'account', label: 'Account' },
  { value: 'hosting', label: 'Hosting' },
] as const;
export type HelpCategory = (typeof HELP_CATEGORIES)[number]['value'];
export type HelpQuestion = { id: string; question: string; answer: string };
export const HELP_GROUPS: {
  id: Exclude<HelpCategory, 'all'>;
  title: string;
  description: string;
  questions: HelpQuestion[];
}[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Accounts, projects, and your first quiz',
    questions: [
      {
        id: 'create-quiz',
        question: 'How do I create a quiz?',
        answer:
          'Open Quizzes and choose Create quiz, or create a quiz from a project. Select an existing project or create one inline, add the quiz details and questions, then review and publish when ready.',
      },
      {
        id: 'participant-account',
        question: 'Do participants need an account?',
        answer:
          'Yes. Participants need to sign in with a verified QuizMB account to register and join. If they create an account from a public quiz link, they return to that quiz after completing signup and email verification. Guest entry is not supported.',
      },
      {
        id: 'planned-start',
        question: 'When does a quiz start?',
        answer:
          'The planned date and time tell participants when to expect the quiz. The host must open the lobby and start the quiz manually. Scheduling does not start it automatically.',
      },
    ],
  },
  {
    id: 'live-quizzes',
    title: 'Live Quizzes',
    description: 'Lobbies, connections, answers, and leaderboards',
    questions: [
      {
        id: 'lobby-access',
        question: 'I registered but can’t enter the lobby',
        answer:
          'The host must open the lobby first. Return to the public quiz page or your dashboard and use Join lobby when it becomes available. Once the quiz has started, entry depends on the host’s late-join setting.',
      },
      {
        id: 'connection-loss',
        question: 'What happens if I lose my connection?',
        answer:
          'Reconnect with the same account. QuizMB restores the current session and any accepted submission. The server timer continues while you are disconnected, so reconnecting does not give extra answering time.',
      },
      {
        id: 'change-answer',
        question: 'Can I change an answer after submitting?',
        answer:
          'No. An accepted submission is locked. You can change your selection before pressing Submit; selecting an option alone does not submit the answer.',
      },
      {
        id: 'question-order',
        question: 'Can the host choose question order?',
        answer:
          'Yes. The host chooses any available question, then starts it. Each question can be asked only once, and the host waits for the current question to end before asking another.',
      },
      {
        id: 'leaderboard',
        question: 'Why can’t I see the shared leaderboard?',
        answer:
          'The host controls when the room’s leaderboard appears and can preview it privately. Your personal feedback and results are separate from the shared leaderboard.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    description: 'Verification, passwords, profile settings, and deletion',
    questions: [
      {
        id: 'verification-code',
        question: 'I didn’t receive my verification code',
        answer: `Check your spam folder and confirm you entered the correct email address. Use Resend code once the ${OTP_RULES.resendCooldownSeconds}-second cooldown has passed. Delivery and resend limits may temporarily delay another attempt; follow the message shown.`,
      },
      {
        id: 'forgot-password',
        question: 'I forgot my password',
        answer:
          'Choose Forgot password on the sign-in page. Enter the 6-digit reset code sent to your email, then choose a new password. A successful reset signs out existing sessions and requires you to sign in again.',
      },
      {
        id: 'change-email',
        question: 'Can I change my email address?',
        answer:
          'Email address changes are not currently supported. Contact support if you need help with account access.',
      },
      {
        id: 'change-name',
        question: 'Can I change my name?',
        answer:
          'Yes. Open Settings, update your display name, and save the change. Your display name is used in registration rosters and leaderboards.',
      },
      {
        id: 'delete-account',
        question: 'How do I delete my account?',
        answer:
          'Open Settings → Delete account. Type DELETE and enter your password to confirm. Deletion is blocked while you host a published or active quiz or are registered for an unfinished quiz. Resolve that activity first; the page explains any blocker.',
      },
    ],
  },
  {
    id: 'hosting',
    title: 'Hosting',
    description: 'Capacity, monthly allowances, and session continuity',
    questions: [
      {
        id: 'participant-limit',
        question: 'How many participants can join?',
        answer: `A free account can set a quiz capacity of up to ${ACCOUNT_LIMITS.participantsPerSession} registered participants. Capacity counts registrations, not concurrent connections. Unregistering before the quiz starts frees a seat. A host cannot register for their own quiz.`,
      },
      {
        id: 'hosting-limit',
        question: 'How many live quizzes can I host?',
        answer: `You can start ${ACCOUNT_LIMITS.hostedSessionsPerMonth} live quizzes per calendar month. The allowance resets at 00:00 UTC on the first day of the next month. Ending a quiz early does not restore a used session.`,
      },
      {
        id: 'lobby-allowance',
        question: 'Does opening the lobby use one of my live sessions?',
        answer: `No. Opening a lobby does not count. One allowance is used when you start the quiz, before you ask the first question. An unstarted lobby expires after ${LIVE_SESSION_LIMITS.lobbyMinutes} minutes.`,
      },
      {
        id: 'host-disconnect',
        question: 'What happens if the host disconnects?',
        answer: `A started quiz remains available during a ${LIVE_SESSION_LIMITS.hostGraceMinutes}-minute host disconnect grace period. Reopen the live host page with the same account to continue. If the host stays disconnected beyond that period, the quiz ends and results recorded so far are kept. A live quiz also has a maximum duration of ${LIVE_SESSION_LIMITS.maxMinutes / 60} hours.`,
      },
    ],
  },
];
