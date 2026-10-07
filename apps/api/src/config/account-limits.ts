import { ACCOUNT_LIMITS } from '@quizmb/contracts';

/**
 * The plan-shaped limits that apply to an account. Before payments every
 * account has the same fixed set; Phase 2 looks up the account's plan here,
 * so features never change when plans arrive.
 */
export function limitsFor(userId: string): Promise<typeof ACCOUNT_LIMITS> {
  void userId;
  return Promise.resolve(ACCOUNT_LIMITS);
}
