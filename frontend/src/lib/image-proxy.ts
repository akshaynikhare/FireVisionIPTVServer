export function proxyImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  if (url.startsWith('/')) return url;
  return `/api/v1/image-proxy?url=${encodeURIComponent(url)}`;
}
