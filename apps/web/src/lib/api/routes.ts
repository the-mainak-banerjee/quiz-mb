export const API_PREFIX = '/api' as const;

export const API_ROUTES = {
  HEALTH: `${API_PREFIX}/health`,
  AUTH: {
    LOGIN: `${API_PREFIX}/auth/login`,
    SIGNUP: `${API_PREFIX}/auth/signup`,
    REFRESH: `${API_PREFIX}/auth/refresh`,
    LOGOUT: `${API_PREFIX}/auth/logout`,
    VERIFY_EMAIL: `${API_PREFIX}/auth/verify-email`,
    RESEND_VERIFICATION: `${API_PREFIX}/auth/verify-email/resend`,
    PASSWORD_RESET: `${API_PREFIX}/auth/password-reset`,
    PASSWORD_RESET_VERIFY: `${API_PREFIX}/auth/password-reset/verify`,
    PASSWORD_RESET_COMPLETE: `${API_PREFIX}/auth/password-reset/complete`,
    ME: `${API_PREFIX}/me`,
    CHANGE_PASSWORD: `${API_PREFIX}/me/password`,
    DELETE_ACCOUNT: `${API_PREFIX}/me/delete`,
  },
  PROJECTS: {
    LIST: `${API_PREFIX}/projects`,
    DETAIL: (projectId: string) => `${API_PREFIX}/projects/${projectId}`,
    QUIZZES: (projectId: string) =>
      `${API_PREFIX}/projects/${projectId}/quizzes`,
  },
  QUIZZES: {
    DETAIL: (quizId: string) => `${API_PREFIX}/quizzes/${quizId}`,
    REGISTRATIONS: (quizId: string) =>
      `${API_PREFIX}/quizzes/${quizId}/registrations`,
    ALL_REGISTRATIONS: (quizId: string) =>
      `${API_PREFIX}/quizzes/${quizId}/registrations/all`,
    REGISTRATION: (quizId: string) =>
      `${API_PREFIX}/quizzes/${quizId}/registration`,
    LIVE_SESSION: (quizId: string) =>
      `${API_PREFIX}/quizzes/${quizId}/live-session`,
    WATCH_TICKET: (quizId: string) =>
      `${API_PREFIX}/quizzes/${quizId}/watch-ticket`,
    RESULTS: (quizId: string, offset = 0) =>
      `${API_PREFIX}/quizzes/${quizId}/results?offset=${offset}`,
  },
  LIVE_SESSIONS: {
    ACTIVE: `${API_PREFIX}/live-sessions/active`,
    SOCKET_TICKET: (liveSessionId: string) =>
      `${API_PREFIX}/live-sessions/${liveSessionId}/socket-ticket`,
    MY_RESULT: (liveSessionId: string) =>
      `${API_PREFIX}/live-sessions/${liveSessionId}/my-result`,
  },
  PUBLIC_QUIZ: (publicId: string) =>
    `${API_PREFIX}/public/quizzes/${encodeURIComponent(publicId)}`,
  DASHBOARD: {
    HOST: `${API_PREFIX}/dashboard/host`,
    PARTICIPANT: `${API_PREFIX}/dashboard/participant`,
  },
} as const;
