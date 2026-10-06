// Compile-time guard: the shared contract constants must list exactly the
// values of the matching Prisma enums. Adding or renaming an enum value in
// schema.prisma (or in @quizmb/contracts) fails `tsc` until both agree.
import type { PrismaClient } from '@quizmb/database';
import type {
  AnswerStatus,
  AskedQuestionStatus,
  LiveSessionState,
  MediaPurpose,
  MediaStatus,
  OtpPurpose,
  QuestionType,
  QuizStatus,
  RegistrationStatus,
} from '@quizmb/contracts';

type Row<Delegate extends { findFirstOrThrow: (...args: never[]) => unknown }> =
  Awaited<ReturnType<Delegate['findFirstOrThrow']>>;
type Field<R, K extends string> = R extends Record<K, infer V> ? V : never;
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
// Resolves only when the check passes; a mismatch is a type error.
type Assert<T extends true> = T;

export type EnumSyncChecks = [
  Assert<
    Same<OtpPurpose, Field<Row<PrismaClient['verificationCode']>, 'purpose'>>
  >,
  Assert<Same<QuizStatus, Field<Row<PrismaClient['quiz']>, 'status'>>>,
  Assert<
    Same<LiveSessionState, Field<Row<PrismaClient['liveQuizSession']>, 'state'>>
  >,
  Assert<Same<QuestionType, Field<Row<PrismaClient['question']>, 'type'>>>,
  Assert<Same<MediaPurpose, Field<Row<PrismaClient['mediaAsset']>, 'purpose'>>>,
  Assert<Same<MediaStatus, Field<Row<PrismaClient['mediaAsset']>, 'status'>>>,
  Assert<
    Same<
      AskedQuestionStatus,
      Field<Row<PrismaClient['askedQuestion']>, 'status'>
    >
  >,
  Assert<
    Same<AnswerStatus, Field<Row<PrismaClient['answerSubmission']>, 'status'>>
  >,
  Assert<
    Same<
      RegistrationStatus,
      Field<Row<PrismaClient['quizRegistration']>, 'status'>
    >
  >,
];
