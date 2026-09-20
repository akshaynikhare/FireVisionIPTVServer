/**
 * Tests for the HLS proxy stream token — the signature that lets the TV proxy
 * re-authorize child playlists, keys and segments it emitted while rewriting a
 * manifest, without becoming an open proxy.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { signStreamToken, verifyStreamToken } = require('../utils/stream-token');

const CODE = 'ABC123';
const ROOT_ID = '6aaeb0bc754e6cc7c9a703af';
const STREAM_URL = 'http://127.0.0.1:19181/hls/variant.m3u8';

describe('stream token', () => {
  it('round-trips a signed URL back to its root channel', () => {
    const token = signStreamToken(CODE, ROOT_ID, STREAM_URL);
    expect(verifyStreamToken(token, CODE, STREAM_URL)).toEqual({ rootId: ROOT_ID });
  });

  it('rejects a token replayed against a different URL', () => {
    const token = signStreamToken(CODE, ROOT_ID, STREAM_URL);
    expect(verifyStreamToken(token, CODE, 'http://evil.example/internal')).toBeNull();
  });

  it('rejects a token replayed under a different channel list code', () => {
    const token = signStreamToken(CODE, ROOT_ID, STREAM_URL);
    expect(verifyStreamToken(token, 'OTHER1', STREAM_URL)).toBeNull();
  });

  it('rejects a token whose root channel id was swapped', () => {
    const token = signStreamToken(CODE, ROOT_ID, STREAM_URL);
    const tampered = `6aaeb0bc754e6cc7c9a703ae.${token.split('.').slice(1).join('.')}`;
    expect(verifyStreamToken(tampered, CODE, STREAM_URL)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signStreamToken(CODE, ROOT_ID, STREAM_URL);
    const [rootId, , signature] = token.split('.');
    expect(
      verifyStreamToken(`${rootId}.${Date.now() - 1000}.${signature}`, CODE, STREAM_URL),
    ).toBeNull();
  });

  it('rejects malformed and missing tokens', () => {
    for (const token of [undefined, '', 'nonsense', 'a.b', `${ROOT_ID}.x.y`]) {
      expect(verifyStreamToken(token, CODE, STREAM_URL)).toBeNull();
    }
  });
});
