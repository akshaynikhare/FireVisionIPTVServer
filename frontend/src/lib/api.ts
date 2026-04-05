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
      // Skip redirect for fire-and-forget requests (e.g. report-play)
      if (error.config?.headers?.['X-Skip-Auth-Redirect']) {
        return Promise.reject(error);
      }
      // Claim the redirect immediately — before any async work or checks —
      // so concurrent 401s see the flag and bail out.
      isRedirecting = true;
      // Skip redirect if already on auth pages
      if (
        typeof window !== 'undefined' &&
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register') &&
        !window.location.pathname.startsWith('/verify-email') &&
        !window.location.pathname.startsWith('/pair')
      ) {
        // Clear both Zustand store and raw localStorage keys in one call
        useAuthStore.getState().logout();
        const data = error.response?.data;
        const isInactive = data?.error === 'User account is inactive';
        if (isInactive) {
          const email = data?.adminEmail;
          window.location.href = email
            ? `/login?message=account_disabled&admin_email=${encodeURIComponent(email)}`
            : '/login?message=account_disabled';
        } else {
          window.location.href = '/login';
        }
        // No timeout reset — module reloads on navigation, resetting isRedirecting naturally
      }
    }
    return Promise.reject(error);
  },
);

export default api;
