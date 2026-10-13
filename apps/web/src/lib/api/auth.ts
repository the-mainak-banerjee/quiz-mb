import type {
  AuthResultDto,
  PasswordResetRequestDto,
  PasswordResetTokenDto,
  VerificationChallengeDto,
} from '@quizmb/contracts';
import { api } from './browser';
import { API_ROUTES } from './routes';
import { COLD_START_TIMEOUT_MS } from './wake';

// Often the first requests of a visit, so the API may still be waking.
const patient = { timeoutMs: COLD_START_TIMEOUT_MS };

/** Email verification and password reset (no session is needed for these). */
export const authApi = {
  verifyEmail: (ticket: string, code: string) =>
    api.post<AuthResultDto>(
      API_ROUTES.AUTH.VERIFY_EMAIL,
      { ticket, code },
      patient,
    ),
  resendVerification: (ticket: string) =>
    api.post<VerificationChallengeDto>(
      API_ROUTES.AUTH.RESEND_VERIFICATION,
      { ticket },
      patient,
    ),
  requestPasswordReset: (email: string) =>
    api.post<PasswordResetRequestDto>(
      API_ROUTES.AUTH.PASSWORD_RESET,
      { email },
      patient,
    ),
  verifyResetCode: (email: string, code: string) =>
    api.post<PasswordResetTokenDto>(
      API_ROUTES.AUTH.PASSWORD_RESET_VERIFY,
      { email, code },
      patient,
    ),
  completePasswordReset: (resetToken: string, password: string) =>
    api.post<Record<string, never>>(
      API_ROUTES.AUTH.PASSWORD_RESET_COMPLETE,
      { resetToken, password },
      patient,
    ),
};
