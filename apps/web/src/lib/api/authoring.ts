import { api } from './browser';
import {
  MEDIA_LIMITS,
  type MediaDto,
  type MediaPurpose,
  type ProjectDto,
  type ProjectInput,
  type QuestionInput,
  type QuizCreatedDto,
  type QuizDto,
  type QuizInput,
  type UploadDto,
  type UploadFileInput,
} from '@quizmb/contracts';
import { ApiError } from './client';
const auth = { authenticated: true };
export const authoringApi = {
  saveProject: (data: ProjectInput, id?: string) =>
    id
      ? api.patch<ProjectDto>(`/api/projects/${id}`, data, auth)
      : api.post<ProjectDto>('/api/projects', data, auth),
  saveQuiz: (projectId: string, data: QuizInput, id?: string) =>
    id
      ? api.patch<QuizDto>(`/api/quizzes/${id}`, data, auth)
      : api.post<QuizDto>(`/api/projects/${projectId}/quizzes`, data, auth),
  /** Creates a quiz; with `cover`, the response also carries its upload ticket. */
  createQuiz: (projectId: string, data: QuizInput, cover?: File) =>
    api.post<QuizCreatedDto>(
      `/api/projects/${projectId}/quizzes`,
      cover ? { ...data, cover: fileDetails(cover) } : data,
      auth,
    ),
  saveQuestion: (quizId: string, data: QuestionInput, id?: string) =>
    id
      ? api.patch<QuizDto>(`/api/questions/${id}`, data, auth)
      : api.post<QuizDto>(`/api/quizzes/${quizId}/questions`, data, auth),
  deleteQuestion: (id: string) =>
    api.delete<QuizDto>(`/api/questions/${id}`, auth),
  reorder: (id: string, questionIds: string[]) =>
    api.post<QuizDto>(
      `/api/quizzes/${id}/questions/reorder`,
      { questionIds },
      auth,
    ),
};
// Binary uploads are separate from our JSON factory: signed URL, no app cookies,
// no broad storage keys and no automatic retries of a non-idempotent upload.
/** Why this file cannot be uploaded as an image, or null when it can. */
export function imageProblem(file: File) {
  return !(MEDIA_LIMITS.mimeTypes as readonly string[]).includes(file.type) ||
    file.size > MEDIA_LIMITS.maxBytes ||
    !file.size
    ? 'Choose a PNG, JPEG or WebP image up to 10 MB.'
    : null;
}

function fileDetails(file: File): UploadFileInput {
  return {
    fileName: file.name,
    mimeType: file.type as UploadFileInput['mimeType'],
    sizeBytes: file.size,
  };
}

/**
 * Uploads an image for a quiz. The returned media is still pending: it
 * shows the local file, and the server checks the upload when the quiz or
 * question is saved with it.
 */
export async function uploadImage(
  quizId: string,
  purpose: MediaPurpose,
  file: File,
): Promise<MediaDto> {
  const problem = imageProblem(file);
  if (problem) throw new ApiError(problem);
  const ticket = await api.post<UploadDto>(
    '/api/media/upload-request',
    { purpose, ...fileDetails(file), resource: { quizId } },
    auth,
  );
  await putUpload(ticket, file);
  return {
    id: ticket.mediaId,
    fileName: file.name,
    url: URL.createObjectURL(file),
  };
}

/** Sends the file to the signed storage URL from an upload ticket. */
export async function putUpload(ticket: UploadDto, file: File) {
  const url = new URL(ticket.upload.url);
  if (
    url.protocol !== 'https:' ||
    !url.pathname.includes('/storage/v1/object/upload/sign/')
  )
    throw new ApiError('Invalid upload destination.');
  const response = await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok)
    throw new ApiError('Image upload failed. Please try again.');
}
