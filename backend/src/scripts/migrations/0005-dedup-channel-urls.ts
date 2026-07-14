/**
 * Migration 0005 — Collapse exact-duplicate-URL catalog channels.
 *
 * Historical imports created multiple catalog rows (ownerId:null) with the SAME
 * `channelUrl` under different channelIds (~236 groups / ~299 redundant docs in the
 * profiled prod data). Import-time dedup now prevents new ones; this collapses the
 * existing groups:
 *
 *   1. Survivor per group = tested-working first, then most alternates, then oldest.
 *   2. Losers' alternateStreams fold into the survivor (deduped, capped at 50).
 *   3. Losers are deleted FIRST — add endpoints validate channel existence, so a
 *      deleted loser can't be concurrently assigned while step 4 runs.
 *   4. Every user referencing a loser gets the survivor added, then losers pulled.
 *
 * Safe to re-run: once collapsed, no group has more than one row per URL.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0005-dedup-channel-urls.ts            # DRY-RUN (default)
 *   npx tsx src/scripts/migrations/0005-dedup-channel-urls.ts --commit   # apply changes
 *   npm run migrate:dedup-urls -- --commit
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

// Tested-working > untested > tested-dead; then richer alternates; then oldest row.
function score(ch: any): number {
  const working = ch.metadata?.isWorking === true ? 2 : ch.metadata?.isWorking == null ? 1 : 0;
  return working * 1000 + (ch.alternateStreams?.length || 0);
}

async function run(): Promise<void> {
  console.log(`\n=== Migration 0005: dedup channel URLs (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  const groups = await Channel.collection
    .aggregate(
      [
        { $match: { ownerId: null } },
        { $group: { _id: '$channelUrl', ids: { $push: '$_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  let losersTotal = 0;
  let foldedAlts = 0;
  const allLoserIds: mongoose.Types.ObjectId[] = [];

  for (const g of groups) {
    const docs: any[] = await Channel.find({ _id: { $in: g.ids } }).lean();
    docs.sort(
      (a, b) =>
        score(b) - score(a) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const survivor = docs[0];
    const losers = docs.slice(1);
    losersTotal += losers.length;

    // Fold losers' alternates into the survivor (dedupe by URL, skip the shared primary, cap 50)
    const alts = [...(survivor.alternateStreams || [])];
    const seen = new Set(alts.map((a: any) => a.streamUrl).concat([survivor.channelUrl]));
    for (const loser of losers) {
      allLoserIds.push(loser._id);
      for (const alt of loser.alternateStreams || []) {
        if (alt.streamUrl && !seen.has(alt.streamUrl) && alts.length < 50) {
          seen.add(alt.streamUrl);
          alts.push(alt);
          foldedAlts++;
        }
      }
    }

    if (COMMIT) {
      if (alts.length !== (survivor.alternateStreams || []).length) {
        await Channel.updateOne({ _id: survivor._id }, { $set: { alternateStreams: alts } });
      }
      const loserIds = losers.map((l) => l._id);
      // Delete losers FIRST: add endpoints validate channel existence, so once deleted a
      // loser id can't be concurrently assigned between the remap and the pull below.
      await Channel.deleteMany({ _id: { $in: loserIds } });
      // Users holding a loser keep access via the survivor; then loser refs are removed.
      await User.updateMany(
        { channels: { $in: loserIds } },
        { $addToSet: { channels: survivor._id } },
      );
      await User.updateMany(
        { channels: { $in: loserIds } },
        { $pull: { channels: { $in: loserIds } } },
      );
    }
  }

  const affectedUsers = allLoserIds.length
    ? await User.countDocuments({ channels: { $in: allLoserIds } })
    : 0;

  console.log(`Duplicate-URL groups: ${groups.length}`);
  console.log(`Redundant rows ${COMMIT ? 'deleted' : 'to delete'}: ${losersTotal}`);
  console.log(`Alternates folded into survivors: ${foldedAlts}`);
  console.log(
    `Users ${COMMIT ? 'remapped (remaining loser refs: ' + affectedUsers + ')' : 'to remap: ' + affectedUsers}`,
  );

  if (!COMMIT) {
    console.log(`\nDry-run complete — no changes written. Re-run with --commit to apply.`);
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('\nMigration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
