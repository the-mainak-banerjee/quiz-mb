import { z } from 'zod';

// Central authoring limits: design text counters plus protective API bounds.
export const AUTHORING_LIMITS = {
  projectName: 60,
  projectDescription: 240,
  quizTitle: 90,
  description: 4000,
  prompt: 10000,
  option: 1000,
  options: 20,
  questions: 200,
  duration: 3600,
  participants: 10000,
} as const;
export const MEDIA_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
};
export const projectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a project name.')
      .max(AUTHORING_LIMITS.projectName),
    description: z.string().trim().max(AUTHORING_LIMITS.projectDescription),
  })
  .strict();
export const quizSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a quiz title.')
      .max(AUTHORING_LIMITS.quizTitle),
    description: z.string().trim().max(AUTHORING_LIMITS.description),
    registrationLimit: z
      .number()
      .int()
      .min(1)
      .max(AUTHORING_LIMITS.participants),
    defaultQuestionDurationSeconds: z
      .number()
      .int()
      .min(1)
      .max(AUTHORING_LIMITS.duration),
    allowLateJoin: z.boolean(),
    coverMediaId: z.uuid().nullable(),
    // Participant-facing metadata only. Saving a date never publishes or starts a quiz.
    plannedStartAt: z.iso.datetime({
      offset: true,
      error: 'Choose a planned date and time.',
    }),
  })
  .strict();
export const questionSchema = z
  .object({
    type: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DESCRIPTIVE']),
    text: z
      .string()
      .trim()
      .min(1, 'Enter a question prompt.')
      .max(AUTHORING_LIMITS.prompt),
    imageMediaId: z.uuid().nullable(),
    durationOverrideSeconds: z
      .number()
      .int()
      .min(1)
      .max(AUTHORING_LIMITS.duration)
      .nullable(),
    options: z
      .array(
        z
          .object({
            text: z
              .string()
              .trim()
              .min(1, 'Enter an answer option.')
              .max(AUTHORING_LIMITS.option),
            isCorrect: z.boolean(),
          })
          .strict(),
      )
      .max(AUTHORING_LIMITS.options),
  })
  .strict()
  .superRefine((value, ctx) => {
    const correct = value.options.filter((o) => o.isCorrect).length;
    if (value.type === 'DESCRIPTIVE') {
      if (value.options.length)
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'Descriptive questions have no answer options.',
        });
    } else {
      if (value.options.length < 2)
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'Add at least two options.',
        });
      if (
        (value.type === 'SINGLE_CHOICE' && correct !== 1) ||
        (value.type === 'MULTIPLE_CHOICE' && correct < 1)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message:
            value.type === 'SINGLE_CHOICE'
              ? 'Choose exactly one correct answer.'
              : 'Choose at least one correct answer.',
        });
    }
  });
export const reorderSchema = z
  .object({ questionIds: z.array(z.uuid()).max(AUTHORING_LIMITS.questions) })
  .strict();
export const uploadSchema = z
  .object({
    purpose: z.enum(['QUIZ_COVER', 'QUESTION_IMAGE']),
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(MEDIA_LIMITS.mimeTypes),
    sizeBytes: z.number().int().min(1).max(MEDIA_LIMITS.maxBytes),
    resource: z.object({ quizId: z.uuid() }).strict(),
  })
  .strict();
export type ProjectInput = z.infer<typeof projectSchema>;
export type QuizInput = z.infer<typeof quizSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type ProjectDto = ProjectInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  quizCount: number;
};
export type MediaDto = { id: string; url: string; fileName: string };
export type QuestionDto = QuestionInput & {
  id: string;
  position: number;
  image: MediaDto | null;
};
export type QuizDto = Omit<QuizInput, 'plannedStartAt'> & {
  id: string;
  projectId: string;
  projectName: string;
  publicId: string;
  plannedStartAt: string | null;
  status: string;
  updatedAt: string;
  cover: MediaDto | null;
  questions: QuestionDto[];
};
export type QuizSummaryDto = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  updatedAt: string;
  questionCount: number;
};
export type UploadDto = {
  mediaId: string;
  upload: { url: string; token: string; path: string };
};

export type PublicQuizDto = {
  id: string;
  publicId: string;
  title: string;
  description: string;
  status: 'PUBLISHED' | 'LOBBY' | 'LIVE' | 'COMPLETED';
  plannedStartAt: string;
  registrationLimit: number;
  registrationCount: number;
  isFull: boolean;
  project: { id: string; name: string };
  host: { id: string; name: string };
  cover: MediaDto | null;
  questionCount: number;
};

export type RegistrationDto = {
  registered: boolean;
  registeredAt: string | null;
  registrationCount: number;
};

export type HostRegistrationDto = {
  id: string;
  userId: string;
  name: string;
  registeredAt: string;
};

export type ParticipantDashboardDto = {
  upcoming: PublicQuizDto[];
  live: PublicQuizDto[];
  history: PublicQuizDto[];
};

export type HostDashboardQuizDto = {
  id: string;
  publicId: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  status: string;
  plannedStartAt: string | null;
  updatedAt: string;
  questionCount: number;
  registrationCount: number;
};

export type HostDashboardDto = {
  projects: Array<{
    id: string;
    title: string;
    quizzes: number;
    members: number;
  }>;
  quizzes: HostDashboardQuizDto[];
};
