import {
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  Info,
  ListChecks,
  ShieldCheck,
} from 'lucide-react';
import { Callout, Text } from '@/components/ui';
import { ResourceLink } from './resource-link';
import { APP_LINKS } from '@/config/navigation';
import {
  ContactSupport,
  ContentCards,
  ResourceList,
  ResourcePage,
  type ResourceSection,
} from './resource-page';
import { FreeLimits } from './free-limits';

const sections: ResourceSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    label: 'Foundation',
    content: (
      <>
        <Text tone="secondary">
          Create your workspace and prepare your first live quiz in four steps.
        </Text>
        <ContentCards
          items={[
            {
              title: '1. Create an account',
              body: 'Sign up with your name, email address, and password.',
            },
            {
              title: '2. Verify your email',
              body: 'Enter the 6-digit verification code sent to your inbox. A verified account is required to use your workspace and participate.',
            },
            {
              title: '3. Create a project',
              body: 'Projects organize the quizzes you own. Choose an existing project or create one while setting up a quiz.',
            },
            {
              title: '4. Create a quiz',
              body: 'Add a title, description, planned start time, participant capacity, and questions. Your quiz stays a draft until you publish it.',
            },
          ]}
        />
      </>
    ),
  },
  {
    id: 'creating-quizzes',
    title: 'Creating Quizzes',
    label: 'Authoring',
    content: (
      <ContentCards
        items={[
          {
            title: 'Configure quiz details',
            body: 'Choose a project, add the quiz title and description, set the registration limit and default question timer, and optionally add a cover image.',
          },
          {
            title: 'Set a planned start time',
            body: 'The date and time tell participants when you plan to host. Scheduling does not automatically open a lobby or start the quiz.',
          },
          {
            title: 'Add questions and images',
            body: 'Use single-choice, multiple-answer, or descriptive questions. Format your prompts and optionally add images, which are optimized before upload.',
          },
          {
            title: 'Review and publish',
            body: 'Check the preview and answer keys before publishing. Publication opens registration through a public link and QR code. Published quiz content is locked.',
          },
        ]}
      />
    ),
  },
  {
    id: 'question-types',
    title: 'Supported Question Types',
    label: 'Questions',
    content: (
      <>
        <ContentCards
          items={[
            {
              title: 'Single choice',
              body: 'Exactly one correct option. Participants select one answer and press Submit.',
              icon: <CircleDot aria-hidden="true" />,
            },
            {
              title: 'Multiple answer',
              body: 'Participants must select the complete correct set and no incorrect options. Scoring is all-or-nothing.',
              icon: <ListChecks aria-hidden="true" />,
            },
            {
              title: 'Descriptive',
              body: 'Participants submit a written response for the host to review. These questions are ungraded and award no points.',
              icon: <FileText aria-hidden="true" />,
            },
          ]}
        />
        <Callout icon={<Info size={20} aria-hidden="true" />}>
          Single-choice and multiple-answer questions are scored for correctness
          and response speed. Descriptive answers do not affect competitive
          scores.
        </Callout>
      </>
    ),
  },
  {
    id: 'quiz-lifecycle',
    title: 'Quiz Lifecycle',
    label: 'Stages',
    content: (
      <>
        <ol className="grid gap-space-xs sm:grid-cols-5">
          {['Draft', 'Published', 'Lobby', 'Live', 'Completed'].map(
            (stage, i) => (
              <li
                key={stage}
                className="rounded-control bg-surface-low p-space-sm"
              >
                <Text variant="caption" tone="secondary">
                  {i + 1}
                </Text>
                <Text variant="label">{stage}</Text>
              </li>
            ),
          )}
        </ol>
        <Callout icon={<ShieldCheck size={20} aria-hidden="true" />} className="lg:items-center">
          The host opens the lobby, starts the quiz, and chooses each question.
          The planned start time is an announcement, not an automatic start.
        </Callout>
      </>
    ),
  },
  {
    id: 'hosting-live',
    title: 'Hosting a Live Quiz',
    label: 'Facilitation',
    content: (
      <ResourceList
        items={[
          'Open the published quiz’s management page and open its live lobby. Share the public link or QR code with participants.',
          'Wait for registered participants to join, then start the quiz. Starting uses one hosted-session allowance.',
          'Choose any available question and ask it. The server starts its timer and accepts answers until the deadline.',
          'After the timer ends, review the responses and statistics. An asked question cannot be asked again in the same quiz.',
          'Preview the leaderboard privately, or show it to participants when you are ready.',
          'Continue with another available question or end the quiz. Final results are saved, and the host can reveal the final leaderboard.',
        ]}
      />
    ),
  },
  {
    id: 'participating',
    title: 'Participating',
    label: 'Participant flow',
    content: (
      <>
        <ContentCards
          items={[
            {
              title: '1. Register',
              body: 'Open the public link or scan its QR code. Sign in or verify a new account, then register to reserve a seat. The quiz creator cannot register as a participant.',
            },
            {
              title: '2. Join the lobby',
              body: 'When the host opens the lobby, join through the public quiz page or your dashboard. Late entry depends on the host’s late-join setting.',
            },
            {
              title: '3. Submit your answer',
              body: 'Read the question, make your selection or enter text, then press Submit before the timer ends. Accepted answers cannot be changed.',
            },
            {
              title: '4. View your results',
              body: 'See question feedback and your personal score and rank. The host controls when the shared leaderboard is visible. Completed results appear in History.',
            },
          ]}
        />
        <Callout icon={<CheckCircle2 size={20} aria-hidden="true" />} className="md:items-center">
          Selecting an answer does not submit it. An answer that is not
          submitted before the deadline receives no points.
        </Callout>
      </>
    ),
  },
  {
    id: 'scoring',
    title: 'Scoring System',
    label: 'Mechanics',
    content: (
      <ContentCards
        items={[
          {
            title: 'Correctness and response speed',
            body: 'A correct scored answer earns points based on how quickly the server receives it within the question’s time limit. Faster correct answers earn more.',
          },
          {
            title: 'Incorrect answers',
            body: 'An incorrect answer earns zero points. Multiple-answer questions require the exact correct set; there is no partial credit.',
          },
          {
            title: 'Not attempted',
            body: 'An answer not accepted before the deadline earns zero points. Selecting an option alone is not a submission.',
          },
          {
            title: 'Descriptive answers',
            body: 'Written responses are ungraded. They are excluded from scored-answer statistics and earn zero points.',
          },
        ]}
      />
    ),
  },
  {
    id: 'reconnecting',
    title: 'Reconnecting',
    label: 'Connection recovery',
    content: (
      <>
        <Text tone="secondary">
          If your connection drops, reconnect using the same account. QuizMB
          restores the current session state and any accepted answer. A late
          join during an active question does not allow an answer to that
          question.
        </Text>
        <Callout icon={<Clock3 size={20} aria-hidden="true" />} className="lg:items-center">
          Reconnecting does not restart the timer, add answering time, or allow
          another answer after a submission was accepted.
        </Callout>
      </>
    ),
  },
  {
    id: 'limits',
    title: 'Current Free Limits',
    label: 'Account allowances',
    content: (
      <>
        <Text tone="secondary">
          QuizMB is free during early access. These allowances keep the service
          available for everyone.
        </Text>
        <FreeLimits appearance="cards" />
        <ResourceLink href={APP_LINKS.LEGAL.FAIR_USE}>
          Read the full Fair Use Policy
        </ResourceLink>
      </>
    ),
  },
];

export function Documentation() {
  return (
    <ResourcePage
      appearance="documentation"
      label="Product documentation · Current MVP"
      title="QuizMB Documentation"
      description="Everything you need to create, host, and participate in live quizzes."
      sections={sections}
    >
      <ContactSupport />
    </ResourcePage>
  );
}
