'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Avatar,
  Badge,
  SegmentedControl,
  Surface,
  Text,
} from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { EmptyStateIllustration } from '@/components/empty-state-illustration';
import { cn } from '@/lib/utils';
import type { LiveParticipant } from './types';

type Filter = 'all' | 'connected' | 'offline';

/** Host lobby roster of registered participants and their connection state. */
export function ParticipantRoster({
  participants,
  registered,
  connected,
  rosterHref,
}: {
  participants: LiveParticipant[];
  registered: number;
  connected: number;
  rosterHref: string;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const visible = participants.filter(
    (participant) =>
      filter === 'all' || participant.connected === (filter === 'connected'),
  );

  return (
    <Surface as="section" className="space-y-space-md lg:col-span-8">
      <div className="flex flex-col justify-between gap-space-xs border-b border-border-surface pb-space-xs sm:flex-row sm:items-center">
        <div className="flex items-center gap-space-xs">
          <Text as="h2" variant="section-heading">
            Participant roster
          </Text>
          <Badge variant="draft" label={`${registered} registered`} />
        </div>
        <SegmentedControl
          label="Filter participants"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: 'all', label: `All (${registered})` },
            { value: 'connected', label: `Connected (${connected})` },
            { value: 'offline', label: `Offline (${registered - connected})` },
          ]}
        />
      </div>

      <ul className="divide-y divide-border-surface">
        {visible.map((participant) => (
          <li
            key={participant.id}
            className={cn(
              'flex items-center justify-between gap-space-sm rounded-control px-space-xs py-3 hover:bg-surface-low',
              !participant.connected && 'opacity-75',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                name={participant.name}
                size="large"
                decorative
                tone={participant.connected ? 'accent' : 'muted'}
              />
              <div className="min-w-0">
                <Text
                  variant="card-title"
                  tone={participant.connected ? 'primary' : 'secondary'}
                  className="truncate font-medium"
                >
                  {participant.name}
                </Text>
                <Text variant="caption" tone="secondary">
                  {participant.detail}
                </Text>
              </div>
            </div>
            <Badge
              variant={participant.connected ? 'live' : 'draft'}
              label={participant.connected ? 'Connected' : 'Offline'}
              dot
            />
          </li>
        ))}
        {visible.length === 0 && (
          <li className="flex flex-col items-center gap-space-xs py-space-md text-center">
            {filter !== 'offline' && (
              <EmptyStateIllustration kind="participant" />
            )}
            <Text variant="body-secondary" tone="secondary">
              No participants match this filter.
            </Text>
          </li>
        )}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <Text variant="caption" tone="secondary">
          Showing {visible.length} of {registered} participants
        </Text>
        <NavigationItem
          href={rosterHref}
          icon={<ArrowRight size={14} aria-hidden="true" />}
          iconPosition="right"
          className="min-h-0 px-space-xs py-1 text-caption text-accent"
        >
          View complete roster
        </NavigationItem>
      </div>
    </Surface>
  );
}
