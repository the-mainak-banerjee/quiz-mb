import { Callout, Surface, Text } from '@/components/ui';
import { ResourceLink } from './resource-link';
import { APP_LINKS } from '@/config/navigation';
import {
  ContactSupport,
  ContentCards,
  ResourceList,
  ResourcePage,
  type ResourceSection,
} from './resource-page';

const sections: ResourceSection[] = [
  {
    id: 'using-quizmb',
    title: 'Using QuizMB',
    content: (
      <>
        <Text tone="secondary">
          QuizMB lets you organize projects, create quizzes, publish
          registration links, host live sessions, and participate in other
          hosts’ quizzes. The service is currently free during early access.
        </Text>
        <Text tone="secondary">
          You must be at least 13 to create an account. Use QuizMB only where
          you are permitted to do so, and obtain any permission required by your
          organization before sharing its content or other people’s information.
        </Text>
        <ContentCards
          items={[
            {
              title: 'Hosts',
              body: 'Create and manage quizzes, open the lobby, start sessions, choose questions, and control when shared leaderboards appear.',
            },
            {
              title: 'Participants',
              body: 'Use a verified account to register, join eligible sessions, submit answers, and view personal results.',
            },
          ]}
        />
      </>
    ),
  },
  {
    id: 'accounts-security',
    title: 'Accounts & Security',
    content: (
      <>
        <Text tone="secondary">
          Provide an email address you control, verify it, and keep your
          credentials private. You are responsible for the content and actions
          submitted through your account. Do not share passwords or verification
          codes.
        </Text>
        <Text tone="secondary">
          You can update your display name and change your password in Settings.
          Email address changes are not currently supported. A successful
          password change or reset revokes existing sessions and requires you to
          sign in again.
        </Text>
        <Text tone="secondary">
          Contact us if you suspect unauthorized access. Support will not ask
          you to send a password or verification code.
        </Text>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    content: (
      <ResourceList
        items={[
          'Do not disrupt quizzes, flood requests or connections, or automate activity to exhaust service resources.',
          'Do not evade account allowances or participant limits by creating multiple accounts or tampering with requests.',
          'Do not try to access another user’s private projects, answers, credentials, or protected host functions.',
          'Do not forge answers, roles, timing, or scores, or use unauthorized tools to gain an advantage.',
          'Do not upload malicious files, unlawful content, harassment, or content that infringes another person’s rights.',
          'Do not perform security testing or load testing without prior authorization.',
        ]}
      />
    ),
  },
  {
    id: 'your-content',
    title: 'Your Content & Intellectual Property',
    content: (
      <>
        <Text tone="secondary">
          You retain ownership of the content you create. You must have
          permission to upload and share quiz questions, answer material,
          images, and other content.
        </Text>
        <Text tone="secondary">
          By adding content to QuizMB, you permit us to store, process, display,
          and transmit it as needed to provide the quiz service. Publishing a
          quiz makes its public details accessible through its link;
          participants and hosts can view the information made available to
          their roles.
        </Text>
        <Text tone="secondary">
          QuizMB’s name, branding, and application materials are separate from
          your quiz content. These terms do not transfer ownership of either
          party’s materials.
        </Text>
      </>
    ),
  },
  {
    id: 'quiz-results',
    title: 'Quiz Results & Realtime Reliability',
    content: (
      <>
        <Text tone="secondary">
          The server decides quiz state, answer eligibility, deadlines, accepted
          submissions, correctness, scores, and ranks. Scored answers earn
          points for correctness and response speed. Incorrect and unattempted
          answers earn zero; descriptive responses are ungraded.
        </Text>
        <Text tone="secondary">
          An accepted submission cannot be changed. Reconnecting does not add
          answering time. Network delays may affect whether an answer reaches
          the server before the deadline.
        </Text>
        <Text tone="secondary">
          QuizMB is designed for live knowledge-sharing and quizzes. Hosts
          remain responsible for how they interpret results and use them with
          their participants.
        </Text>
      </>
    ),
  },
  {
    id: 'usage-limits',
    title: 'Usage Limits & Fair Use',
    content: (
      <>
        <Text tone="secondary">
          Account allowances and request limits protect shared service capacity.
          Limits cover owned projects, quiz creation, questions, images,
          registrations, and started live sessions.
        </Text>
        <Callout>
          <Text variant="label">Read the current limits</Text>
          <Text variant="body-secondary" tone="secondary" className="mb-space-xs">
            Opening a lobby is free. A hosted session counts when the host
            starts the quiz, before the first question is asked.
          </Text>
          <ResourceLink href={APP_LINKS.LEGAL.FAIR_USE}>
            Review Fair Use Policy
          </ResourceLink>
        </Callout>
      </>
    ),
  },
  {
    id: 'free-service',
    title: 'Free Early Access Service',
    content: (
      <>
        <ContentCards
          items={[
            {
              title: 'No subscription required',
              body: 'QuizMB currently has no subscription charge or payment-card requirement.',
            },
            {
              title: 'Current allowances apply',
              body: 'Free access remains subject to the limits and safeguards described in the Fair Use Policy.',
            },
          ]}
        />
        <Text tone="secondary">
          Features, availability, and allowances may change as the product
          develops. These terms do not promise that early-access features or
          pricing will remain unchanged.
        </Text>
      </>
    ),
  },
  {
    id: 'account-termination',
    title: 'Account Suspension & Deletion',
    content: (
      <>
        <Text tone="secondary">
          You can request account deletion in Settings by confirming DELETE and
          your password. You must first resolve any published or active quiz you
          host and any registration for an unfinished quiz. The application
          explains any blocking activity.
        </Text>
        <Text tone="secondary">
          Deleting your account removes your associated application records.
          Review the Privacy Policy for details about data and storage cleanup.
        </Text>
        <Text tone="secondary">
          Access may be restricted or removed where necessary to address abuse,
          protect other users or service availability, or comply with applicable
          requirements. Verified accounts are not automatically deleted merely
          for being inactive.
        </Text>
      </>
    ),
  },
  {
    id: 'service-availability',
    title: 'Service Availability',
    content: (
      <>
        <Text tone="secondary">
          QuizMB is an evolving early-access service. Maintenance, network
          problems, provider outages, or software faults may interrupt
          availability. We cannot promise uninterrupted sessions or error-free
          operation.
        </Text>
        <Text tone="secondary">
          Keep your own copies of content you need to retain. Quiz limits and
          recovery behavior are described in Documentation and the Fair Use
          Policy.
        </Text>
      </>
    ),
  },
  {
    id: 'responsible-use',
    title: 'Responsible Use of Results',
    content: (
      <>
        <Text tone="secondary">
          Use quiz results in context. Timing depends on when the server
          receives an answer, and internet connectivity can affect that timing.
          Quiz results alone may not reflect a participant’s knowledge or
          circumstances.
        </Text>
        <Text tone="secondary">
          These terms do not exclude rights or obligations that cannot be
          excluded under applicable law.
        </Text>
      </>
    ),
  },
  {
    id: 'changes-to-terms',
    title: 'Changes to These Terms',
    content: (
      <Text tone="secondary">
        We may update these terms as QuizMB changes. The date at the top
        identifies the current version. Review this page and the linked policies
        for the terms that apply to the service.
      </Text>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: (
      <ContactSupport title="Questions about these terms?">
        Use this address for account help, content concerns, privacy questions,
        or notices about these terms.
      </ContactSupport>
    ),
  },
];

export function Terms() {
  return (
    <ResourcePage
      appearance="terms"
      numberedSections={false}
      title="Terms of Service"
      description="The guidelines for creating, hosting, and participating in QuizMB quizzes."
      label="Platform guidelines · Early access"
      updated="October 8, 2026"
      sections={sections}
      introduction={
        <Surface className="space-y-space-sm">
          <Text as="h2" variant="section-heading">
            Agreement overview
          </Text>
          <Text tone="secondary">
            By using QuizMB, you agree to these terms and the Fair Use Policy.
            If you do not agree, do not use the service. The Privacy Policy
            explains how information is handled.
          </Text>
          <ResourceLink href={APP_LINKS.LEGAL.PRIVACY}>
            Read Privacy Policy
          </ResourceLink>
        </Surface>
      }
    />
  );
}
