/**
 * Tests for grouped IPTV-org routes:
 *   GET  /iptv-org/api/grouped
 *   POST /iptv-org/import-grouped
 */

import request from 'supertest';
import express from 'express';
import Channel from '../models/Channel';

// requireAuth sets req.user so downstream route handlers can access it
jest.mock('../routes/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'admin-id', role: 'admin' };
    next();
  },
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

// Mock the IPTV-org cache service (singleton) used by the grouped GET route
const mockGetGroupedChannels = jest.fn();
jest.mock('../services/iptv-org-cache', () => ({
  iptvOrgCacheService: {
    getGroupedChannels: mockGetGroupedChannels,
  },
}));

jest.mock('../services/audit-log', () => ({ audit: jest.fn() }));
jest.mock('axios');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const iptvOrgRouter = require('../routes/iptv-org');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/iptv-org', iptvOrgRouter);
  return app;
}

beforeEach(() => {
  mockGetGroupedChannels.mockReset();
});

// ─── GET /iptv-org/api/grouped ───────────────────────────────────────────────

describe('GET /iptv-org/api/grouped', () => {
  const app = buildApp();

  it('returns 200 with data from iptvOrgCacheService', async () => {
    const fakeChannels = [{ channelId: 'abc', channelName: 'BBC One' }];
    mockGetGroupedChannels.mockResolvedValueOnce({
      channels: fakeChannels,
      total: 1,
      stale: false,
    });

    const res = await request(app).get('/iptv-org/api/grouped');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(fakeChannels);
    expect(res.body.count).toBe(1);
    expect(res.body.stale).toBe(false);
  });

  it('passes country and category query params to the service', async () => {
    mockGetGroupedChannels.mockResolvedValueOnce({ channels: [], total: 0, stale: false });

    await request(app).get('/iptv-org/api/grouped?country=US&category=News&limit=10&skip=5');

    expect(mockGetGroupedChannels).toHaveBeenCalledWith(
      expect.objectContaining({ country: 'US', category: 'News', limit: 10, skip: 5 }),
    );
  });

  it('parses comma-separated languages into an array', async () => {
    mockGetGroupedChannels.mockResolvedValueOnce({ channels: [], total: 0, stale: false });

    await request(app).get('/iptv-org/api/grouped?languages=eng,fra');

    expect(mockGetGroupedChannels).toHaveBeenCalledWith(
      expect.objectContaining({ languages: ['eng', 'fra'] }),
    );
  });

  it('returns 500 when service throws', async () => {
    mockGetGroupedChannels.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/iptv-org/api/grouped');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /iptv-org/import-grouped ──────────────────────────────────────────

describe('POST /iptv-org/import-grouped', () => {
  const app = buildApp();

  it('returns 400 when channels array is missing', async () => {
    const res = await request(app).post('/iptv-org/import-grouped').send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when channels is not an array', async () => {
    const res = await request(app)
      .post('/iptv-org/import-grouped')
      .send({ channels: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  it('imports channels and returns imported count', async () => {
    const channels = [
      {
        channelId: `ch-${Date.now()}-1`,
        channelName: 'BBC One',
        channelUrl: 'http://example.com/bbc.m3u8',
        channelGroup: 'Entertainment',
      },
      {
        channelId: `ch-${Date.now()}-2`,
        channelName: 'CNN',
        channelUrl: 'http://example.com/cnn.m3u8',
        channelGroup: 'News',
      },
    ];

    const res = await request(app).post('/iptv-org/import-grouped').send({ channels });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.imported).toBe(2);
    expect(res.body.skipped).toBe(0);

    const count = await Channel.countDocuments();
    expect(count).toBe(2);
  });

  it('stores alternateStreams on imported channels', async () => {
    const channelId = `ch-alt-${Date.now()}`;
    const channels = [
      {
        channelId,
        channelName: 'Multi-stream',
        channelUrl: 'http://primary.example.com/s.m3u8',
        alternateStreams: [
          { streamUrl: 'http://alt1.example.com/s.m3u8', quality: '720p' },
          { streamUrl: 'http://alt2.example.com/s.m3u8', quality: '1080p' },
        ],
      },
    ];

    await request(app).post('/iptv-org/import-grouped').send({ channels });

    const ch: any = await Channel.findOne({ channelId }).lean();
    expect(ch).not.toBeNull();
    expect(ch.alternateStreams).toHaveLength(2);
    expect(ch.alternateStreams[0].source).toBe('iptv-org');
  });

  it('skips duplicate channelIds and reports skipped count', async () => {
    const channelId = `ch-dup-${Date.now()}`;
    const channels = [
      { channelId, channelName: 'Dup Channel', channelUrl: 'http://example.com/dup.m3u8' },
    ];

    // First import
    await request(app).post('/iptv-org/import-grouped').send({ channels });
    // Second import of same channelId
    const res = await request(app).post('/iptv-org/import-grouped').send({ channels });

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBe(1);
    expect(res.body.imported).toBe(0);
  });

  it('uses selectedStreamUrl as channelUrl when provided', async () => {
    const selectedUrl = 'http://selected.example.com/s.m3u8';
    const channels = [
      {
        channelId: `ch-selected-${Date.now()}`,
        channelName: 'Selected Stream',
        channelUrl: 'http://fallback.example.com/s.m3u8',
        selectedStreamUrl: selectedUrl,
      },
    ];

    await request(app).post('/iptv-org/import-grouped').send({ channels });

    const ch: any = await Channel.findOne({ channelName: 'Selected Stream' }).lean();
    expect(ch).not.toBeNull();
    expect(ch.channelUrl).toBe(selectedUrl);
  });
});
