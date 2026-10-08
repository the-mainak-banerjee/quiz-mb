import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Callout, Surface, Text } from '@/components/ui';
import {
  ContactSupport,
  ContentCards,
  ResourceList,
  ResourcePage,
  type ResourceSection,
} from './resource-page';

const sections: ResourceSection[] = [
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    content: (
      <>
        <Text tone="secondary">
          QuizMB processes information you provide and information needed to
          operate and protect the service.
        </Text>
        <ContentCards
          items={[
            {
              title: 'Account information',
              body: 'Your display name, email address, verification status, password hash, and account creation and update records.',
            },
            {
              title: 'Authentication and security',
              body: 'Session records, verification and reset records, and technical information used for authentication, request limits, and troubleshooting, such as IP addresses and request identifiers.',
            },
            {
              title: 'Content you create',
              body: 'Projects, quiz titles and descriptions, questions, answer options and keys, planned times, settings, and optimized images you upload.',
            },
            {
              title: 'Quiz participation',
              body: 'Registrations, project associations, live-session participation, submitted answers, submission times, response durations, scores, and ranks.',
            },
          ]}
        />
        <Callout
          icon={<LockKeyhole size={20} aria-hidden="true" />}
          className="lg:items-center"
        >
          Passwords are stored as salted Argon2id hashes. Verification and reset
          codes are stored as keyed hashes. We do not store plaintext passwords.
        </Callout>
      </>
    ),
  },
  {
    id: 'how-we-use-information',
    title: 'How We Use Information',
    content: (
      <ResourceList
        items={[
          'Create and verify accounts, sign you in, maintain sessions, and help you reset your password.',
          'Store projects and quizzes, manage registrations, and deliver live questions and accepted answers.',
          'Calculate scores and ranks on the server and make completed results available to the appropriate users.',
          'Enforce account allowances, protect against abuse, and diagnose service problems.',
          'Respond to support and privacy requests.',
        ]}
      />
    ),
  },
  {
    id: 'email-communications',
    title: 'Email Communications',
    content: (
      <>
        <ContentCards
          items={[
            {
              title: 'Email verification',
              body: 'We send time-limited 6-digit codes to confirm your email address during account setup.',
            },
            {
              title: 'Password recovery',
              body: 'We send time-limited 6-digit codes when a password reset is requested.',
            },
            {
              title: 'Password-change notices',
              body: 'A security email is sent after a successful password reset or password change.',
            },
          ]}
        />
        <Text tone="secondary">
          QuizMB currently uses email for account and security messages, not
          marketing newsletters. Email delivery requires processing your address
          through the configured email provider.
        </Text>
      </>
    ),
  },
  {
    id: 'quiz-hosts-participants',
    title: 'Quiz Hosts & Participants',
    content: (
      <>
        <Text tone="secondary">
          Public quiz pages show published quiz details, the host’s display
          name, the planned time, and registration availability. Publishing
          makes those details accessible to anyone with the link.
        </Text>
        <ResourceList
          items={[
            'Hosts can see their registration roster, participant display names, live presence, submitted answers, response information, and results.',
            'Participants can see their own submissions and results. When the host shares a leaderboard, participant names, scores, and ranks are visible to the room.',
            'Account email addresses are not included in host registration rosters or shared leaderboards.',
            'Answer keys are excluded from public registration pages and are not sent to participants before the appropriate question result stage.',
          ]}
        />
        <Callout
          icon={<ShieldCheck size={20} aria-hidden="true" />}
          className="lg:items-center"
        >
          Avoid including private or sensitive information in public quiz
          content, display names, or answers shared with a host.
        </Callout>
      </>
    ),
  },
  {
    id: 'cookies-authentication',
    title: 'Cookies & Authentication',
    content: (
      <ContentCards
        items={[
          {
            title: 'Necessary session cookies',
            body: 'QuizMB uses HttpOnly authentication cookies to maintain signed-in sessions. Production cookies use secure settings. Logging out revokes the current sign-in session.',
          },
          {
            title: 'Request protection',
            body: 'State-changing API requests are checked against trusted origins. Session and authorization checks also determine which actions and data you can access.',
          },
        ]}
      />
    ),
  },
  {
    id: 'service-providers',
    title: 'Service Providers & Infrastructure',
    content: (
      <>
        <Text tone="secondary">
          QuizMB uses service providers for application hosting, database
          storage, images, temporary live-session state, email delivery, and
          operational monitoring. Information needed for those functions may be
          processed by the relevant provider.
        </Text>
        <ContentCards
          items={[
            {
              title: 'Database and images',
              body: 'Supabase provides PostgreSQL storage for account and quiz records and object storage for uploaded images.',
            },
            {
              title: 'Temporary live state',
              body: 'Redis, hosted through Upstash, supports temporary presence and coordination for live sessions.',
            },
            {
              title: 'Hosting and monitoring',
              body: 'Application hosting and monitoring providers process requests and operational logs to serve pages and investigate failures.',
            },
            {
              title: 'Transactional email',
              body: 'The configured email service processes addresses and account-security messages for delivery.',
            },
          ]}
        />
        <Text tone="secondary">
          We do not sell personal information or use it for advertising.
          Provider processing and retention follow the provider’s applicable
          terms and settings.
        </Text>
      </>
    ),
  },
  {
    id: 'security-practices',
    title: 'Security Practices',
    content: (
      <>
        <ResourceList
          items={[
            'Production traffic uses HTTPS, and live connections use secure transport.',
            'The server checks authentication, ownership, roles, and eligibility before accepting protected actions.',
            'Password hashing, time-limited codes, session revocation, and request limits help protect accounts.',
            'Operational logs are designed to exclude passwords, verification codes, authentication tokens, and cookies.',
          ]}
        />
        <Text tone="secondary">
          No service can guarantee complete security. Contact us if you believe
          your account or quiz data has been accessed without permission.
        </Text>
      </>
    ),
  },
  {
    id: 'data-retention-deletion',
    title: 'Data Retention & Account Deletion',
    content: (
      <>
        <ContentCards
          items={[
            {
              title: 'Unverified accounts',
              body: 'Accounts that have never verified their email are eligible for automatic deletion after 7 days. This rule does not apply to verified accounts.',
            },
            {
              title: 'Account deletion',
              body: 'Use Settings → Delete account and confirm with DELETE and your password. Deletion removes your account and associated records and attempts to remove owned image files.',
            },
          ]}
        />
        <Text tone="secondary">
          Account deletion is refused while you host a published, lobby, or live
          quiz, or remain registered for an unfinished quiz. Resolve those
          activities first; the interface explains what is blocking deletion.
        </Text>
        <Text tone="secondary">
          Account and quiz records are retained while needed to provide the
          service until they are deleted. Provider backups, operational logs, or
          files awaiting successful storage cleanup may persist separately from
          active application records. Contact us with questions about deletion
          or retained information.
        </Text>
      </>
    ),
  },
  {
    id: 'childrens-privacy',
    title: 'Children’s Privacy & Educational Use',
    content: (
      <>
        <Text tone="secondary">
          QuizMB is not intended for children under 13. Teachers and organizers
          should consider the privacy needs of their participants and avoid
          putting sensitive student information into quiz content.
        </Text>
        <Text tone="secondary">
          Participation currently requires a verified account; QuizMB does not
          offer anonymous classroom or guest entry. If you believe a child under
          13 has provided personal information, contact us so we can investigate
          and address the request.
        </Text>
      </>
    ),
  },
  {
    id: 'changes-to-policy',
    title: 'Changes to This Policy',
    content: (
      <Text tone="secondary">
        This policy may change as the service evolves. Updates will be reflected
        in the date at the top of this page. Review this page for the current
        description of QuizMB’s data practices.
      </Text>
    ),
  },
  {
    id: 'contact-us',
    title: 'Contact Us',
    content: (
      <ContactSupport title="Privacy questions">
        Email us about your information, account deletion, or a privacy concern.
        Include enough context to identify the request, but never send passwords
        or verification codes.
      </ContactSupport>
    ),
  },
];

export function Privacy() {
  return (
    <ResourcePage
      numberedSections={false}
      title="Privacy Policy"
      description="What QuizMB collects, how information is used, and how you can manage your account and data."
      label="Data & privacy"
      updated="October 8, 2026"
      sections={sections}
      introduction={
        <Surface className="space-y-space-sm">
          <Text as="h2" variant="section-heading">
            Our approach
          </Text>
          <Text tone="secondary">
            QuizMB uses account and quiz information to deliver live quizzes,
            maintain results, and protect the service. We do not sell personal
            information or use it for advertising.
          </Text>
        </Surface>
      }
    />
  );
}
