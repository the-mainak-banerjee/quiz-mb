import type {
  AuthResultDto,
  PasswordResetRequestDto,
  PasswordResetTokenDto,
  VerificationChallengeDto,
} from '@quizmb/contracts';
import { api } from './browser';
import { API_ROUTES } from './routes';

/** Email verification and password reset (no session is needed for these). */
export const authApi = {
  verifyEmail: (ticket: string, code: string) =>
    api.post<AuthResultDto>(API_ROUTES.AUTH.VERIFY_EMAIL, { ticket, code }),
  resendVerification: (ticket: string) =>
    api.post<VerificationChallengeDto>(API_ROUTES.AUTH.RESEND_VERIFICATION, {
      ticket,
    }),
  requestPasswordReset: (email: string) =>
    api.post<PasswordResetRequestDto>(API_ROUTES.AUTH.PASSWORD_RESET, {
      email,
    }),
  verifyResetCode: (email: string, code: string) =>
    api.post<PasswordResetTokenDto>(API_ROUTES.AUTH.PASSWORD_RESET_VERIFY, {
      email,
      code,
    }),
  completePasswordReset: (resetToken: string, password: string) =>
    api.post<Record<string, never>>(API_ROUTES.AUTH.PASSWORD_RESET_COMPLETE, {
      resetToken,
      password,
    }),
};
