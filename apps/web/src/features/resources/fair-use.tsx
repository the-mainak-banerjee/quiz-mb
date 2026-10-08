import {
  ACCOUNT_LIMITS,
  LIVE_SESSION_LIMITS,
  MEDIA_LIMITS,
} from '@quizmb/contracts';
import { Info } from 'lucide-react';
import { Callout, Text } from '@/components/ui';
import { ResourceLink } from './resource-link';
import { APP_LINKS } from '@/config/navigation';
import { FreeLimits } from './free-limits';
import {
  ContactSupport,
  ContentCards,
  ResourceList,
  ResourcePage,
  type ResourceSection,
} from './resource-page';

const sections: ResourceSection[] = [
  {
    id: 'why-fair-use',
    title: 'Why Fair Use Exists',
    label: 'Foundation',
    content: (
      <>
        <Text tone="secondary">
          QuizMB is free during early access. Shared resources have limits, so
          reasonable account allowances help keep quiz creation and live
          participation reliable and available for everyone.
        </Text>
        <ContentCards
          items={[
            {
              title: 'Keep live quizzes responsive',
              body: 'Capacity and connection limits help protect question delivery, accepted submissions, and leaderboard updates.',
            },
            {
              title: 'Prevent automated abuse',
              body: 'Rate limits reduce excessive requests, account abuse, and repeated connection attempts.',
            },
            {
              title: 'Share capacity fairly',
              body: 'Every account currently has the same allowances for projects, images, participants, and hosted sessions.',
            },
            {
              title: 'Support free early access',
              body: 'These limits may change as we learn how the service is used. Current limits are listed below.',
            },
          ]}
        />
      </>
    ),
  },
  {
    id: 'current-free-limits',
    title: 'Current Free Limits',
    label: 'Allowances',
    content: (
      <>
        <Text tone="secondary">
          These are the account limits enforced by QuizMB. Participant capacity
          counts registrations, not only people currently connected.
        </Text>
        <FreeLimits />
      </>
    ),
  },
  {
    id: 'creation-upload-limits',
    title: 'Creation and Upload Limits',
    label: 'Rates',
    content: (
      <>
        <ResourceList
          items={[
            `Create up to ${ACCOUNT_LIMITS.quizCreationsPerDay} quizzes in a rolling 24-hour period. Deleting a quiz does not restore the creation allowance.`,
            `Upload up to ${ACCOUNT_LIMITS.uploadsPerDay} images in a rolling 24-hour period. Removing an image does not restore the upload allowance.`,
            `Own up to ${ACCOUNT_LIMITS.projects} projects at once. Deleting a project frees its slot.`,
            'Keep and edit as many drafts as you need, within the quiz creation, question, and image limits.',
            'Authentication, registration, and live commands also have rate limits. If a request is refused, follow the wait time shown before trying again.',
          ]}
        />
        <Callout
          icon={<Info size={20} aria-hidden="true" />}
          className="md:items-center"
        >
          Deleting and recreating content does not bypass rolling creation or
          upload limits.
        </Callout>
      </>
    ),
  },
  {
    id: 'hosted-sessions',
    title: 'Hosted Sessions',
    label: 'Session rules',
    content: (
      <>
        <Text tone="secondary">
          You can start up to {ACCOUNT_LIMITS.hostedSessionsPerMonth} live
          quizzes per calendar month (UTC). The allowance resets at the start of
          the next month.
        </Text>
        <ContentCards
          items={[
            {
              title: 'Drafting and publishing',
              body: 'Creating, editing, reviewing, and publishing a quiz do not consume the hosted-session allowance.',
            },
            {
              title: 'Opening a lobby',
              body: 'Opening a lobby does not consume an allowance. A lobby that is closed or expires before the quiz starts does not count.',
            },
            {
              title: 'Starting the quiz',
              body: 'One session counts when the host starts the quiz, before the first question is asked. Ending early or deleting the quiz does not give it back.',
            },
            {
              title: 'Monthly reset',
              body: 'Unused sessions do not accumulate. The new calendar month begins at 00:00 UTC on the first day.',
            },
          ]}
        />
        <ResourceList
          items={[
            `An unstarted lobby closes after ${LIVE_SESSION_LIMITS.lobbyMinutes} minutes.`,
            `A started quiz ends after its host has been disconnected for ${LIVE_SESSION_LIMITS.hostGraceMinutes} minutes. Reconnect within that period to continue hosting.`,
            `A live quiz lasts at most ${LIVE_SESSION_LIMITS.maxMinutes / 60} hours. Results recorded before it ends are retained.`,
          ]}
        />
      </>
    ),
  },
  {
    id: 'storage-and-media',
    title: 'Storage & Media',
    label: 'Images',
    content: (
      <ContentCards
        items={[
          {
            title: 'Browser optimization',
            body: `Images are resized and optimized in your browser to ${MEDIA_LIMITS.maxBytes / 1024} KB or less before upload. Only the optimized image is stored, not the full-size original.`,
          },
          {
            title: 'Shared account storage',
            body: `Your images share a ${ACCOUNT_LIMITS.mediaBytes / (1024 * 1024)} MB storage allowance across projects and quizzes. Pending uploads also count toward it.`,
          },
          {
            title: 'Text-only quizzes',
            body: 'Reaching the image storage limit does not stop text-only quiz creation or hosting. Other account allowances still apply.',
          },
          {
            title: 'Reclaiming space',
            body: 'Remove an image from a quiz to free its stored space. Removing content does not reset the rolling upload allowance.',
          },
        ]}
      />
    ),
  },
  {
    id: 'prohibited-abuse',
    title: 'Prohibited Abuse',
    label: 'Fair participation',
    content: (
      <ResourceList
        items={[
          'Creating multiple accounts to bypass allowances or capacity restrictions.',
          'Flooding requests or live connections, running automated submissions, or deliberately disrupting quizzes.',
          'Tampering with authentication, roles, answer submissions, or timing to gain access or manipulate scores.',
          'Using image storage for unrelated hosting, disguised executables, or malicious files.',
          'Uploading content you do not have permission to use, or content intended to harm or harass other users.',
          'Conducting security testing or stress testing without prior authorization.',
        ]}
      />
    ),
  },
  {
    id: 'limit-enforcement',
    title: 'What Happens When Limits Are Exceeded',
    label: 'Enforcement',
    content: (
      <>
        <ContentCards
          items={[
            {
              title: 'Action limits',
              body: 'An action that would exceed an account allowance is refused with an explanation. Wait for a reset or free capacity when the limit allows it.',
            },
            {
              title: 'Request rate limits',
              body: 'Too many requests may temporarily pause an action. The message explains when to try again when that information is available.',
            },
            {
              title: 'Live connection protection',
              body: 'Connections that repeatedly send excessive or refused live commands may be disconnected.',
            },
            {
              title: 'Service capacity',
              body: 'New sign-ups, new quizzes, or image uploads may be temporarily paused when the service approaches capacity.',
            },
          ]}
        />
        <Text tone="secondary">
          Accounts used to evade limits or disrupt the service may be restricted
          or removed. Contact us if a limit appears incorrect.
        </Text>
        <ResourceLink href={APP_LINKS.LEGAL.TERMS}>
          View Terms of Service
        </ResourceLink>
      </>
    ),
  },
];

export function FairUse() {
  return (
    <ResourcePage
      label="Policy document · Usage & availability"
      title="Fair Use Policy"
      description="How QuizMB keeps usage fair, reliable, and available for everyone."
      updated="October 8, 2026"
      sections={sections}
    >
      <ContactSupport title="Questions about a limit?">
        Tell us which action was refused and what the message said. Do not send
        passwords or verification codes.
      </ContactSupport>
    </ResourcePage>
  );
}
