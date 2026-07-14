/**
 * Migration 0007 — Remove dangling channel refs from users.channels[].
 *
 * Catalog wipes/re-imports that predate the "$pull refs on delete" cleanup left users
 * holding ObjectIds of channels that no longer exist (8,731 refs across 19 users in the
 * profiled prod data — for most, their ENTIRE list was dangling, i.e. they already see
 * an empty channel list). Dangling refs serve nothing, bloat user docs, and inflate the
 * $in on every channel sync. Current delete paths clean up refs, so new ones shouldn't
 * appear; this removes the legacy ones.
 *
 * Safe to re-run: finds nothing once clean.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0007-prune-orphan-refs.ts            # DRY-RUN (default)
 *   npx tsx src/scripts/migrations/0007-prune-orphan-refs.ts --commit   # apply changes
 *   npm run migrate:prune-orphan-refs -- --commit
 *
 * ALWAYS take a `mongodump` before running with --commit.
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

import Channel from '../../models/Channel';
const User = require('../../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');

async function run(): Promise<void> {
  console.log(`\n=== Migration 0007: prune orphan refs (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  const channelIds = new Set(
    (await Channel.find({}, { _id: 1 }).lean()).map((d: any) => d._id.toString()),
  );

  const users: any[] = await User.find({}, { username: 1, channels: 1 }).lean();
  let usersAffected = 0;
  let orphansTotal = 0;

  for (const u of users) {
    const orphans = (u.channels || []).filter((c: any) => !channelIds.has(c.toString()));
    if (!orphans.length) continue;
    usersAffected++;
    orphansTotal += orphans.length;
    console.log(`  ${u.username}: ${orphans.length} of ${u.channels.length} refs dangling`);
    if (COMMIT) {
      await User.updateOne({ _id: u._id }, { $pull: { channels: { $in: orphans } } });
    }
  }

  console.log(
    `\n${usersAffected} user(s), ${orphansTotal} dangling ref(s) ${COMMIT ? 'removed' : 'found'}.`,
  );
  if (!COMMIT) {
    console.log(`Dry-run complete — no changes written. Re-run with --commit to apply.`);
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('\nMigration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
