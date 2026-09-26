export const APP_LINKS = {
  HOME: '/',
  AUTH: {
    LOGIN: '/login',
    SIGNUP: '/signup',
    SESSION: '/session',
    FORGOT_PASSWORD: '/forgot-password',
  },
  WORKSPACE: {
    DASHBOARD: '/dashboard',
    PROJECTS: '/projects',
    QUIZZES: '/quizzes',
    HISTORY: '/history',
  },
  ACCOUNT: {
    SETTINGS: '/settings',
    PLANS: '/plans',
  },
  FOOTER: {
    DOCUMENTATION: '/documentation',
    PRIVACY: '/privacy',
    HELP: '/help',
  },
  LEGAL: {
    TERMS: '/terms',
    PRIVACY: '/privacy',
  },
} as const;

export const MAIN_NAVIGATION = [
  { label: 'Dashboard', href: APP_LINKS.WORKSPACE.DASHBOARD },
  { label: 'Projects', href: APP_LINKS.WORKSPACE.PROJECTS },
  { label: 'Quizzes', href: APP_LINKS.WORKSPACE.QUIZZES },
  { label: 'History', href: APP_LINKS.WORKSPACE.HISTORY },
] as const;

export const FOOTER_NAVIGATION = [
  { label: 'Documentation', href: APP_LINKS.FOOTER.DOCUMENTATION },
  { label: 'Privacy & Terms', href: APP_LINKS.FOOTER.PRIVACY },
  { label: 'Help Center', href: APP_LINKS.FOOTER.HELP },
] as const;
