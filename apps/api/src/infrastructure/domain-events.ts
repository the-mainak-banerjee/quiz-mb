import { EventEmitter } from 'node:events';

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
export class DomainEvents extends EventEmitter<{
  registrationChanged: [RegistrationChange];
}> {}
