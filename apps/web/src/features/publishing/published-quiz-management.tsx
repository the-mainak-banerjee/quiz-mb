'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Copy,
  Download,
  FileDown,
  Info,
  Link2,
  Pencil,
  Play,
} from 'lucide-react';
import { Badge, Button, Surface, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import type { PublishedQuizViewModel } from './mock-data';
import { downloadQuizPoster, QuizQrCode } from './quiz-qr-code';
import { QuizCover } from './quiz-cover';
import { pluralize } from '@/lib/utils';

const START_WINDOW_MS = 15 * 60 * 1000;

type Participant = {
  id: string;
  initials: string;
  name: string;
  registeredAt: string;
  detail: string;
};

function ParticipantRoster({
  participants,
}: {
  participants: readonly Participant[];
}) {
  return (
    <ul className="divide-y divide-border-surface">
      {participants.map((participant) => (
        <li
          key={participant.id}
          className="flex items-center gap-space-sm py-space-sm first:pt-0 last:pb-0"
        >
          <div className="flex size-control shrink-0 items-center justify-center rounded-pill bg-action-secondary text-label text-accent">
            {participant.initials}
          </div>
          <div className="min-w-0 flex-1">
            <Text variant="label" className="wrap-break-word">
              {participant.name}
            </Text>
            <Text variant="caption" tone="secondary">
              {participant.detail}
            </Text>
          </div>
          <Badge variant="scheduled" label="Verified" />
        </li>
      ))}
    </ul>
  );
}

function csvCell(value: string) {
  const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}

function exportParticipantsCsv(
  quizTitle: string,
  participants: readonly Participant[],
) {
  const rows = [
    ['Participant', 'Registered at', 'Status'],
    ...participants.map((participant) => [
      participant.name,
      new Date(participant.registeredAt).toISOString(),
      'Verified',
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const blobUrl = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  );
  const download = document.createElement('a');
  download.href = blobUrl;
  download.download = `${
    quizTitle
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'quiz'
  }-participants.csv`;
  document.body.append(download);
  download.click();
  download.remove();
  URL.revokeObjectURL(blobUrl);
}

export function PublishedQuizManagement({
  quiz,
  participants,
}: {
  quiz: PublishedQuizViewModel;
  participants: readonly Participant[];
}) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const [now, setNow] = useState<number | null>(null);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const participantPreview = participants.slice(0, 5);
  const remaining = Math.max(quiz.registrationLimit - quiz.registeredCount, 0);
  const percent = Math.min(
    (quiz.registeredCount / quiz.registrationLimit) * 100,
    100,
  );
  const planned = new Date(quiz.plannedStartAt);
  const canStart =
    now !== null &&
    Number.isFinite(planned.getTime()) &&
    planned.getTime() - now <= START_WINDOW_MS;

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const timer = window.setInterval(updateNow, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function copyPublicUrl() {
    await navigator.clipboard?.writeText(quiz.publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function downloadPoster() {
    setDownloading(true);
    setDownloadError('');
    try {
      await downloadQuizPoster(quiz, `${quiz.slug}-event-poster.png`);
    } catch (cause) {
      setDownloadError(
        cause instanceof Error
          ? cause.message
          : 'The event poster could not be downloaded.',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-content flex-1 space-y-space-lg overflow-x-clip px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-space-xs"
      >
        <Link
          href={APP_LINKS.WORKSPACE.PROJECTS}
          className="ds-focus rounded-control text-caption text-text-secondary hover:text-text-primary"
        >
          Projects
        </Link>
        <Text as="span" variant="caption" tone="secondary">
          /
        </Text>
        <Text as="span" variant="caption" tone="secondary">
          {quiz.project}
        </Text>
        <Text as="span" variant="caption" tone="secondary">
          /
        </Text>
        <Text as="span" variant="caption" className="min-w-0 wrap-break-word">
          {quiz.title}
        </Text>
      </nav>

      <Surface className="flex flex-col items-start justify-between gap-space-md bg-surface-low sm:flex-row sm:items-center">
        <div className="flex items-start gap-space-sm">
          <div className="flex shrink-0 size-control items-center justify-center rounded-control bg-surface-high text-accent">
            <Info size={20} aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-space-xs">
              <Text variant="label">Manual start required</Text>
              <Badge variant="draft" label="Host control" />
            </div>
            <Text variant="body-secondary" tone="secondary">
              The planned time never starts the quiz automatically. The start
              control becomes available 15 minutes before the event.
            </Text>
          </div>
        </div>
        <Button
          icon={<Play size={18} aria-hidden="true" />}
          disabled={!canStart}
          title={
            canStart
              ? 'Start the session'
              : 'Available 15 minutes before the scheduled time'
          }
        >
          Start the session
        </Button>
      </Surface>

      <section className="w-full">
        <div className="w-full min-w-0 space-y-space-xs">
          <div className="flex flex-col gap-space-sm lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-space-xs">
              <div className="flex flex-wrap items-center gap-space-xs">
                <Badge variant="scheduled" label="Published" />
                <Text variant="caption" tone="secondary">
                  Interactive live session
                </Text>
              </div>
              <Text as="h1" variant="page-title" className="wrap-break-word">
                {quiz.title}
              </Text>
              <Text tone="secondary">{quiz.description}</Text>
            </div>
            <div className="flex shrink-0 flex-wrap items-start gap-space-xs lg:self-start">
              <NavigationItem
                href={APP_LINKS.WORKSPACE.EDIT_QUIZ(quiz.id)}
                icon={<Pencil size={18} aria-hidden="true" />}
                className="h-control min-h-0 shrink-0 border border-border-surface bg-surface text-text-primary hover:border-accent hover:bg-canvas"
              >
                Edit details
              </NavigationItem>
              <Link
                href={APP_LINKS.PUBLIC_QUIZ(quiz.slug)}
                target="_blank"
                className="ds-focus ds-control-motion inline-flex h-control items-center justify-center gap-space-xs rounded-control bg-action-secondary px-control-x text-label text-accent hover:bg-action-secondary-hover"
              >
                View public page
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <QuizCover cover={quiz.cover} title={quiz.title} />
          <div className="flex flex-wrap items-center gap-space-sm rounded-card border border-border-surface bg-surface-low p-space-sm">
            <div className="flex size-control-large flex-col items-center justify-center rounded-control bg-surface shadow-card">
              <Text as="span" variant="caption" className="text-accent">
                {quiz.dateTileMonth}
              </Text>
              <Text as="span" variant="label">
                {quiz.dateTileDay}
              </Text>
            </div>
            <div>
              <Text variant="caption" tone="secondary">
                SCHEDULED EVENT TIME
              </Text>
              <Text variant="label">
                {quiz.date} · {quiz.time}
              </Text>
            </div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-gutter-lg lg:grid-cols-12">
        <div className="min-w-0 space-y-space-md lg:col-span-7">
          <Surface className="min-w-0 space-y-space-md">
            <div className="flex items-center gap-space-xs">
              <Link2 className="text-accent" size={20} aria-hidden="true" />
              <div>
                <Text as="h2" variant="section-heading">
                  Public quiz access
                </Text>
                <Text variant="body-secondary" tone="secondary">
                  Share this link to let participants reserve a seat.
                </Text>
              </div>
            </div>
            <div className="flex flex-col gap-space-xs rounded-control bg-surface-low p-space-xs sm:flex-row sm:items-center">
              <Text
                variant="body-secondary"
                className="min-w-0 flex-1 truncate px-space-xs"
              >
                {quiz.publicUrl}
              </Text>
              <Button
                variant="secondary"
                icon={
                  copied ? (
                    <Check size={18} aria-hidden="true" />
                  ) : (
                    <Copy size={18} aria-hidden="true" />
                  )
                }
                onClick={() => void copyPublicUrl()}
              >
                {copied ? 'Copied' : 'Copy link'}
              </Button>
            </div>
          </Surface>

          <Surface className="space-y-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-xs">
              <div>
                <Text as="h2" variant="section-heading">
                  Capacity & registration
                </Text>
                <Text variant="body-secondary" tone="secondary">
                  {Math.round(percent)}% filled · {remaining}{' '}
                  {pluralize(remaining, 'seat')} remaining
                </Text>
              </div>
              <Badge
                variant="scheduled"
                label={`${quiz.registeredCount} registered`}
              />
            </div>
            <div className="h-space-xs overflow-hidden rounded-pill bg-surface-muted">
              <div
                className="h-full rounded-pill bg-accent"
                style={{
                  width: `${percent}%`,
                }}
              />
            </div>
            <dl className="grid grid-cols-1 gap-space-xs text-center sm:grid-cols-3">
              {[
                ['Registered', String(quiz.registeredCount)],
                ['Remaining', String(remaining)],
                ['Total cap', String(quiz.registrationLimit)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-control bg-surface-low p-space-sm"
                >
                  <dt className="text-caption text-text-secondary">{label}</dt>
                  <dd className="text-card-title text-text-primary">{value}</dd>
                </div>
              ))}
            </dl>
          </Surface>

          <Surface className="space-y-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <Text as="h2" variant="section-heading">
                  Registered participants
                </Text>
                <Text variant="body-secondary" tone="secondary">
                  Live roster of confirmed attendees
                </Text>
              </div>
              <Button
                variant="ghost"
                onClick={() => setParticipantsOpen(true)}
                disabled={participants.length === 0}
              >
                View all ({participants.length})
              </Button>
            </div>
            {participantPreview.length > 0 ? (
              <ParticipantRoster participants={participantPreview} />
            ) : (
              <Text tone="secondary">No participants have registered yet.</Text>
            )}
            <div className="flex flex-wrap items-center justify-between gap-space-xs border-t border-border-surface pt-space-sm">
              <Text variant="caption" tone="secondary">
                Registration changes appear in this roster automatically.
              </Text>
              <Button
                variant="outline"
                icon={<FileDown size={18} aria-hidden="true" />}
                disabled={participants.length === 0}
                onClick={() => exportParticipantsCsv(quiz.title, participants)}
              >
                Export CSV
              </Button>
            </div>
          </Surface>
        </div>

        <aside className="min-w-0 space-y-space-md lg:sticky lg:top-space-xl lg:col-span-5">
          <Surface className="min-w-0 space-y-space-md text-center">
            <div>
              <Text as="h2" variant="section-heading">
                Scan & join via mobile
              </Text>
              <Text variant="body-secondary" tone="secondary">
                Download a shareable event image with the QR code and session
                details.
              </Text>
            </div>
            <div className="mx-auto flex aspect-square w-full max-w-xs items-center justify-center rounded-card border border-border-surface bg-surface-low">
              <QuizQrCode url={quiz.publicUrl} />
            </div>
            <Text variant="caption" tone="secondary" className="break-all">
              {quiz.publicUrl}
            </Text>
            <Button
              variant="secondary"
              icon={<Download size={18} aria-hidden="true" />}
              disabled={downloading}
              onClick={() => void downloadPoster()}
              className="w-full"
            >
              {downloading ? 'Preparing image…' : 'Download event poster'}
            </Button>
            {downloadError && (
              <Text role="alert" variant="caption" className="text-danger">
                {downloadError}
              </Text>
            )}
          </Surface>
          <Surface className="flex items-start gap-space-sm bg-surface-low">
            <CalendarDays className="shrink-0 text-accent" aria-hidden="true" />
            <div>
              <Text variant="label">Calendar sync ready</Text>
              <Text variant="caption" tone="secondary">
                The planned date is visible to participants but remains
                host-controlled.
              </Text>
            </div>
          </Surface>
        </aside>
      </div>
      <Modal
        open={participantsOpen}
        onOpenChange={setParticipantsOpen}
        title="Registered participants"
        description={`${participants.length} confirmed ${pluralize(participants.length, 'participant')} for ${quiz.title}.`}
      >
        <div className="space-y-space-md">
          <div className="max-h-[min(55dvh,32rem)] overflow-y-auto overscroll-contain pr-space-xs">
            <ParticipantRoster participants={participants} />
          </div>
          <div className="flex justify-end border-t border-border-surface pt-space-sm">
            <Button
              variant="outline"
              icon={<FileDown size={18} aria-hidden="true" />}
              onClick={() => exportParticipantsCsv(quiz.title, participants)}
            >
              Export CSV
            </Button>
          </div>
        </div>
      </Modal>
    </main>
  );
}
