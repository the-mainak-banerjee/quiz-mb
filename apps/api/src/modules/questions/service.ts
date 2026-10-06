import { MEDIA_PURPOSE, type QuestionInput } from '@quizmb/contracts';
import type { QuestionsRepository } from './repository.js';
import type { QuizzesService } from '../quizzes/service.js';
import type { MediaService } from '../media/service.js';
export class QuestionsService {
  constructor(
    private repository: QuestionsRepository,
    private quizzes: QuizzesService,
    private media: MediaService,
  ) {}
  private verifyImage(quizId: string, userId: string, input: QuestionInput) {
    return this.media.verifyPending(
      input.imageMediaId,
      quizId,
      userId,
      MEDIA_PURPOSE.QUESTION_IMAGE,
    );
  }
  async create(quizId: string, userId: string, input: QuestionInput) {
    const verified = await this.verifyImage(quizId, userId, input);
    await this.repository.save(quizId, userId, input, undefined, verified);
    return this.quizzes.get(quizId, userId);
  }
  async update(id: string, userId: string, input: QuestionInput) {
    const quizId = await this.repository.quizForQuestion(id, userId);
    const verified = await this.verifyImage(quizId, userId, input);
    await this.repository.save(quizId, userId, input, id, verified);
    return this.quizzes.get(quizId, userId);
  }
  async remove(id: string, userId: string) {
    const quizId = await this.repository.quizForQuestion(id, userId);
    await this.repository.remove(id, quizId, userId);
    return this.quizzes.get(quizId, userId);
  }
  async reorder(quizId: string, userId: string, ids: string[]) {
    await this.repository.reorder(quizId, userId, ids);
    return this.quizzes.get(quizId, userId);
  }
}
