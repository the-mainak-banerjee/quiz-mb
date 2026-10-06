'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { ConfirmDeleteModal } from '@/components/confirm-delete-modal';
import { VisuallyHidden } from '@/components/visually-hidden';
import { authoringApi } from '@/lib/api/authoring';

/** A quiz card's delete control for a draft, with its confirmation. */
export function DeleteDraftQuizButton({
  quiz,
  onDeleted,
}: {
  quiz: { id: string; title: string };
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        icon={<Trash2 size={16} aria-hidden="true" />}
        className="size-control shrink-0 px-0 text-danger"
        onClick={() => setOpen(true)}
      >
        <VisuallyHidden>Delete {quiz.title}</VisuallyHidden>
      </Button>
      <ConfirmDeleteModal
        open={open}
        onOpenChange={setOpen}
        title="Delete draft quiz?"
        description={`“${quiz.title}” will be permanently deleted, including its questions and images. This can’t be undone.`}
        confirmLabel="Delete quiz"
        onConfirm={async () => {
          await authoringApi.deleteQuiz(quiz.id);
          setOpen(false);
          onDeleted();
        }}
      />
    </>
  );
}
