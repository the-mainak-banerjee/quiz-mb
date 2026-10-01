import { EventEmitter } from 'node:events';
import type { PublicQuizStatus } from '@quizmb/contracts';

export type RegistrationChange = {
  quizId: string;
  userId: string;
  registered: boolean;
};

/**
 * In-process notifications between modules (e.g. registrations → live
 * sessions) so one module never calls another's transport directly.
 * Single-instance only: with several API instances these would need Redis
 * pub/sub alongside the Socket.IO Redis adapter.
 */
export type QuizStatusChange = {
  quizId: string;
  status: PublicQuizStatus;
};

/** Names of the in-process events carried by `DomainEvents`. */
export const DOMAIN_EVENT = {
  registrationChanged: 'registrationChanged',
  quizStatusChanged: 'quizStatusChanged',
} as const;

export class DomainEvents extends EventEmitter<{
  [DOMAIN_EVENT.registrationChanged]: [RegistrationChange];
  [DOMAIN_EVENT.quizStatusChanged]: [QuizStatusChange];
}> {}
