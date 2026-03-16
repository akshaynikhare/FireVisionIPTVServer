import axios from 'axios';
import { useAuthStore } from '@/store/auth-store';

const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach session ID or JWT token from Zustand store
api.interceptors.request.use((config) => {
  const { accessToken, sessionId } = useAuthStore.getState();

  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
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
        // Clear both Zustand store and raw localStorage keys in one call
        useAuthStore.getState().logout();
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
