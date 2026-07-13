/**
 * Migration 0001 — Channel ownership backfill (Conservative attribution).
 *
 * Introduces Channel.ownerId (null = shared admin catalog, a user id = private).
 * Attributes EXISTING channels to owners without anyone losing visibility:
 *   - A channel referenced by EXACTLY ONE non-admin user and NO admin → that user's private channel.
 *   - Everything else (shared, admin-referenced, orphaned) stays catalog (ownerId = null).
 * Also swaps the global-unique index on channelId for a per-owner compound unique index.
 *
 * User.channels is never modified, so every user keeps exactly the channels they see today.
 *
 * Usage:
 *   npx tsx src/scripts/migrations/0001-channel-ownership.ts            # dry-run (reports only)
 *   npx tsx src/scripts/migrations/0001-channel-ownership.ts --commit   # apply changes
 *
 * ALWAYS take a `mongodump` before running with --commit.
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

import Channel from '../../models/Channel';
import User from '../../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');

interface ChannelRef {
  _id: mongoose.Types.ObjectId; // the channel id
  nonAdminUsers: mongoose.Types.ObjectId[]; // distinct non-admin users referencing it
  adminReferenced: boolean;
}

async function buildReferenceMap(): Promise<ChannelRef[]> {
  // Fan out User.channels → per-channel: which non-admin users reference it, and whether any admin does.
  const rows = await User.aggregate([
    { $project: { role: 1, channels: 1 } },
    { $unwind: '$channels' },
    {
      $group: {
        _id: '$channels',
        nonAdminUsers: {
          $addToSet: { $cond: [{ $ne: ['$role', 'Admin'] }, '$_id', null] },
        },
        admins: {
          $addToSet: { $cond: [{ $eq: ['$role', 'Admin'] }, '$_id', null] },
        },
      },
    },
  ]);

  return rows.map((r: any) => ({
    _id: r._id,
    nonAdminUsers: (r.nonAdminUsers || []).filter((x: unknown) => x != null),
    adminReferenced: (r.admins || []).some((x: unknown) => x != null),
  }));
}

async function snapshotUserCounts(): Promise<Map<string, number>> {
  const users = await User.find({}, { channels: 1 }).lean();
  const m = new Map<string, number>();
  for (const u of users) m.set(String(u._id), (u.channels || []).length);
  return m;
}

async function swapIndexes(): Promise<void> {
  const coll = mongoose.connection.db!.collection('channels');
  const existing = await coll.indexes();
  const oldUnique = existing.find((i) => i.name === 'channelId_1' && i.unique);
  if (oldUnique) {
    await coll.dropIndex('channelId_1');
    console.log('  Dropped old global-unique index channelId_1.');
  }
  try {
    await coll.createIndex({ ownerId: 1, channelId: 1 }, { unique: true });
    console.log('  Ensured compound unique index { ownerId, channelId }.');
  } catch (err: any) {
    console.error(
      `  ✗ Could not create compound unique index (duplicate (ownerId, channelId) pairs exist): ${err.message}`,
    );
    console.error('    Resolve duplicates, then re-run. No data was deleted.');
    throw err;
  }
}

async function run(): Promise<void> {
  console.log(`\n=== Migration 0001: channel ownership (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  const totalChannels = await Channel.countDocuments();
  const before = await snapshotUserCounts();
  console.log(`Channels: ${totalChannels}   Users: ${before.size}`);

  // 1. Backfill the field on any legacy docs missing it.
  if (COMMIT) {
    const res = await Channel.updateMany(
      { ownerId: { $exists: false } },
      { $set: { ownerId: null } },
    );
    console.log(`Backfilled ownerId=null on ${res.modifiedCount} legacy docs.`);
  }

  // 2. Reference map + conservative attribution.
  const refs = await buildReferenceMap();
  const toPrivatize = refs.filter((r) => r.nonAdminUsers.length === 1 && !r.adminReferenced);

  // Only touch channels still unowned (idempotent re-runs).
  const candidateIds = toPrivatize.map((r) => r._id);
  const stillUnowned = new Set(
    (await Channel.find({ _id: { $in: candidateIds }, ownerId: null }, { _id: 1 }).lean()).map(
      (c: any) => String(c._id),
    ),
  );
  const ops = toPrivatize
    .filter((r) => stillUnowned.has(String(r._id)))
    .map((r) => ({
      updateOne: { filter: { _id: r._id }, update: { $set: { ownerId: r.nonAdminUsers[0] } } },
    }));

  // Per-user tally for the report.
  const perUser = new Map<string, number>();
  for (const r of toPrivatize.filter((x) => stillUnowned.has(String(x._id)))) {
    const k = String(r.nonAdminUsers[0]);
    perUser.set(k, (perUser.get(k) || 0) + 1);
  }

  const referencedTotal = refs.length;
  const sharedOrAdmin = refs.length - toPrivatize.length;
  console.log(`\nAttribution (Conservative):`);
  console.log(`  Channels referenced by a user:        ${referencedTotal}`);
  console.log(`  → would become private (1 owner):      ${ops.length}`);
  console.log(`  → stay catalog (shared/admin/multi):   ${sharedOrAdmin}`);
  console.log(`  Orphan/catalog (no user ref):          ${totalChannels - referencedTotal}`);
  console.log(`  Users receiving private channels:      ${perUser.size}`);

  if (COMMIT) {
    if (ops.length) {
      const res = await Channel.bulkWrite(ops, { ordered: false });
      console.log(`\nPrivatized ${res.modifiedCount} channels.`);
    }
    console.log('Swapping indexes…');
    await swapIndexes();
  } else {
    console.log(`\n(dry-run — no writes performed)`);
  }

  // 3. Verify no user lost visibility (User.channels untouched).
  const after = await snapshotUserCounts();
  let mismatches = 0;
  for (const [uid, cnt] of before) {
    if ((after.get(uid) ?? -1) !== cnt) {
      mismatches++;
      console.error(`  ✗ user ${uid}: channels ${cnt} → ${after.get(uid)}`);
    }
  }
  if (mismatches === 0) {
    console.log(`\nVerification OK: all ${before.size} users retain their exact channel counts.`);
  } else {
    console.error(`\n✗ Verification FAILED: ${mismatches} users changed count.`);
    process.exitCode = 1;
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('Migration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
