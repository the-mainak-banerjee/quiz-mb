import { UserRound, UsersRound } from 'lucide-react';
import { Text } from '@/components/ui';
import { cn } from '@/lib/utils';

export function RoleIndicator({
  role,
  expanded = false,
}: {
  role: 'host' | 'participant';
  expanded?: boolean;
}) {
  const Icon = role === 'host' ? UserRound : UsersRound;
  return (
    <Text
      as="span"
      variant="caption"
      className={cn(
        'inline-flex items-center gap-space-xs rounded-control px-badge-x py-badge-y',
        role === 'host'
          ? 'bg-status-live-surface text-status-live-text'
          : 'bg-status-scheduled-surface text-status-scheduled-text',
      )}
    >
      <Icon size={14} aria-hidden="true" />
      {role === 'host' ? (expanded ? "You're hosting" : 'Host') : 'Participant'}
    </Text>
  );
}
