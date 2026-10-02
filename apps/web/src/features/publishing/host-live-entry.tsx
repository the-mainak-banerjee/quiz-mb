'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChartNoAxesCombined, MonitorPlay, Play } from 'lucide-react';
import { Button, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { apiError } from '@/lib/api/client';
import { liveApi } from '@/lib/api/live';
import type { PublishedQuizViewModel } from './types';
import { ERROR_CODE, QUIZ_STATUS } from '@quizmb/contracts';

/**
 * Host entry to the live session. The planned time never gates this; the API
 * decides whether a lobby can open (one live quiz per host).
 */
export function HostLiveEntry({
  quizId,
  status,
}: {
  quizId: string;
  status: PublishedQuizViewModel['status'];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (status === QUIZ_STATUS.LOBBY || status === QUIZ_STATUS.LIVE)
    return (
      <NavigationItem
        href={APP_LINKS.WORKSPACE.LIVE_QUIZ(quizId)}
        icon={<MonitorPlay size={18} aria-hidden="true" />}
        className="ds-primary-motion bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
      >
        Open host console
      </NavigationItem>
    );

  if (status === QUIZ_STATUS.COMPLETED)
    return (
      <NavigationItem
        href={APP_LINKS.WORKSPACE.QUIZ_RESULTS(quizId)}
        icon={<ChartNoAxesCombined size={18} aria-hidden="true" />}
        className="ds-primary-motion bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
      >
        View results
      </NavigationItem>
    );

  async function openLobby() {
    setPending(true);
    setError('');
    try {
      await liveApi.openLobby(quizId);
      router.push(APP_LINKS.WORKSPACE.LIVE_QUIZ(quizId));
    } catch (cause) {
      const problem = apiError(cause);
      if (problem.code === ERROR_CODE.ACTIVE_SESSION_EXISTS)
        router.push(APP_LINKS.WORKSPACE.LIVE_CONFLICT(quizId));
      else setError(problem.message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-space-xs sm:items-end">
      <Button
        icon={<Play size={18} aria-hidden="true" />}
        disabled={pending}
        onClick={() => void openLobby()}
      >
        {pending ? 'Opening lobby…' : 'Open live lobby'}
      </Button>
      {error && (
        <Text role="alert" variant="caption" className="text-danger">
          {error}
        </Text>
      )}
    </div>
  );
}
