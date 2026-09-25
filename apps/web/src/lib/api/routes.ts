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
} as const;
