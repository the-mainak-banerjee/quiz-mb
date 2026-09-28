'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { ProjectDto, QuizSummaryDto } from '@quizmb/contracts';
import { Button, Surface, Text } from '@/components/ui';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
export function ProjectList({ initial }: { initial: ProjectDto[] }) {
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length === 25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-space-md">
      <div className="grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Surface key={p.id} className="space-y-space-sm">
            <Text as="h2" variant="card-title">
              <Link className="ds-focus" href={`/projects/${p.id}`}>
                {p.name}
              </Link>
            </Text>
            <Text tone="secondary">{p.description}</Text>
            <Text variant="caption">{p.quizCount} quizzes</Text>
            <Link
              className="ds-focus text-label text-accent underline"
              href={`/projects/${p.id}`}
            >
              Open project
            </Link>
          </Surface>
        ))}
      </div>
      {!items.length && (
        <Surface>
          <Text as="h2" variant="section-heading">
            No projects yet
          </Text>
          <Text tone="secondary">
            Create your first project to organize your quizzes.
          </Text>
        </Surface>
      )}
      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
      {more && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await api.get<ProjectDto[]>(
                `/api/projects?cursor=${items.at(-1)!.id}`,
                { authenticated: true },
              );
              setItems((p) => [...p, ...rows]);
              setMore(rows.length === 25);
            } catch (e) {
              setError(apiError(e).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more
        </Button>
      )}
    </div>
  );
}
export function ProjectQuizzes({
  projectId,
  initial,
}: {
  projectId: string;
  initial: QuizSummaryDto[];
}) {
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length === 25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <div className="space-y-space-md">
      <div className="grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
        {items.map((q) => (
          <Surface key={q.id} className="space-y-space-sm">
            <Text variant="caption" tone="secondary">
              {q.status}
            </Text>
            <Text as="h2" variant="card-title">
              {q.title}
            </Text>
            <Text variant="body-secondary">{q.questionCount} questions</Text>
            <Link
              className="ds-focus text-label text-accent underline"
              href={`/quizzes/${q.id}/edit`}
            >
              Edit quiz
            </Link>
          </Surface>
        ))}
      </div>
      {!items.length && (
        <Surface>
          <Text>No quizzes in this project yet.</Text>
        </Surface>
      )}
      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
      {more && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await api.get<QuizSummaryDto[]>(
                `/api/projects/${projectId}/quizzes?cursor=${items.at(-1)!.id}`,
                { authenticated: true },
              );
              setItems((p) => [...p, ...rows]);
              setMore(rows.length === 25);
            } catch (e) {
              setError(apiError(e).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more quizzes
        </Button>
      )}
    </div>
  );
}
