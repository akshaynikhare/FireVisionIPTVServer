import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

function safeGetItem(key: string): string | null {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof window !== 'undefined') localStorage.removeItem(key);
  } catch {
    // ignore storage errors (e.g. private browsing)
  }
}

// Request interceptor: attach session ID or JWT token
api.interceptors.request.use((config) => {
  const token = safeGetItem('accessToken');
  const sessionId = safeGetItem('sessionId');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (sessionId) {
    config.headers['x-session-id'] = sessionId;
  }

  return config;
});

// Response interceptor: handle 401 (unauthorized)
let isRedirecting = false;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      // Skip redirect if already on auth pages
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        isRedirecting = true;
        safeRemoveItem('accessToken');
        safeRemoveItem('refreshToken');
        safeRemoveItem('sessionId');
        window.location.href = '/login';
        // Reset flag after a short delay so re-login 401s still work
        setTimeout(() => {
          isRedirecting = false;
        }, 2000);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
