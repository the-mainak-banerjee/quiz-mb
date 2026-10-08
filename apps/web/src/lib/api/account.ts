import { api } from './browser';
import { API_ROUTES } from './routes';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  ProfileInput,
} from '@quizmb/contracts';
import type { CurrentUser } from '@/lib/auth/session';

const auth = { authenticated: true };

/** Settings: profile, password and account deletion. */
export const accountApi = {
  updateProfile: (input: ProfileInput) =>
    api.patch<CurrentUser>(API_ROUTES.AUTH.ME, input, auth),
  /** Signs out every other device; this one stays signed in. */
  changePassword: (input: ChangePasswordInput) =>
    api.post<Record<string, never>>(
      API_ROUTES.AUTH.CHANGE_PASSWORD,
      input,
      auth,
    ),
  /** Deletes the account and clears this browser's sign-in cookies. */
  deleteAccount: (input: DeleteAccountInput) =>
    api.post<void>(API_ROUTES.AUTH.DELETE_ACCOUNT, input, auth),
};
