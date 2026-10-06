import { ShieldAlert } from 'lucide-react';
import { OTP_RULES } from '@quizmb/contracts';
import { Callout } from '@/components/ui';

const minutes = (seconds: number) => seconds / 60;

/** The limits on emailed codes, stated up front so a lockout is no surprise. */
export function CodeLimits({ reset = false }: { reset?: boolean }) {
  return (
    <Callout icon={<ShieldAlert size={16} aria-hidden="true" />}>
      <ul className="space-y-1">
        <li>
          Each code works for {minutes(OTP_RULES.ttlSeconds)} minutes and allows{' '}
          {OTP_RULES.maxAttempts} tries.
        </li>
        <li>
          You can ask for a new code every {OTP_RULES.resendCooldownSeconds}{' '}
          seconds
          {reset ? `, up to ${OTP_RULES.resetRequestsPerHour} per hour.` : '.'}
        </li>
        <li>
          After {OTP_RULES.checksPerWindow} attempts within{' '}
          {minutes(OTP_RULES.checkWindowSeconds)} minutes, you&apos;ll need to
          wait {minutes(OTP_RULES.checkWindowSeconds)} minutes before trying
          again.
        </li>
      </ul>
    </Callout>
  );
}

/** When a resend refused for its cooldown may be retried. */
export function cooldownEnd(details: Record<string, string>) {
  const seconds = Number(details.retryAfterSeconds);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(Date.now() + seconds * 1000).toISOString()
    : null;
}
