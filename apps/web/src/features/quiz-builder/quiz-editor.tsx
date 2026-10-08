'use client';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  FileText,
  Lock,
  Plus,
  Trash2,
  Copy,
  Eye,
  Folder,
} from 'lucide-react';
import {
  AUTHORING_LIMITS,
  type ProjectDto,
  QUESTION_TYPE,
  EDIT_SCOPE,
  isEditLocked,
  QUIZ_STATUS,
  type QuestionDto,
  questionSchema,
  type QuizDto,
  type QuizStatus,
  quizSchema,
} from '@quizmb/contracts';
import { Button, Callout, Surface, Text, Badge } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { VisuallyHidden } from '@/components/visually-hidden';
import { Modal } from '@/components/ui/modal';
import { ConfirmDeleteModal } from '@/components/confirm-delete-modal';
import { apiError } from '@/lib/api/client';
import { authoringApi } from '@/lib/api/authoring';
import { cn } from '@/lib/utils';
import { PromptText } from '@/components/markdown-preview';
import { QuizForm, quizValues } from './quiz-form';
import { EDITOR_NOTICE_TEXT, type EditorNotice } from './editor-notice';
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

export { EDITOR_NOTICE, type EditorNotice } from './editor-notice';
function StatusBadge({ status }: { status: QuizStatus | undefined }) {
  switch (status) {
    case QUIZ_STATUS.PUBLISHED:
      return <Badge variant="scheduled" label="Published" />;
    case QUIZ_STATUS.LOBBY:
      return <Badge variant="scheduled" label="Lobby open" />;
    case QUIZ_STATUS.LIVE:
      return <Badge variant="live" />;
    case QUIZ_STATUS.COMPLETED:
      return <Badge variant="draft" label="Completed" />;
    default:
      return <Badge variant="draft" />;
  }
}
export function QuizEditor({
  project,
  initial,
  initialStep = 'details',
  readOnly = false,
  notice,
}: {
  project: Pick<ProjectDto, 'id' | 'name'>;
  initial?: QuizDto;
  initialStep?: Step;
  /** A live or completed quiz: everything is shown, nothing is editable. */
  readOnly?: boolean;
  /** A message carried over from the save that created the quiz. */
  notice?: EditorNotice | undefined;
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
  const [deletingQuiz, setDeletingQuiz] = useState(false);
  const [error, setError] = useState(notice ? EDITOR_NOTICE_TEXT[notice] : '');
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
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
  const status = quiz?.status ?? QUIZ_STATUS.DRAFT;
  // Questions are fixed once the lobby opens; details only once live.
  const questionsLocked =
    readOnly || isEditLocked(status, EDIT_SCOPE.QUESTIONS);
  // A published quiz keeps at least one question (the API enforces it).
  // The API enforces the question limit; the editor explains it up front.
  const atQuestionLimit =
    (quiz?.questions.length ?? 0) >= AUTHORING_LIMITS.questions;
  const keepsLastQuestion =
    status !== QUIZ_STATUS.DRAFT && (quiz?.questions.length ?? 0) <= 1;
  const steps = readOnly
    ? (['details', 'questions'] as const)
    : (['details', 'questions', 'review'] as const);
  return (
    <main className="mx-auto w-full max-w-content flex-1 space-y-space-lg px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      {quiz && quiz.status !== QUIZ_STATUS.DRAFT && (
        <NavigationItem
          href={APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id)}
          icon={<ArrowLeft size={18} aria-hidden="true" />}
          className="px-space-xs"
        >
          Back to manage quiz
        </NavigationItem>
      )}
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Text
          variant="caption"
          tone="secondary"
          className="flex items-center gap-space-xs"
        >
          <Folder size={16} />
          {project.name} / {quiz?.title || 'New quiz'}
        </Text>
        <StatusBadge status={quiz?.status} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <Text as="h1" variant="page-title">
          {step === 'details'
            ? 'Quiz basics'
            : step === 'questions'
              ? 'Questions'
              : 'Review & publish'}
        </Text>
        <div className="flex flex-wrap gap-space-xs">
          {quiz?.status === QUIZ_STATUS.DRAFT && !readOnly && (
            <Button
              variant="outline"
              icon={<Trash2 size={18} aria-hidden="true" />}
              className="text-danger"
              onClick={() => setDeletingQuiz(true)}
            >
              Delete quiz
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<Eye size={18} />}
            disabled={!quiz?.questions.length}
            onClick={() => setPreview(true)}
          >
            Preview saved quiz
          </Button>
        </div>
      </div>
      <nav
        aria-label="Quiz creation steps"
        className="flex flex-wrap gap-space-xs border-b border-border-surface pb-space-sm"
      >
        {steps.map((s, i) => (
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
      {questionsLocked && (
        <Callout icon={<Lock size={16} aria-hidden="true" />}>
          {!readOnly
            ? 'The lobby is open, so the questions are fixed. You can still edit the quiz details until the quiz starts.'
            : status === QUIZ_STATUS.LIVE
              ? 'This quiz is live, so it can no longer be edited.'
              : 'This quiz is completed, so it can no longer be edited. Its details and questions are shown as they were run.'}
        </Callout>
      )}
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
          readOnly={readOnly}
          leaving={leaving}
          {...(quiz ? { initial: quiz } : {})}
          onCancel={() => router.push(`/projects/${project.id}`)}
          onSaved={(q, next, coverNotice) => {
            if (!quiz) {
              // A new quiz continues on its own page; until it loads, the
              // form stays disabled rather than briefly editable again.
              setLeaving(true);
              router.replace(
                `/quizzes/${q.id}/edit?step=${next ? 'questions' : 'details'}${
                  coverNotice ? `&notice=${coverNotice}` : ''
                }`,
              );
              return;
            }
            setQuiz(q);
            setSaved(
              q.status === QUIZ_STATUS.DRAFT
                ? 'Quiz draft saved.'
                : 'Quiz saved.',
            );
            if (next) setStep('questions');
          }}
        />
      )}
      {step === 'questions' && quiz && (
        <div className="grid items-start gap-gutter lg:grid-cols-3">
          <aside className="space-y-space-md">
            <Surface className="space-y-space-md">
              <div className="flex items-center justify-between">
                <Text as="h2" variant="card-title">
                  Questions ({quiz.questions.length} of{' '}
                  {AUTHORING_LIMITS.questions})
                </Text>
                {!questionsLocked && (
                  <Button
                    variant="ghost"
                    className="px-space-xs"
                    icon={<Plus size={18} />}
                    disabled={busy || atQuestionLimit}
                    onClick={() => select(null)}
                  >
                    <VisuallyHidden>Add question</VisuallyHidden>
                  </Button>
                )}
              </div>
              <ol className="space-y-space-xs">
                {quiz.questions.map((q, index) => (
                  <li
                    key={q.id}
                    draggable={!busy && !questionsLocked}
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
                      <Text as="span" variant="label">
                        <PromptText text={q.text} compact />
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
                    {!questionsLocked && (
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
                          disabled={busy || keepsLastQuestion}
                          title={
                            keepsLastQuestion
                              ? 'A published quiz needs at least one question'
                              : undefined
                          }
                          onClick={() => confirm(() => setDeleting(q))}
                        >
                          <VisuallyHidden>
                            Delete question {index + 1}
                            {keepsLastQuestion &&
                              ' (a published quiz needs at least one question)'}
                          </VisuallyHidden>
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {!questionsLocked && (
                <Button
                  variant="secondary"
                  className="w-full"
                  icon={<Plus size={18} />}
                  disabled={busy || atQuestionLimit}
                  onClick={() => select(null)}
                >
                  Add question
                </Button>
              )}
              {!questionsLocked && atQuestionLimit && (
                <Text variant="caption" tone="secondary">
                  A quiz can have up to {AUTHORING_LIMITS.questions} questions.
                </Text>
              )}
            </Surface>
            {!questionsLocked && (
              <Text variant="caption" tone="secondary">
                Drag to reorder or use the move buttons. Authoring order does
                not determine the host’s live question sequence.
                {keepsLastQuestion &&
                  ' A published quiz keeps at least one question, so the last one cannot be deleted.'}
              </Text>
            )}
          </aside>
          <div className="min-w-0 space-y-space-lg lg:col-span-2">
            <QuestionForm
              key={`${active ?? 'new'}-${revision}`}
              ref={questionRef}
              quiz={quiz}
              readOnly={questionsLocked}
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
                // The next question (or the saved one) starts at the top.
                window.scrollTo({ top: 0, behavior: 'smooth' });
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
      {quiz && (
        <ConfirmDeleteModal
          open={deletingQuiz}
          onOpenChange={setDeletingQuiz}
          title="Delete draft quiz?"
          description={`“${quiz.title}” will be permanently deleted, including its questions and images. This can’t be undone.`}
          confirmLabel="Delete quiz"
          onConfirm={async () => {
            await authoringApi.deleteQuiz(quiz.id);
            // The quiz is gone, so unsaved edits are discarded silently.
            const back = () => {
              router.replace(APP_LINKS.WORKSPACE.PROJECT(project.id));
              router.refresh();
            };
            const form = (step === 'details' ? detailsRef : questionRef)
              .current;
            if (form) form.leave(back);
            else back();
          }}
        />
      )}
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
