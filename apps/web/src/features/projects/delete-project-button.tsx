'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { ConfirmDeleteModal } from '@/components/confirm-delete-modal';
import { APP_LINKS } from '@/config/navigation';
import { authoringApi } from '@/lib/api/authoring';
import { pluralize } from '@/lib/utils';

/**
 * Projects can be deleted only while all their quizzes are drafts; the
 * drafts are deleted with them. Otherwise the modal explains why not.
 */
export function DeleteProjectButton({
  project,
  draftCount,
  blocked,
}: {
  project: { id: string; name: string };
  draftCount: number;
  /** The project has published, live or completed quizzes. */
  blocked: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        icon={<Trash2 size={17} aria-hidden="true" />}
        className="shrink-0 whitespace-nowrap text-danger"
        onClick={() => setOpen(true)}
      >
        Delete project
      </Button>
      {blocked ? (
        <Modal
          open={open}
          onOpenChange={setOpen}
          title="This project can’t be deleted"
          description="It has published, live or completed quizzes. Only projects whose quizzes are all drafts can be deleted, so participants never lose a quiz they registered for or its results."
        >
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </Modal>
      ) : (
        <ConfirmDeleteModal
          open={open}
          onOpenChange={setOpen}
          title="Delete project?"
          description={
            draftCount
              ? `“${project.name}” and its ${draftCount} draft ${pluralize(draftCount, 'quiz', 'quizzes')} will be permanently deleted, including their questions and images. This can’t be undone.`
              : `“${project.name}” will be permanently deleted. This can’t be undone.`
          }
          confirmLabel="Delete project"
          onConfirm={async () => {
            await authoringApi.deleteProject(project.id);
            router.replace(APP_LINKS.WORKSPACE.PROJECTS);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
