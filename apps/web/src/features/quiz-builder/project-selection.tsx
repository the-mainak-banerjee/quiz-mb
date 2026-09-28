'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Check,
  Folder,
  FolderPlus,
  History,
  Layers3,
  Plus,
  Sparkles,
} from 'lucide-react';
import type { ProjectDto } from '@quizmb/contracts';
import { Button, Surface, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { ProjectForm } from '@/features/projects/project-form';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { cn } from '@/lib/utils';

export function ProjectSelection({
  initialProjects,
}: {
  initialProjects: ProjectDto[];
}) {
  const router = useRouter();
  const form = useRef<{ close: () => void }>(null);
  const [projects, setProjects] = useState(initialProjects);
  const [selected, setSelected] = useState('');
  const [create, setCreate] = useState(false);
  const [more, setMore] = useState(initialProjects.length === 25);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  return (
    <main className="mx-auto w-full max-w-content flex-1 space-y-space-xl px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <div className="flex items-center justify-between">
        <Text variant="caption" tone="secondary">
          Create Quiz / Choose Project
        </Text>
        <Button variant="danger" onClick={() => router.push('/dashboard')}>
          Cancel
        </Button>
      </div>
      <div
        className={cn('space-y-space-xs', !projects.length && 'text-center')}
      >
        <Text variant="label" className="text-accent">
          STEP 01 / CHOOSE PROJECT
        </Text>
        <Text as="h1" variant="page-title">
          {projects.length ? 'Select a project' : 'Create your first project'}
        </Text>
        <Text tone="secondary">
          Every quiz belongs to a project. Keep related quizzes organized in one
          place.
        </Text>
      </div>
      {projects.length ? (
        <div
          role="group"
          aria-label="Choose a project"
          className="grid gap-gutter md:grid-cols-2 lg:grid-cols-3"
        >
          {projects.map((project) => (
            <Surface
              key={project.id}
              className={cn(
                'flex flex-col gap-space-md',
                selected === project.id &&
                  'border-accent bg-action-secondary shadow-card',
              )}
            >
              <div className="flex justify-between text-accent">
                <Folder size={24} />
                {selected === project.id && <Check size={24} />}
              </div>
              <Text as="h2" variant="card-title">
                {project.name}
              </Text>
              <Text
                variant="body-secondary"
                tone="secondary"
                className="flex-1"
              >
                {project.description || 'Your project workspace.'}
              </Text>
              <Text variant="caption" tone="secondary">
                {project.quizCount} quizzes
              </Text>
              <Button
                variant="secondary"
                aria-pressed={selected === project.id}
                onClick={() => setSelected(project.id)}
              >
                {selected === project.id ? 'Selected' : 'Select project'}
              </Button>
            </Surface>
          ))}
          <Surface className="flex flex-col items-start justify-center gap-space-md border-dashed bg-surface-low">
            <FolderPlus className="text-accent" size={32} />
            <Text as="h2" variant="card-title">
              Create new project
            </Text>
            <Text tone="secondary">A dedicated home for related quizzes.</Text>
            <Button variant="secondary" onClick={() => setCreate(true)}>
              Create project
            </Button>
          </Surface>
        </div>
      ) : (
        <Surface className="mx-auto max-w-prose space-y-space-lg text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-card bg-action-secondary text-accent">
            <FolderPlus size={32} />
          </div>
          <div className="space-y-space-xs">
            <Text as="h2" variant="section-heading">
              Create your first project
            </Text>
            <Text tone="secondary">
              Projects give every quiz a shared home, keeping related work and
              session history together.
            </Text>
          </div>
          <Button icon={<Plus size={18} />} onClick={() => setCreate(true)}>
            Create project
          </Button>
          <div className="grid gap-space-sm text-left md:grid-cols-3">
            {[
              {
                title: 'Simple organization',
                description: 'Group related quizzes in one focused workspace.',
                Icon: Layers3,
              },
              {
                title: 'Shared context',
                description: 'Keep your team aligned around the same topic.',
                Icon: Sparkles,
              },
              {
                title: 'Session history',
                description: 'Find previous quiz sessions where they belong.',
                Icon: History,
              },
            ].map(({ title, description, Icon }) => (
              <div
                key={title}
                className="space-y-space-xs rounded-control bg-surface-low p-space-sm"
              >
                <Icon className="text-accent" size={20} />
                <Text variant="label">{title}</Text>
                <Text variant="caption" tone="secondary">
                  {description}
                </Text>
              </div>
            ))}
          </div>
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
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const rows = await api.get<ProjectDto[]>(
                `/api/projects?cursor=${projects.at(-1)!.id}`,
                { authenticated: true },
              );
              setProjects((p) => [...p, ...rows]);
              setMore(rows.length === 25);
            } catch (e) {
              setError(apiError(e).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          Load more projects
        </Button>
      )}
      {projects.length > 0 && (
        <div className="flex justify-end border-t border-border-surface pt-space-md">
          <Button
            icon={<ArrowRight size={18} />}
            iconPosition="right"
            disabled={!selected}
            onClick={() => router.push(`/quizzes/new?projectId=${selected}`)}
          >
            Continue to Quiz Basics
          </Button>
        </div>
      )}
      <Modal
        open={create}
        onOpenChange={(open) => {
          if (open) setCreate(true);
          else form.current?.close();
        }}
        title="New project"
        description="Create a shared home for this quiz and future sessions."
      >
        <ProjectForm
          ref={form}
          cancelVariant="secondary"
          onCancel={() => setCreate(false)}
          onSaved={(project) => {
            setProjects((p) => [project, ...p]);
            setSelected(project.id);
            setCreate(false);
          }}
        />
      </Modal>
    </main>
  );
}
