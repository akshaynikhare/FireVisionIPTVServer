/**
 * Tests for favorites sync:
 *   POST /favorites
 *   GET  /favorites
 *
 * The invariant under test: ordering comes from a server-issued revision, so two devices
 * cannot silently overwrite each other, and a rejected write says so rather than
 * reporting success.
 */

import request from 'supertest';
import express from 'express';
import User from '../models/User';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const favoritesRouter = require('../routes/favorites');

const app = express();
app.use(express.json());
app.use('/favorites', favoritesRouter);

async function createUser() {
  const user = await User.create({
    username: 'fav-user',
    password: 'password123',
    email: 'fav-user@example.com',
    role: 'User',
    channelListCode: 'FAVCODE',
  });
  return user;
}

function post(body: Record<string, unknown>) {
  return request(app).post('/favorites').set('x-tv-code', 'FAVCODE').send(body);
}

function get() {
  return request(app).get('/favorites').set('x-tv-code', 'FAVCODE');
}

describe('POST /favorites', () => {
  beforeEach(createUser);

  it('stores favorites and issues a revision', async () => {
    const res = await post({ channel_ids: ['a', 'b'], revision: 0 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.revision).toBe(1);

    const read = await get();
    expect(read.body.channel_ids).toEqual(['a', 'b']);
    expect(read.body.revision).toBe(1);
  });

  it('advances the revision on each accepted write', async () => {
    expect((await post({ channel_ids: ['a'], revision: 0 })).body.revision).toBe(1);
    expect((await post({ channel_ids: ['a', 'b'], revision: 1 })).body.revision).toBe(2);
  });

  // Regression: ordering used to come from client wall clocks, so a device whose clock ran
  // behind had legitimate updates silently discarded with 200 + applied:false.
  it('rejects a stale revision with 409 and the current state', async () => {
    await post({ channel_ids: ['a'], revision: 0 });

    const stale = await post({ channel_ids: ['z'], revision: 0 });
    expect(stale.status).toBe(409);
    expect(stale.body.success).toBe(false);
    expect(stale.body.channel_ids).toEqual(['a']);
    expect(stale.body.revision).toBe(1);

    // The rejected write must not have been stored.
    expect((await get()).body.channel_ids).toEqual(['a']);
  });

  it('accepts the retry a client makes with the revision from a conflict', async () => {
    await post({ channel_ids: ['a'], revision: 0 });
    const conflict = await post({ channel_ids: ['z'], revision: 0 });

    const retry = await post({
      channel_ids: [...conflict.body.channel_ids, 'z'],
      revision: conflict.body.revision,
    });
    expect(retry.status).toBe(200);
    expect((await get()).body.channel_ids).toEqual(['a', 'z']);
  });

  // TV clients that predate revisions must keep working.
  it('falls back to last-write-wins when no revision is sent', async () => {
    await post({ channel_ids: ['a'], revision: 0 });

    const res = await post({ channel_ids: ['b'] });
    expect(res.status).toBe(200);
    expect((await get()).body.channel_ids).toEqual(['b']);
  });

  it('rejects a malformed body', async () => {
    expect((await post({ channel_ids: 'not-an-array' })).status).toBe(400);
    expect((await post({ channel_ids: [], revision: -1 })).status).toBe(400);
    expect((await post({ channel_ids: [], revision: 1.5 })).status).toBe(400);
  });

  it('records the device that last wrote', async () => {
    await post({ channel_ids: ['a'], revision: 0, device_id: 'living-room' });
    const user = await User.findOne({ channelListCode: 'FAVCODE' });
    expect(user?.metadata?.favoritesDeviceId).toBe('living-room');
  });
});

describe('GET /favorites', () => {
  it('reports an empty list and revision 0 before anything is stored', async () => {
    await createUser();
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.body.channel_ids).toEqual([]);
    expect(res.body.revision).toBe(0);
  });
});
