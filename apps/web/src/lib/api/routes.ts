export const API_PREFIX = '/api' as const;

export const API_ROUTES = {
  HEALTH: `${API_PREFIX}/health`,
  AUTH: {
    LOGIN: `${API_PREFIX}/auth/login`,
    SIGNUP: `${API_PREFIX}/auth/signup`,
    REFRESH: `${API_PREFIX}/auth/refresh`,
    LOGOUT: `${API_PREFIX}/auth/logout`,
    ME: `${API_PREFIX}/me`,
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
  },
  PUBLIC_QUIZ: (publicId: string) =>
    `${API_PREFIX}/public/quizzes/${encodeURIComponent(publicId)}`,
  DASHBOARD: {
    HOST: `${API_PREFIX}/dashboard/host`,
    PARTICIPANT: `${API_PREFIX}/dashboard/participant`,
  },
} as const;
