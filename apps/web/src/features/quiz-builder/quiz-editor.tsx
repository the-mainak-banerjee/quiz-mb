'use client';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  FileText,
  Plus,
  Trash2,
  Copy,
  Eye,
  Folder,
} from 'lucide-react';
import {
  type ProjectDto,
  QUESTION_TYPE,
  type QuestionDto,
  questionSchema,
  type QuizDto,
  quizSchema,
} from '@quizmb/contracts';
import { Button, Surface, Text, Badge } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { Modal } from '@/components/ui/modal';
import { apiError } from '@/lib/api/client';
import { authoringApi } from '@/lib/api/authoring';
import { cn } from '@/lib/utils';
import { QuizForm, quizValues } from './quiz-form';
import {
  QuestionForm,
  questionValues,
  QUESTION_LABELS,
  type QuestionFormHandle,
} from './question-form';
import { QuizOption } from './quiz-option';
import { ReviewPublishPanel } from '@/features/publishing/review-publish-panel';
const MarkdownPreview = dynamic(() => import('@/components/markdown-preview'));
type Step = 'details' | 'questions' | 'review';
export function QuizEditor({
  project,
  initial,
  initialStep = 'details',
}: {
  project: Pick<ProjectDto, 'id' | 'name'>;
  initial?: QuizDto;
  initialStep?: Step;
}) {
  const router = useRouter();
  const [quiz, setQuiz] = useState(initial);
  const [step, setStep] = useState<Step>(initial ? initialStep : 'details');
  const [active, setActive] = useState<string | null>(
    initial?.questions[0]?.id ?? null,
  );
  const [draft, setDraft] = useState<QuestionDto | undefined>();
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const [deleting, setDeleting] = useState<QuestionDto | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState('');
  const [dragged, setDragged] = useState<string | null>(null);
  const detailsRef = useRef<QuestionFormHandle>(null);
  const questionRef = useRef<QuestionFormHandle>(null);
  const current = quiz?.questions.find((q) => q.id === active);
  function confirm(action: () => void) {
    const ref =
      step === 'details'
        ? detailsRef
        : step === 'questions'
          ? questionRef
          : null;
    if (ref?.current) ref.current.confirm(action);
    else action();
  }
  function select(id: string | null) {
    confirm(() => {
      setActive(id);
      setDraft(undefined);
      setRevision((r) => r + 1);
    });
  }
  async function reorder(ids: string[]) {
    if (!quiz) return;
    const previous = quiz;
    const questions = new Map(
      quiz.questions.map((question) => [question.id, question]),
    );
    setBusy(true);
    setError('');
    setQuiz({
      ...quiz,
      questions: ids.map((id, position) => ({
        ...questions.get(id)!,
        position,
      })),
    });
    try {
      setQuiz(await authoringApi.reorder(quiz.id, ids));
      setSaved('Question order saved.');
    } catch (e) {
      setQuiz(previous);
      setError(apiError(e).message);
    } finally {
      setBusy(false);
    }
  }
  const valid =
    !!quiz &&
    quizSchema.safeParse(quizValues(quiz)).success &&
    quiz.questions.length > 0 &&
    quiz.questions.every(
      (q) => questionSchema.safeParse(questionValues(q)).success,
    );
  return (
    <main className="mx-auto w-full max-w-content flex-1 space-y-space-lg px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Text
          variant="caption"
          tone="secondary"
          className="flex items-center gap-space-xs"
        >
          <Folder size={16} />
          {project.name} / {quiz?.title || 'New quiz'}
        </Text>
        <Badge variant="draft" label="Draft" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Text as="h1" variant="page-title">
          {step === 'details'
            ? 'Quiz basics'
            : step === 'questions'
              ? 'Questions'
              : 'Review & publish'}
        </Text>
        <Button
          variant="secondary"
          icon={<Eye size={18} />}
          disabled={!quiz?.questions.length}
          onClick={() => setPreview(true)}
        >
          Preview saved quiz
        </Button>
      </div>
      <nav
        aria-label="Quiz creation steps"
        className="flex flex-wrap gap-space-xs border-b border-border-surface pb-space-sm"
      >
        {(['details', 'questions', 'review'] as const).map((s, i) => (
          <Button
            key={s}
            variant={step === s ? 'primary' : 'ghost'}
            disabled={!quiz && s !== 'details'}
            aria-current={step === s ? 'step' : undefined}
            onClick={() =>
              confirm(() => {
                setStep(s);
                setDraft(undefined);
                setRevision((r) => r + 1);
              })
            }
          >
            {i + 1}.{' '}
            {s === 'details'
              ? 'Details'
              : s === 'questions'
                ? 'Questions'
                : 'Review'}
          </Button>
        ))}
      </nav>
      {saved && (
        <Text role="status" variant="caption" className="text-accent">
          {saved}
        </Text>
      )}
      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
      {step === 'details' && (
        <QuizForm
          key={quiz?.updatedAt ?? 'new'}
          ref={detailsRef}
          projectId={project.id}
          {...(quiz ? { initial: quiz } : {})}
          onCancel={() => router.push(`/projects/${project.id}`)}
          onSaved={(q, next) => {
            setQuiz(q);
            setSaved('Quiz draft saved.');
            if (!quiz)
              router.replace(
                `/quizzes/${q.id}/edit?step=${next ? 'questions' : 'details'}`,
              );
            else if (next) setStep('questions');
          }}
        />
      )}
      {step === 'questions' && quiz && (
        <div className="grid items-start gap-gutter lg:grid-cols-3">
          <aside className="space-y-space-md">
            <Surface className="space-y-space-md">
              <div className="flex items-center justify-between">
                <Text as="h2" variant="card-title">
                  Questions ({quiz.questions.length})
                </Text>
                <Button
                  variant="ghost"
                  className="px-space-xs"
                  icon={<Plus size={18} />}
                  disabled={busy}
                  onClick={() => select(null)}
                >
                  <VisuallyHidden>Add question</VisuallyHidden>
                </Button>
              </div>
              <ol className="space-y-space-xs">
                {quiz.questions.map((q, index) => (
                  <li
                    key={q.id}
                    draggable={!busy}
                    onDragStart={() => setDragged(q.id)}
                    onDragEnd={() => setDragged(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragged && dragged !== q.id) {
                        const ids = quiz.questions
                          .map((x) => x.id)
                          .filter((id) => id !== dragged);
                        ids.splice(index, 0, dragged);
                        confirm(() => void reorder(ids));
                      }
                      setDragged(null);
                    }}
                    className={cn(
                      'rounded-control border border-border-surface bg-surface-low p-space-sm',
                      active === q.id &&
                        'border-accent bg-action-secondary shadow-card',
                    )}
                  >
                    <Button
                      variant="ghost"
                      className="h-auto min-h-0 w-full justify-start whitespace-normal p-0 text-left hover:bg-transparent"
                      icon={
                        <Text
                          as="span"
                          variant="caption"
                          className={cn(
                            'flex size-space-lg shrink-0 items-center justify-center rounded-pill border border-border-surface bg-surface text-accent',
                            active === q.id &&
                              'border-action-primary bg-action-primary text-text-inverse',
                          )}
                        >
                          {index + 1}
                        </Text>
                      }
                      disabled={busy}
                      onClick={() => select(q.id)}
                    >
                      <Text as="span" variant="label" className="line-clamp-2">
                        {q.text}
                      </Text>
                    </Button>
                    <Text
                      variant="caption"
                      tone="secondary"
                      className="mt-space-xs pl-space-xl"
                    >
                      {QUESTION_LABELS[q.type]} ·{' '}
                      {q.durationOverrideSeconds ??
                        quiz.defaultQuestionDurationSeconds}
                      s
                    </Text>
                    <div className="mt-space-sm flex items-center justify-end gap-space-xs border-t border-border-surface pt-space-xs">
                      {[
                        { label: 'Move up', Icon: ArrowUp, offset: -1 },
                        { label: 'Move down', Icon: ArrowDown, offset: 1 },
                      ].map(({ label, Icon, offset }) => (
                        <Button
                          key={label}
                          variant="ghost"
                          className="px-space-xs"
                          icon={<Icon size={16} />}
                          disabled={
                            busy ||
                            index + offset < 0 ||
                            index + offset >= quiz.questions.length
                          }
                          onClick={() =>
                            confirm(() => {
                              const ids = quiz.questions.map((x) => x.id);
                              [ids[index], ids[index + offset]] = [
                                ids[index + offset]!,
                                ids[index]!,
                              ];
                              void reorder(ids);
                            })
                          }
                        >
                          <VisuallyHidden>
                            {label} question {index + 1}
                          </VisuallyHidden>
                        </Button>
                      ))}
                      <Button
                        variant="ghost"
                        className="px-space-xs"
                        icon={<Copy size={16} />}
                        disabled={busy}
                        onClick={() =>
                          confirm(() => {
                            setActive(null);
                            setDraft({ ...q, id: '' });
                            setRevision((r) => r + 1);
                          })
                        }
                      >
                        <VisuallyHidden>
                          Duplicate question {index + 1}
                        </VisuallyHidden>
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-space-xs"
                        icon={<Trash2 size={16} />}
                        disabled={busy}
                        onClick={() => confirm(() => setDeleting(q))}
                      >
                        <VisuallyHidden>
                          Delete question {index + 1}
                        </VisuallyHidden>
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
              <Button
                variant="secondary"
                className="w-full"
                icon={<Plus size={18} />}
                disabled={busy}
                onClick={() => select(null)}
              >
                Add question
              </Button>
            </Surface>
            <Text variant="caption" tone="secondary">
              Drag to reorder or use the move buttons. Authoring order does not
              determine the host’s live question sequence.
            </Text>
          </aside>
          <div className="min-w-0 space-y-space-lg lg:col-span-2">
            <QuestionForm
              key={`${active ?? 'new'}-${revision}`}
              ref={questionRef}
              quiz={quiz}
              questionNumber={
                current
                  ? quiz.questions.indexOf(current) + 1
                  : quiz.questions.length + 1
              }
              questionCount={
                current ? quiz.questions.length : quiz.questions.length + 1
              }
              {...(current || draft ? { initial: current || draft! } : {})}
              onReview={() => setStep('review')}
              onSaved={(q, addNext) => {
                const previousIds = new Set(quiz.questions.map((x) => x.id));
                const id =
                  active ??
                  q.questions.find((x) => !previousIds.has(x.id))?.id ??
                  null;
                setQuiz(q);
                setActive(addNext ? null : id);
                setDraft(undefined);
                setRevision((r) => r + 1);
                setSaved('Question saved.');
              }}
            />
          </div>
        </div>
      )}
      {step === 'review' && quiz && (
        <ReviewPublishPanel
          quiz={quiz}
          project={project}
          valid={valid}
          onBack={() => setStep('questions')}
        />
      )}
      <Modal
        open={preview}
        onOpenChange={setPreview}
        title="Saved quiz preview"
        description="Preview saved question content. This is not a live session."
      >
        <div className="space-y-space-lg">
          {quiz?.questions.map((q, i) => (
            <section key={q.id} className="space-y-space-sm">
              <Text as="h3" variant="card-title">
                Question {i + 1}
              </Text>
              <MarkdownPreview text={q.text} />
              {q.image && (
                <Image
                  unoptimized
                  width={800}
                  height={450}
                  src={q.image.url}
                  alt={q.image.fileName}
                  className="max-h-64 w-full object-contain"
                />
              )}
              {q.type !== QUESTION_TYPE.DESCRIPTIVE &&
                q.options.map((option, index) => (
                  <QuizOption
                    key={index}
                    type={
                      q.type === QUESTION_TYPE.SINGLE_CHOICE
                        ? QUESTION_TYPE.SINGLE_CHOICE
                        : QUESTION_TYPE.MULTIPLE_CHOICE
                    }
                    index={index}
                    isCorrect={option.isCorrect}
                  >
                    <Text className="wrap-break-word">{option.text}</Text>
                  </QuizOption>
                ))}
              {q.type === QUESTION_TYPE.DESCRIPTIVE && (
                <div className="flex min-h-40 flex-col items-center justify-center gap-space-sm rounded-control border border-dashed border-border-control bg-surface-low p-space-lg text-center">
                  <FileText
                    className="text-accent"
                    size={28}
                    aria-hidden="true"
                  />
                  <Text variant="label">Written response area</Text>
                  <Text variant="body-secondary" tone="secondary">
                    Participants will compose an ungraded response here.
                  </Text>
                </div>
              )}
            </section>
          ))}
        </div>
      </Modal>
      <Modal
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
        title="Delete question?"
        description="This removes the saved question from your draft."
      >
        <div className="flex justify-end gap-space-xs">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={async () => {
              if (!deleting) return;
              setBusy(true);
              try {
                const q = await authoringApi.deleteQuestion(deleting.id);
                setQuiz(q);
                setActive(q.questions[0]?.id ?? null);
                setRevision((r) => r + 1);
                setDeleting(null);
                setSaved('Question deleted.');
              } catch (e) {
                setError(apiError(e).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Delete question
          </Button>
        </div>
      </Modal>
    </main>
  );
}
