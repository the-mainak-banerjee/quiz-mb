// Development-only auth screen previews (server-safe list).
export const AUTH_PREVIEW_SCREENS = [
  { slug: 'verify-email', title: 'Verify email' },
  {
    slug: 'verify-email-invalid',
    title: 'Verify email — invalid or expired code',
  },
  { slug: 'verify-email-ended', title: 'Verify email — session ended' },
  { slug: 'forgot-password', title: 'Forgot password' },
  { slug: 'reset-code', title: 'Verify password reset code' },
  { slug: 'reset-code-invalid', title: 'Verify reset code — incorrect code' },
  { slug: 'new-password', title: 'Create new password' },
  { slug: 'reset-done', title: 'Password reset success' },
] as const;
export type AuthPreviewSlug = (typeof AUTH_PREVIEW_SCREENS)[number]['slug'];
