export type Quiz = {
  id: string;
  project: string;
  role: 'host' | 'participant';
  status: 'live' | 'scheduled' | 'draft' | 'completed';
  statusLabel?: string;
  title: string;
  description: string;
  timing: string;
  detail: string;
  action: string;
};

// Presentation fixtures only: no live state, scoring, or product API integration.
export const quizzes: Quiz[] = [
  {
    id: 'architecture',
    project: 'Core Product Team',
    role: 'host',
    status: 'live',
    statusLabel: 'Live Ready',
    title: 'Q3 Design Architecture Trivia',
    description:
      'Interactive review covering design tokens, accessibility, and component libraries.',
    timing: 'Starts in 45m',
    detail: '12 questions',
    action: 'Launch Room',
  },
  {
    id: 'systems',
    project: 'Engineering Systems',
    role: 'participant',
    status: 'live',
    title: 'Distributed Systems & Cache Invalidation',
    description:
      'Staff engineering live challenge on consensus protocols and event ordering.',
    timing: 'Started 4m ago',
    detail: '48 peers in room',
    action: 'Join Quiz',
  },
  {
    id: 'critique',
    project: 'Design Systems Team',
    role: 'host',
    status: 'scheduled',
    title: 'Design Critique Alignment',
    description:
      'Structured assessment on spacing rhythm, optical balance, and dark mode.',
    timing: 'Tomorrow, 10:00 AM',
    detail: '14 enrolled',
    action: 'Manage & Edit',
  },
  {
    id: 'research',
    project: 'Research Lab',
    role: 'participant',
    status: 'scheduled',
    title: 'Weekly UX Research Synthesis',
    description:
      'Live synthesis of unmoderated usability tests across participant cohorts.',
    timing: 'Thursday, 2:30 PM',
    detail: 'Registered',
    action: 'View Details',
  },
  {
    id: 'onboarding',
    project: 'Core Product Team',
    role: 'host',
    status: 'draft',
    title: 'Frontend Onboarding Sprint',
    description:
      'Setup quiz for incoming software engineers testing codebase conventions.',
    timing: 'Updated 2h ago',
    detail: '12 questions',
    action: 'Edit Draft',
  },
  {
    id: 'milestones',
    project: 'Company All-Hands',
    role: 'participant',
    status: 'completed',
    title: 'Quarterly Product Milestone Sync',
    description:
      'Company-wide review and retrospective trivia with live scoring.',
    timing: 'Oct 12',
    detail: 'Scored 92% (Rank 4/86)',
    action: 'View My Results',
  },
];

export const upcomingQuiz: Quiz = {
  id: 'product-sync',
  project: 'Core Product Team',
  role: 'host',
  status: 'scheduled',
  statusLabel: 'Scheduled Today · 3:00 PM',
  title: 'Product Design Sync',
  description: 'Core Product Team · 18 registered peers',
  timing: 'Starts in 45m',
  detail: '12 questions',
  action: 'Launch Room',
};

export const projects = [
  { id: 'design', title: 'Design Systems Team', quizzes: 4, members: 6 },
  { id: 'company', title: 'Company All-Hands', quizzes: 2, members: 42 },
  { id: 'cohorts', title: 'New Hire Cohorts', quizzes: 6, members: 14 },
] as const;
