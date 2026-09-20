/**
 * Tests for the TV pairing handshake:
 *   POST /tv/pairing/confirm
 *   GET  /tv/pairing/status/:pin
 *
 * The invariant under test: the TV is handed its channel list code only for a pairing
 * that actually completed inside the PIN's validity window, and a PIN that does not
 * complete stays reclaimable.
 */

import request from 'supertest';
import express from 'express';
import User from '../models/User';
import Session from '../models/Session';
import PairingRequest from '../models/PairingRequest';

jest.mock('../services/audit-log', () => ({ audit: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tvRouter = require('../routes/tv');

const app = express();
app.use(express.json());
app.use('/tv', tvRouter);

const TEN_MINUTES = 10 * 60 * 1000;

async function createUser() {
  return User.create({
    username: 'tv-user',
    password: 'password123',
    email: 'tv-user@example.com',
    role: 'User',
    channelListCode: 'SECRETCODE',
  });
}

async function createSession(user: any) {
  const sessionId = 'session-under-test';
  await Session.create({
    sessionId,
    userId: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    expiresAt: new Date(Date.now() + TEN_MINUTES),
  });
  return sessionId;
}

async function createPairing(overrides: Record<string, unknown> = {}) {
  return PairingRequest.create({
    pin: '123456',
    deviceName: 'Living Room TV',
    deviceModel: 'AFTMM',
    expiresAt: new Date(Date.now() + TEN_MINUTES),
    ...overrides,
  });
}

function confirm(sessionId: string, pin = '123456') {
  return request(app).post('/tv/pairing/confirm').set('x-session-id', sessionId).send({ pin });
}

describe('POST /tv/pairing/confirm', () => {
  it('completes the pairing and exposes the code to the TV', async () => {
    const user = await createUser();
    const sessionId = await createSession(user);
    await createPairing();

    const res = await confirm(sessionId);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.status).toBe(200);
    expect(poll.body.paired).toBe(true);
    expect(poll.body.channelListCode).toBe('SECRETCODE');

    const saved = await User.findById(user._id);
    expect(saved?.metadata?.lastPairedDevice).toBe('Living Room TV');
  });

  it('rejects an already-claimed PIN so two dashboards cannot both pair it', async () => {
    const user = await createUser();
    const sessionId = await createSession(user);
    await createPairing();

    expect((await confirm(sessionId)).status).toBe(200);
    expect((await confirm(sessionId)).status).toBe(404);
  });

  it('rejects an expired PIN and does not expose the code', async () => {
    const user = await createUser();
    const sessionId = await createSession(user);
    await createPairing({ expiresAt: new Date(Date.now() - 1000) });

    const res = await confirm(sessionId);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);

    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.body.paired).toBeFalsy();
    expect(poll.body.channelListCode).toBeUndefined();
  });

  // Regression: the PIN used to be marked completed before the user metadata was saved,
  // so a save failure returned 500 while polling still handed out the credential.
  it('still pairs when device metadata cannot be saved', async () => {
    const user = await createUser();
    const sessionId = await createSession(user);
    await createPairing();

    const saveSpy = jest
      .spyOn(User.prototype, 'save')
      .mockRejectedValueOnce(new Error('metadata write failed'));

    const res = await confirm(sessionId);
    saveSpy.mockRestore();

    // The pairing itself succeeded, so the TV must be able to finish.
    expect(res.status).toBe(200);
    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.body.paired).toBe(true);
    expect(poll.body.channelListCode).toBe('SECRETCODE');

    // Metadata is best-effort and must not describe a pairing that failed.
    const saved = await User.findById(user._id);
    expect(saved?.metadata?.lastPairedDevice).toBeUndefined();
  });

  // Regression: a PIN that lapsed between being claimed and being completed used to
  // complete anyway, handing out the code outside its validity window.
  it('does not complete a PIN that lapses after it is claimed', async () => {
    const user = await createUser();
    const sessionId = await createSession(user);
    await createPairing();

    // Lapse the PIN in the window the claim opens, mimicking a slow confirmation.
    const realClaim = PairingRequest.findOneAndUpdate.bind(PairingRequest);
    const claimSpy = jest.spyOn(PairingRequest, 'findOneAndUpdate').mockImplementationOnce(((
      ...args: unknown[]
    ) =>
      (async () => {
        const claimed = await (realClaim as any)(...args);
        if (claimed) {
          await PairingRequest.collection.updateOne(
            { pin: '123456' },
            { $set: { expiresAt: new Date(Date.now() - 1000) } },
          );
        }
        return claimed;
      })()) as any);

    const res = await confirm(sessionId);
    claimSpy.mockRestore();

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);

    const stored = await PairingRequest.findOne({ pin: '123456' });
    expect(stored?.status).not.toBe('completed');
    expect(stored?.userId).toBeNull();

    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.body.paired).toBeFalsy();
    expect(poll.body.channelListCode).toBeUndefined();
  });
});

describe('GET /tv/pairing/status/:pin', () => {
  it('expires a lapsed unclaimed PIN', async () => {
    await createPairing({ expiresAt: new Date(Date.now() - 1000) });

    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.body.status).toBe('expired');
    expect((await PairingRequest.findOne({ pin: '123456' }))?.status).toBe('expired');
  });

  it('holds a claimed PIN briefly instead of expiring a pairing in flight', async () => {
    const user = await createUser();
    await createPairing({
      userId: user._id,
      expiresAt: new Date(Date.now() - 1000),
    });

    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.body.status).toBe('pending');
    expect((await PairingRequest.findOne({ pin: '123456' }))?.status).toBe('pending');
  });

  it('expires a claimed PIN once the confirmation grace window has passed', async () => {
    const user = await createUser();
    await createPairing({
      userId: user._id,
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    const poll = await request(app).get('/tv/pairing/status/123456');
    expect(poll.body.status).toBe('expired');
    expect((await PairingRequest.findOne({ pin: '123456' }))?.status).toBe('expired');
  });
});
