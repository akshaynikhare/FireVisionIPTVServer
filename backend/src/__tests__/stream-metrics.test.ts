/**
 * Tests for stream metrics routes:
 *   POST /channels/:id/report-status
 *   POST /channels/:id/report-play
 *   POST /channels/health-sync
 */

import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import Channel from '../models/Channel';

// Pass-through auth middleware
jest.mock('../middleware/requireTvOrSessionAuth', () => ({
  requireTvOrSessionAuth: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../routes/auth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../services/audit-log', () => ({ audit: jest.fn() }));
jest.mock('../utils/ssrf-guard', () => ({
  validateUrlForSSRF: jest.fn(),
  isPrivateIP: jest.fn(() => false),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const channelsRouter = require('../routes/channels');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/channels', channelsRouter);
  return app;
}

async function createChannel(overrides: Record<string, unknown> = {}) {
  const ch = new Channel({
    channelId: `ch-${Date.now()}-${Math.random()}`,
    channelName: 'Test Channel',
    channelUrl: 'http://example.com/primary.m3u8',
    ...overrides,
  });
  return (await ch.save()) as any;
}

// ─── POST /:id/report-status ────────────────────────────────────────────────

describe('POST /channels/:id/report-status', () => {
  const app = buildApp();

  it('returns 400 when status is invalid', async () => {
    const ch = await createChannel();
    const res = await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'broken', deviceId: 'dev-1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when deviceId is missing', async () => {
    const ch = await createChannel();
    const res = await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'dead' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when channel does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/channels/${fakeId}/report-status`)
      .send({ status: 'dead', deviceId: 'dev-1' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('increments deadCount for status=dead', async () => {
    const ch = await createChannel();
    const res = await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'dead', deviceId: 'dev-dead' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('dead');
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.metrics.deadCount).toBe(1);
  });

  it('increments aliveCount for status=alive', async () => {
    const ch = await createChannel();
    const res = await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'alive', deviceId: 'dev-alive' });
    expect(res.status).toBe(200);
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.metrics.aliveCount).toBe(1);
  });

  it('increments unresponsiveCount for status=unresponsive', async () => {
    const ch = await createChannel();
    const res = await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'unresponsive', deviceId: 'dev-unresponsive' });
    expect(res.status).toBe(200);
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.metrics.unresponsiveCount).toBe(1);
  });

  it('returns 429 on second report within 5 minutes from same device', async () => {
    const ch = await createChannel();
    await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'dead', deviceId: 'dev-rate' });
    const res = await request(app)
      .post(`/channels/${ch._id}/report-status`)
      .send({ status: 'dead', deviceId: 'dev-rate' });
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });
});

// ─── POST /:id/report-play ──────────────────────────────────────────────────

describe('POST /channels/:id/report-play', () => {
  const app = buildApp();

  it('returns 400 when deviceId is missing', async () => {
    const ch = await createChannel();
    const res = await request(app).post(`/channels/${ch._id}/report-play`).send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when channel does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/channels/${fakeId}/report-play`)
      .send({ deviceId: 'dev-1' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('increments playCount on successful play', async () => {
    const ch = await createChannel();
    const res = await request(app)
      .post(`/channels/${ch._id}/report-play`)
      .send({ deviceId: 'dev-play' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.metrics.playCount).toBe(1);
  });

  it('increments proxyPlayCount when proxyPlay=true', async () => {
    const ch = await createChannel();
    await request(app)
      .post(`/channels/${ch._id}/report-play`)
      .send({ deviceId: 'dev-proxy', proxyPlay: true });
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.metrics.proxyPlayCount).toBe(1);
  });

  it('promotes alternate when streamUrl differs from primary', async () => {
    const altUrl = 'http://example.com/alt.m3u8';
    const ch = await createChannel({
      alternateStreams: [
        {
          streamUrl: altUrl,
          quality: '1080p',
          liveness: { status: 'alive' },
          flaggedBad: { isFlagged: false },
        },
      ],
    });
    await request(app)
      .post(`/channels/${ch._id}/report-play`)
      .send({ deviceId: 'dev-promote', streamUrl: altUrl });
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.channelUrl).toBe(altUrl);
  });

  it('returns 429 on second play report within 1 minute from same device', async () => {
    const ch = await createChannel();
    await request(app).post(`/channels/${ch._id}/report-play`).send({ deviceId: 'dev-rate-play' });
    const res = await request(app)
      .post(`/channels/${ch._id}/report-play`)
      .send({ deviceId: 'dev-rate-play' });
    expect(res.status).toBe(429);
  });
});

// ─── POST /channels/health-sync ─────────────────────────────────────────────

describe('POST /channels/health-sync', () => {
  const app = buildApp();

  it('returns 400 when deviceId is missing', async () => {
    const res = await request(app)
      .post('/channels/health-sync')
      .send({ reports: [{ channelId: 'x', status: 'dead' }] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when reports is missing', async () => {
    const res = await request(app).post('/channels/health-sync').send({ deviceId: 'dev-1' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when reports is empty array', async () => {
    const res = await request(app)
      .post('/channels/health-sync')
      .send({ deviceId: 'dev-1', reports: [] });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reports exceeds 100 entries', async () => {
    const reports = Array.from({ length: 101 }, (_, i) => ({
      channelId: `ch-${i}`,
      status: 'dead',
    }));
    const res = await request(app)
      .post('/channels/health-sync')
      .send({ deviceId: 'dev-1', reports });
    expect(res.status).toBe(400);
  });

  it('updates matched channels and counts skipped invalid entries', async () => {
    const ch = await createChannel();
    const reports = [
      { channelId: ch._id.toString(), status: 'alive' },
      { channelId: ch._id.toString(), status: 'invalid-status' }, // skipped
      { status: 'dead' }, // missing channelId, skipped
    ];
    const res = await request(app)
      .post('/channels/health-sync')
      .send({ deviceId: 'dev-sync', reports });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.updated).toBe(1);
    expect(res.body.data.skipped).toBe(2);
    const updated: any = await Channel.findById(ch._id).lean();
    expect(updated.metrics.aliveCount).toBe(1);
  });

  it('returns 429 on second sync within 5 minutes from same device', async () => {
    const ch = await createChannel();
    const reports = [{ channelId: ch._id.toString(), status: 'dead' }];
    await request(app).post('/channels/health-sync').send({ deviceId: 'dev-sync-rate', reports });
    const res = await request(app)
      .post('/channels/health-sync')
      .send({ deviceId: 'dev-sync-rate', reports });
    expect(res.status).toBe(429);
  });
});
