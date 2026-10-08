import { ERROR_CODE } from '@quizmb/contracts';
import { ApiError } from '../http/api-error.js';

/** What the protective switch can pause (security design 1.11). */
export const PAUSABLE_FEATURE = {
  SIGNUP: 'signup',
  QUIZ_CREATE: 'quiz_create',
  UPLOAD: 'upload',
} as const;
export type PausableFeature =
  (typeof PAUSABLE_FEATURE)[keyof typeof PAUSABLE_FEATURE];

const MESSAGE: Record<PausableFeature, string> = {
  signup: 'New sign-ups are paused for now. Please try again later.',
  quiz_create:
    'Creating new quizzes is paused for now. You can keep editing your existing quizzes.',
  upload:
    'Image uploads are paused for now. You can keep editing text; please try adding images later.',
};

/** The comma-separated PAUSED_FEATURES setting, as feature names. */
export function parsePausedFeatures(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * The protective switch: PAUSED_FEATURES (for example `signup,upload`)
 * pauses new signups, quiz creation or uploads before capacity runs out.
 * Changing it restarts the API; everything else keeps working. Read on
 * every check, so tests can set it.
 */
export function requireActive(
  feature: PausableFeature,
  env: Record<string, string | undefined> = process.env,
) {
  if (parsePausedFeatures(env.PAUSED_FEATURES).includes(feature))
    throw new ApiError(503, ERROR_CODE.FEATURE_PAUSED, MESSAGE[feature]);
}
