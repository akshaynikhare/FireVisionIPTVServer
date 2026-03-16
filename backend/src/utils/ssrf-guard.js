const dns = require('dns');
const { promisify } = require('util');
const dnsLookup = promisify(dns.lookup);

/**
 * Check if an IP address is private/internal.
 */
function isPrivateIP(ip) {
  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length === 4 && parts.every(p => p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;                                    // 10.0.0.0/8
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16.0.0/12
    if (parts[0] === 192 && parts[1] === 168) return true;              // 192.168.0.0/16
    if (parts[0] === 169 && parts[1] === 254) return true;              // 169.254.0.0/16 (link-local)
    if (parts[0] === 127) return true;                                   // 127.0.0.0/8
    if (parts[0] === 0) return true;                                     // 0.0.0.0/8
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true; // 100.64.0.0/10 (CGNAT)
  }

  // IPv6 checks
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;                   // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;    // ULA
  if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true;  // link-local
  if (lower.startsWith('::ffff:')) {                                    // IPv4-mapped IPv6
    const mapped = lower.slice(7);
    return isPrivateIP(mapped);
  }

  return false;
}

/**
 * Validate a URL string is safe to fetch (not targeting private/internal networks).
 * Resolves DNS to prevent DNS rebinding attacks.
 * Returns { safe: true } or { safe: false, reason: string }.
 */
async function validateUrlForSSRF(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: 'Only http and https protocols are allowed' };
    }

    // Block well-known internal hostnames
    if (['localhost', 'metadata.google.internal'].includes(hostname.toLowerCase())) {
      return { safe: false, reason: 'Proxying to internal hostnames is not allowed' };
    }

    // Quick check: if hostname is already an IP literal, validate directly
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: 'Proxying to private/internal addresses is not allowed' };
    }

    // DNS resolution check — resolve ALL addresses to prevent DNS rebinding
    try {
      const results = await dnsLookup(hostname, { family: 0, all: true });
      for (const { address } of results) {
        if (isPrivateIP(address)) {
          return { safe: false, reason: 'Hostname resolves to a private/internal address' };
        }
      }
    } catch (err) {
      return { safe: false, reason: 'DNS resolution failed for hostname' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }
}

module.exports = { isPrivateIP, validateUrlForSSRF };
