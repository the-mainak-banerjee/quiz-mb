import { SCORING } from './constants.js';

/**
 * Points for one answer: zero unless correct; a correct answer earns
 * MAX_POINTS when instant and falls linearly with response time to
 * MAX_POINTS × (1 − SPEED_WEIGHT) at the deadline (1000 → 400).
 * Speed is part of the score, not a tiebreaker.
 */
export function pointsFor(
  isCorrect: boolean | null,
  responseTimeMs: number,
  durationMs: number,
) {
  if (!isCorrect || durationMs <= 0) return 0;
  const elapsed = Math.min(Math.max(responseTimeMs / durationMs, 0), 1);
  return Math.round(SCORING.MAX_POINTS * (1 - SCORING.SPEED_WEIGHT * elapsed));
}
