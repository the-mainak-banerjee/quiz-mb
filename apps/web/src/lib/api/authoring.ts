import { api } from './browser';
import type {
  ProjectDto,
  ProjectInput,
  QuizDto,
  QuizInput,
  QuestionInput,
  MediaDto,
  UploadDto,
} from '@quizmb/contracts';
import { MEDIA_LIMITS } from '@quizmb/contracts';
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
export async function uploadImage(
  quizId: string,
  purpose: 'QUIZ_COVER' | 'QUESTION_IMAGE',
  file: File,
): Promise<MediaDto> {
  if (
    !(MEDIA_LIMITS.mimeTypes as readonly string[]).includes(file.type) ||
    file.size > MEDIA_LIMITS.maxBytes ||
    !file.size
  )
    throw new ApiError('Choose a PNG, JPEG or WebP image up to 10 MB.');
  const ticket = await api.post<UploadDto>(
    '/api/media/upload-request',
    {
      purpose,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      resource: { quizId },
    },
    auth,
  );
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
  return api.post<MediaDto>(`/api/media/${ticket.mediaId}/complete`, {}, auth);
}
