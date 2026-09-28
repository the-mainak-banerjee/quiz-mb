import type { QuestionInput } from '@quizmb/contracts';
import type { QuestionsRepository } from './repository.js';
import type { QuizzesService } from '../quizzes/service.js';
export class QuestionsService {
  constructor(
    private repository: QuestionsRepository,
    private quizzes: QuizzesService,
  ) {}
  async create(quizId: string, userId: string, input: QuestionInput) {
    await this.repository.save(quizId, userId, input);
    return this.quizzes.get(quizId, userId);
  }
  async update(id: string, userId: string, input: QuestionInput) {
    const quizId = await this.repository.quizForQuestion(id, userId);
    await this.repository.save(quizId, userId, input, id);
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
