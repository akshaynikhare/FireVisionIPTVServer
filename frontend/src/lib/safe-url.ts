/**
 * Validates that a URL uses a safe protocol (http or https).
 * Prevents XSS via javascript: or data: URIs when setting img.src dynamically.
 */
export function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
