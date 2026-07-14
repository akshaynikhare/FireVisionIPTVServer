/**
 * Migration 0004 — Backfill channelGroup for 'Uncategorized' channels.
 *
 * Bulk M3U imports that carried no `group-title` left ~70% of the catalog in
 * 'Uncategorized' (import-time categorization now prevents new ones). This backfill
 * resolves a category for EXISTING rows from the iptv-org cache — matched by tvg-id
 * first, then normalized channel name — via the same `resolveChannelGroups()` helper
 * the import paths use. Channels with no match are left as-is.
 *
 * Safe to re-run: already-categorized rows no longer match the Uncategorized filter.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0004-categorize-backfill.ts            # DRY-RUN (default)
 *   npx tsx src/scripts/migrations/0004-categorize-backfill.ts --commit   # apply changes
 *   npm run migrate:categorize -- --commit
 *
 * ALWAYS take a `mongodump` before running with --commit.
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

import Channel from '../../models/Channel';
import { resolveChannelGroups } from '../../services/import-helpers';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');

async function run(): Promise<void> {
  console.log(`\n=== Migration 0004: categorize backfill (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  const docs: any[] = await Channel.find(
    { channelGroup: 'Uncategorized' },
    { channelId: 1, channelName: 1, channelGroup: 1 },
  ).lean();
  console.log(`Uncategorized channels: ${docs.length}`);

  const resolved = await resolveChannelGroups(docs);
  const changed = docs.filter((d) => d.channelGroup !== 'Uncategorized');
  console.log(`Resolvable from iptv-org cache: ${resolved}`);

  const byGroup = new Map<string, number>();
  for (const d of changed) byGroup.set(d.channelGroup, (byGroup.get(d.channelGroup) || 0) + 1);
  const top = [...byGroup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log(`Top categories: ${top.map(([g, n]) => `${g}=${n}`).join(', ') || '(none)'}`);

  if (!COMMIT) {
    console.log(`\nDry-run complete — no changes written. Re-run with --commit to apply.`);
  } else if (changed.length) {
    const res = await Channel.bulkWrite(
      changed.map((d) => ({
        updateOne: { filter: { _id: d._id }, update: { $set: { channelGroup: d.channelGroup } } },
      })),
      { ordered: false },
    );
    console.log(`\nUpdated ${res.modifiedCount} channels.`);
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('\nMigration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
