import { randomUUID } from 'node:crypto';
import {
  questionSchema,
  type PublicQuizDto,
  type QuizCreateInput,
  type QuizCreatedDto,
  type QuizInput,
  type QuizDto,
  ERROR_CODE,
  MEDIA_PURPOSE,
  QUIZ_STATUS,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import type {
  PublicQuizRow,
  QuizzesRepository,
  QuizRow,
} from './repository.js';
import type { MediaService } from '../media/service.js';
import type { ProjectsService } from '../projects/service.js';
export class QuizzesService {
  constructor(
    private repository: QuizzesRepository,
    private media: MediaService,
    private projects: ProjectsService,
  ) {}
  async dto(q: QuizRow): Promise<QuizDto> {
    return {
      id: q.id,
      projectId: q.projectId,
      projectName: q.project.name,
      publicId: q.publicId,
      title: q.title,
      description: q.description,
      registrationLimit: q.registrationLimit,
      registrationCount: q._count.registrations,
      defaultQuestionDurationSeconds: q.defaultQuestionDurationSeconds,
      allowLateJoin: q.allowLateJoin,
      coverMediaId: q.coverMediaId,
      plannedStartAt: q.plannedStartAt?.toISOString() ?? null,
      status: q.status,
      updatedAt: q.updatedAt.toISOString(),
      cover: await this.media.dto(q.cover),
      questions: await Promise.all(
        q.questions.map(async (item) => ({
          id: item.id,
          type: item.type,
          text: item.text,
          position: item.position,
          durationOverrideSeconds: item.durationOverrideSeconds,
          imageMediaId: item.imageMediaId,
          image: await this.media.dto(item.image),
          options: item.options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      ),
    };
  }
  async get(id: string, userId: string) {
    const q = await this.repository.get(id, userId);
    if (!q) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    return this.dto(q);
  }
  async publicDto(q: PublicQuizRow): Promise<PublicQuizDto> {
    if (!q.plannedStartAt)
      throw new ApiError(
        500,
        ERROR_CODE.INVALID_QUIZ_STATE,
        'Quiz schedule is missing.',
      );
    const registrationCount = q._count.registrations;
    return {
      id: q.id,
      publicId: q.publicId,
      title: q.title,
      description: q.description,
      status: q.status as PublicQuizDto['status'],
      plannedStartAt: q.plannedStartAt.toISOString(),
      registrationLimit: q.registrationLimit,
      registrationCount,
      isFull: registrationCount >= q.registrationLimit,
      project: q.project,
      host: q.creator,
      cover: await this.media.dto(q.cover),
      questionCount: q._count.questions ?? 0,
    };
  }
  async getPublic(publicId: string) {
    const quiz = await this.repository.publicById(publicId);
    if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    return this.publicDto(quiz);
  }
  async list(projectId: string, userId: string, cursor?: string) {
    await this.projects.get(projectId, userId);
    const rows = await this.repository.list(projectId, userId, cursor);
    return {
      data: rows.slice(0, 25).map((q) => ({
        id: q.id,
        projectId: q.projectId,
        title: q.title,
        status: q.status,
        updatedAt: q.updatedAt.toISOString(),
        questionCount: q._count.questions,
      })),
      meta: { nextCursor: rows.length > 25 ? rows[24]!.id : null },
    };
  }
  async create(
    projectId: string,
    userId: string,
    input: QuizCreateInput,
  ): Promise<QuizCreatedDto> {
    const { cover, ...quiz } = input;
    // The id is chosen here so the cover's upload URL can be signed while
    // the quiz is created; an unused signed URL is harmless. Without
    // storage the quiz is still created and the cover reports failure.
    const id = randomUUID();
    const asset =
      cover && this.media.available
        ? this.media.pendingAsset(userId, id, MEDIA_PURPOSE.QUIZ_COVER, cover)
        : undefined;
    const signing = asset ? this.media.ticket(asset).catch(() => null) : null;
    const row = await this.repository.create(
      projectId,
      userId,
      quiz,
      id,
      asset,
    );
    const [dto, coverUpload] = await Promise.all([this.dto(row), signing]);
    return { ...dto, coverUpload };
  }
  async update(id: string, userId: string, input: QuizInput) {
    const verified = await this.media.verifyPending(
      input.coverMediaId,
      id,
      userId,
      MEDIA_PURPOSE.QUIZ_COVER,
    );
    return this.dto(await this.repository.update(id, userId, input, verified));
  }
  async remove(id: string, userId: string) {
    await this.media.removeFiles(await this.repository.remove(id, userId));
  }
  async publish(id: string, userId: string) {
    const quiz = await this.repository.get(id, userId);
    if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    if (quiz.status === QUIZ_STATUS.PUBLISHED) return this.dto(quiz);
    if (quiz.status !== QUIZ_STATUS.DRAFT)
      throw new ApiError(
        409,
        ERROR_CODE.QUIZ_LOCKED,
        'This quiz cannot be published.',
      );
    if (!quiz.plannedStartAt)
      throw new ApiError(
        422,
        ERROR_CODE.VALIDATION_ERROR,
        'Choose a planned date and time before publishing.',
        { plannedStartAt: 'Choose a planned date and time before publishing.' },
      );
    if (!quiz.questions.length)
      throw new ApiError(
        422,
        ERROR_CODE.VALIDATION_ERROR,
        'Add at least one valid question before publishing.',
        { questions: 'Add at least one valid question before publishing.' },
      );
    for (const question of quiz.questions) {
      const result = questionSchema.safeParse({
        type: question.type,
        text: question.text,
        imageMediaId: question.imageMediaId,
        durationOverrideSeconds: question.durationOverrideSeconds,
        options: question.options.map((option) => ({
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      });
      if (!result.success)
        throw new ApiError(
          422,
          ERROR_CODE.VALIDATION_ERROR,
          'Fix invalid questions before publishing.',
          { questions: 'Fix invalid questions before publishing.' },
        );
    }
    return this.dto(await this.repository.publish(id, userId));
  }
}
