import type { Logger } from 'pino';
import type { AuthRepository } from './repository.js';

/** Share of the provider's daily allowance that logs a warning. */
export const EMAIL_BUDGET_WARNING = 0.8;
/** Share at which non-essential sends (repeat resends) are refused. */
export const EMAIL_BUDGET_HARD_LIMIT = 0.9;

/** Midnight UTC today: the provider's daily allowance resets then. */
const startOfUtcDay = (now = new Date()) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

/**
 * The platform-wide daily email budget, counted from the sends recorded in
 * the database (so every API instance shares it). Below 80% of the allowance
 * everything is sent; from 80% a warning is logged; from 90% non-essential
 * sends are refused while the important auth emails (first verification
 * code, password reset) still go out. Each threshold is logged once a day
 * per instance; the log lines are what alerting hooks into.
 */
export class EmailBudget {
  private loggedDay = '';
  private logged = { warning: false, hardLimit: false };

  constructor(
    private repository: Pick<AuthRepository, 'sentSince'>,
    private dailyLimit: number,
    private logger?: Pick<Logger, 'warn' | 'error'>,
  ) {}

  /** Whether an email may be sent now; `essential` emails pass the 90% limit. */
  async allows(essential: boolean, now = new Date()) {
    const since = startOfUtcDay(now);
    const sent = await this.repository.sentSince(since);
    const day = since.toISOString().slice(0, 10);
    if (day !== this.loggedDay) {
      this.loggedDay = day;
      this.logged = { warning: false, hardLimit: false };
    }
    const context = { sent, dailyLimit: this.dailyLimit, day };
    if (sent >= this.dailyLimit * EMAIL_BUDGET_HARD_LIMIT) {
      if (!this.logged.hardLimit) {
        this.logged.hardLimit = true;
        this.logger?.error(
          context,
          'Email budget at 90%: refusing non-essential emails',
        );
      }
      return essential;
    }
    if (
      sent >= this.dailyLimit * EMAIL_BUDGET_WARNING &&
      !this.logged.warning
    ) {
      this.logged.warning = true;
      this.logger?.warn(context, 'Email budget at 80% of the daily allowance');
    }
    return true;
  }
}
