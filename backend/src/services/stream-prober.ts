import axios from 'axios';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validateUrlForSSRF } = require('../utils/ssrf-guard');

export interface ProbeResult {
  status: 'alive' | 'dead';
  responseTimeMs: number;
  statusCode: number | null;
  error: string | null;
  manifestValid: boolean | null;
  segmentReachable: boolean | null;
  manifestInfo: {
    isLive: boolean;
    hasVideo: boolean;
    segmentCount: number;
  } | null;
}

interface ProbeOptions {
  timeout?: number;
  userAgent?: string;
  referrer?: string;
}

/**
 * Probe a stream URL to check liveness.
 * For HLS (.m3u8): validates manifest + HEAD checks the first segment.
 * For non-HLS: simple HTTP GET status check (200-399 = alive).
 */
export async function probeStream(url: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const { timeout = 15000, userAgent, referrer } = options;
  const startTime = Date.now();
  const headers: Record<string, string> = {
    'User-Agent': userAgent || 'VLC/3.0.18 LibVLC/3.0.18',
    Accept: '*/*',
    'Accept-Encoding': 'gzip, deflate',
    Connection: 'keep-alive',
  };
  if (referrer) headers['Referer'] = referrer;

  // SSRF protection: validate URL before making outbound requests
  const ssrfCheck = await validateUrlForSSRF(url);
  if (!ssrfCheck.safe) {
    return {
      status: 'dead' as const,
      responseTimeMs: Date.now() - startTime,
      statusCode: null,
      error: `Blocked: ${ssrfCheck.reason}`,
      manifestValid: null,
      segmentReachable: null,
      manifestInfo: null,
    };
  }

  const isHls = url.includes('.m3u8');

  try {
    const response = await axios.get(url, {
      timeout,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 500,
      headers,
      maxContentLength: isHls ? 512 * 1024 : 1024,
      responseType: isHls ? 'text' : 'stream',
    });

    const responseTimeMs = Date.now() - startTime;
    const statusCode = response.status;
    const httpOk = statusCode >= 200 && statusCode < 400;

    if (!httpOk) {
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
      return {
        status: 'dead',
        responseTimeMs,
        statusCode,
        error: `HTTP ${statusCode}`,
        manifestValid: null,
        segmentReachable: null,
        manifestInfo: null,
      };
    }

    // Non-HLS stream — reachable is enough
    if (!isHls) {
      if (response.data && typeof response.data.destroy === 'function') {
        response.data.destroy();
      }
      return {
        status: 'alive',
        responseTimeMs,
        statusCode,
        error: null,
        manifestValid: null,
        segmentReachable: null,
        manifestInfo: null,
      };
    }

    // HLS manifest validation
    const manifest = String(response.data);
    const manifestValid = manifest.includes('#EXTM3U') || manifest.includes('#EXT-X-');

    if (!manifestValid) {
      return {
        status: 'dead',
        responseTimeMs,
        statusCode,
        error: 'Invalid HLS manifest',
        manifestValid: false,
        segmentReachable: null,
        manifestInfo: null,
      };
    }

    const manifestInfo = {
      isLive: !manifest.includes('#EXT-X-ENDLIST'),
      hasVideo: manifest.includes('#EXTINF') || manifest.includes('#EXT-X-STREAM-INF'),
      segmentCount: (manifest.match(/#EXTINF/g) || []).length,
    };

    // Deep probe: try to reach the first segment
    let segmentReachable: boolean | null = null;
    const segmentUrl = extractFirstSegmentUrl(manifest, url);

    if (segmentUrl) {
      try {
        const segRes = await axios.head(segmentUrl, {
          timeout: 8000,
          maxRedirects: 5,
          validateStatus: (s) => s >= 200 && s < 500,
          headers,
        });
        segmentReachable = segRes.status >= 200 && segRes.status < 400;
      } catch {
        segmentReachable = false;
      }
    }

    // If manifest is a master playlist (has #EXT-X-STREAM-INF but no #EXTINF segments),
    // try to probe the first variant playlist
    if (manifestInfo.segmentCount === 0 && manifest.includes('#EXT-X-STREAM-INF')) {
      const variantUrl = extractFirstVariantUrl(manifest, url);
      if (variantUrl) {
        try {
          const varRes = await axios.get(variantUrl, {
            timeout: 8000,
            maxRedirects: 5,
            validateStatus: (s) => s >= 200 && s < 500,
            headers,
            maxContentLength: 512 * 1024,
            responseType: 'text',
          });
          if (varRes.status >= 200 && varRes.status < 400) {
            const varManifest = String(varRes.data);
            const varSegUrl = extractFirstSegmentUrl(varManifest, variantUrl);
            if (varSegUrl) {
              try {
                const segRes2 = await axios.head(varSegUrl, {
                  timeout: 8000,
                  maxRedirects: 5,
                  validateStatus: (s) => s >= 200 && s < 500,
                  headers,
                });
                segmentReachable = segRes2.status >= 200 && segRes2.status < 400;
              } catch {
                segmentReachable = false;
              }
            }
          }
        } catch {
          // variant probe failed, keep whatever segmentReachable was
        }
      }
    }

    const alive = manifestValid && (segmentReachable === true || segmentReachable === null);

    return {
      status: alive ? 'alive' : 'dead',
      responseTimeMs,
      statusCode,
      error: null,
      manifestValid,
      segmentReachable,
      manifestInfo,
    };
  } catch (error: any) {
    const responseTimeMs = Date.now() - startTime;
    let errorMsg = 'Unknown error';
    let statusCode: number | null = null;

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      errorMsg = 'Timeout';
    } else if (error.code === 'ENOTFOUND') {
      errorMsg = 'DNS resolution failed';
    } else if (error.code === 'ECONNREFUSED') {
      errorMsg = 'Connection refused';
    } else if (error.response) {
      statusCode = error.response.status;
      errorMsg = `HTTP ${statusCode}`;
    } else if (error.code) {
      errorMsg = `${error.code}`;
    } else if (error.message) {
      errorMsg = error.message;
    }

    return {
      status: 'dead',
      responseTimeMs,
      statusCode,
      error: errorMsg,
      manifestValid: null,
      segmentReachable: null,
      manifestInfo: null,
    };
  }
}

/**
 * Extract the first .ts/.aac/.mp4 segment URL from an HLS manifest.
 */
function extractFirstSegmentUrl(manifest: string, manifestUrl: string): string | null {
  const lines = manifest.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXTINF:')) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith('#')) {
        return resolveUrl(next, manifestUrl);
      }
    }
  }
  return null;
}

/**
 * Extract the first variant playlist URL from a master HLS manifest.
 */
function extractFirstVariantUrl(manifest: string, manifestUrl: string): string | null {
  const lines = manifest.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
      const next = lines[i + 1]?.trim();
      if (next && !next.startsWith('#')) {
        return resolveUrl(next, manifestUrl);
      }
    }
  }
  return null;
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(relative: string, base: string): string {
  if (relative.startsWith('http://') || relative.startsWith('https://')) {
    return relative;
  }
  try {
    return new URL(relative, base).toString();
  } catch {
    // Fallback: manual path join
    const baseDir = base.substring(0, base.lastIndexOf('/') + 1);
    return baseDir + relative;
  }
}
