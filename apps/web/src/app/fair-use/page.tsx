import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ACCOUNT_LIMITS,
  AUTHORING_LIMITS,
  LIVE_SESSION_LIMITS,
  MEDIA_LIMITS,
} from '@quizmb/contracts';
import { Surface, Text } from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';

export const metadata: Metadata = { title: 'Fair use · QuizMB' };

const MB = 1024 * 1024;

/**
 * The published fair-use policy (security design 1.11). Every number comes
 * from the same constants the server enforces, so the page never drifts.
 */
const SECTIONS: { title: string; rules: string[] }[] = [
  {
    title: 'Authoring',
    rules: [
      'Drafts are unlimited: edit and keep as many draft quizzes as you need.',
      `Up to ${ACCOUNT_LIMITS.projects} projects at a time. Deleting a project frees its slot.`,
      `Up to ${ACCOUNT_LIMITS.quizCreationsPerDay} new quizzes in any 24 hours. Deleting a quiz does not give it back.`,
      `Up to ${AUTHORING_LIMITS.questions} questions in a quiz.`,
    ],
  },
  {
    title: 'Images',
    rules: [
      `Up to ${ACCOUNT_LIMITS.mediaBytes / MB} MB of stored images per account. Removing an image from a quiz frees its space.`,
      `Up to ${ACCOUNT_LIMITS.uploadsPerDay} image uploads in any 24 hours.`,
      `Images are optimized in your browser to ${MEDIA_LIMITS.maxBytes / 1024} KB or less before upload.`,
    ],
  },
  {
    title: 'Live quizzes',
    rules: [
      `Start up to ${ACCOUNT_LIMITS.hostedSessionsPerMonth} live quizzes per calendar month (UTC). Opening a lobby is free; a start counts once the quiz begins.`,
      `Up to ${ACCOUNT_LIMITS.participantsPerSession} participants per quiz.`,
      `An unstarted lobby closes after ${LIVE_SESSION_LIMITS.lobbyMinutes} minutes.`,
      `A started quiz ends ${LIVE_SESSION_LIMITS.hostGraceMinutes} minutes after its host disconnects, and after ${LIVE_SESSION_LIMITS.maxMinutes / 60} hours at most. Results so far are kept.`,
    ],
  },
  {
    title: 'Keeping it fair for everyone',
    rules: [
      'Requests are rate limited. If you see “Too many attempts”, wait for the time shown and try again.',
      'Live connections that keep sending far more than a person could are disconnected.',
      'One person, one account. Accounts created to get around these limits may be removed.',
      'When the service is close to capacity, new sign-ups, new quizzes or image uploads may be paused for a while. Everything you already have keeps working.',
    ],
  },
];

export default function FairUsePage() {
  return (
    <main className="mx-auto max-w-content px-margin-sm py-space-2xl md:px-margin lg:px-margin-lg">
      <section className="space-y-space-md">
        <Text variant="label" tone="secondary">
          QuizMB · Policy
        </Text>
        <Text as="h1" variant="display">
          Fair use
        </Text>
        <Text tone="secondary">
          QuizMB is free while it is in early access. These limits keep it fast
          and available for everyone. They apply to every account and may change
          as we learn how the service is used.
        </Text>
        {SECTIONS.map(({ title, rules }) => (
          <Surface as="section" key={title} className="space-y-space-sm">
            <Text as="h2" variant="section-heading">
              {title}
            </Text>
            <ul className="list-disc space-y-space-xs pl-space-md">
              {rules.map((rule) => (
                <li key={rule}>
                  <Text as="span" tone="secondary">
                    {rule}
                  </Text>
                </li>
              ))}
            </ul>
          </Surface>
        ))}
        <Link
          href={APP_LINKS.HOME}
          className="ds-focus text-label text-accent underline"
        >
          Back to QuizMB
        </Link>
      </section>
    </main>
  );
}
