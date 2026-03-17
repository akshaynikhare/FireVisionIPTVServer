import { useAuthStore } from '@/store/auth-store';

export function proxyImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/')) return url;
  const params = new URLSearchParams({ url });
  // Attach session ID so browser-initiated requests (<img src>) can authenticate
  const { sessionId, accessToken } = useAuthStore.getState();
  if (sessionId) params.set('sid', sessionId);
  else if (accessToken) params.set('token', accessToken);
  return `/api/v1/image-proxy?${params.toString()}`;
}
