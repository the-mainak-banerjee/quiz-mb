import {
  ACCOUNT_LIMITS,
  AUTHORING_LIMITS,
  MEDIA_LIMITS,
} from '@quizmb/contracts';
import { Surface, Text } from '@/components/ui';

/** Shared display data: the same constants are enforced by the API. */
const LIMITS = [
  {
    title: 'Projects',
    value: `${ACCOUNT_LIMITS.projects} projects`,
    scope: 'Owned at one time',
  },
  {
    title: 'Draft quizzes',
    value: 'Unlimited drafts',
    scope: 'Creation limits still apply',
  },
  {
    title: 'Questions per quiz',
    value: `${AUTHORING_LIMITS.questions} questions`,
    scope: 'Per quiz',
  },
  {
    title: 'Hosted live sessions',
    value: `${ACCOUNT_LIMITS.hostedSessionsPerMonth} sessions`,
    scope: 'Per calendar month (UTC)',
  },
  {
    title: 'Quiz participants',
    value: `${ACCOUNT_LIMITS.participantsPerSession} registrations`,
    scope: 'Maximum capacity per quiz',
  },
  {
    title: 'Image storage',
    value: `${ACCOUNT_LIMITS.mediaBytes / (1024 * 1024)} MB`,
    scope: 'Total per account',
  },
  {
    title: 'Individual image size',
    value: `${MEDIA_LIMITS.maxBytes / 1024} KB`,
    scope: 'After browser optimization',
  },
];

export function FreeLimits({
  appearance = 'table',
}: {
  appearance?: 'table' | 'cards';
}) {
  if (appearance === 'cards')
    return (
      <div className="grid gap-space-md sm:grid-cols-2 xl:grid-cols-3">
        {LIMITS.map(({ title, value, scope }) => (
          <Surface key={title} className="space-y-space-sm">
            <Text as="h3" variant="label" tone="secondary">
              {title}
            </Text>
            <Text variant="page-title">{value}</Text>
            <Text variant="caption" tone="secondary">
              {scope}
            </Text>
          </Surface>
        ))}
      </div>
    );
  return (
    <Surface className="overflow-hidden p-0">
      <table className="w-full table-fixed text-left">
        <caption className="sr-only">Current free account limits</caption>
        <thead className="bg-surface-low">
          <tr>
            {['Resource', 'Free allowance', 'Scope'].map((label) => (
              <th key={label} scope="col" className="p-space-xs sm:p-space-sm">
                <Text as="span" variant="label">
                  {label}
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LIMITS.map(({ title, value, scope }) => (
            <tr key={title} className="border-t border-border-surface">
              <th scope="row" className="p-space-xs sm:p-space-sm">
                <Text as="span" variant="label">
                  {title}
                </Text>
              </th>
              <td className="p-space-xs sm:p-space-sm">
                <Text as="span" variant="body-secondary">
                  {value}
                </Text>
              </td>
              <td className="p-space-xs sm:p-space-sm">
                <Text as="span" variant="caption" tone="secondary">
                  {scope}
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
