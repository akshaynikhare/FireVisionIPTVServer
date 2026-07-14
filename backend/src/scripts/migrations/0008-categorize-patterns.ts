/**
 * Migration 0008 — Pattern-based categorization of remaining 'Uncategorized' channels.
 *
 * After the iptv-org backfill (0004), ~42k channels stayed Uncategorized because they
 * come from provider/Xtream playlist dumps iptv-org doesn't index: VOD entries (series
 * "S01 E09", movies "(2021)") and country-prefixed feeds ("DE: Sky Bundesliga"). Their
 * names encode the category near-deterministically; this applies the same
 * `patternCategory()` rules the import paths now use (series/movies/genre keywords/
 * country-code prefix). No match → stays Uncategorized.
 *
 * Safe to re-run: categorized rows no longer match the filter.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0008-categorize-patterns.ts            # DRY-RUN (default)
 *   npx tsx src/scripts/migrations/0008-categorize-patterns.ts --commit   # apply changes
 *   npm run migrate:categorize-patterns -- --commit
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
  console.log(
    `\n=== Migration 0008: pattern categorization (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`,
  );
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  // Covers the literal 'Uncategorized', plus ''/null groups some imports left behind
  // (group-title="" parses as an empty string, bypassing the schema default).
  const docs: any[] = await Channel.find(
    { $or: [{ channelGroup: 'Uncategorized' }, { channelGroup: '' }, { channelGroup: null }] },
    { channelId: 1, channelName: 1, channelGroup: 1 },
  ).lean();
  console.log(`Uncategorized/empty-group channels: ${docs.length}`);

  const original = new Map(docs.map((d) => [d._id.toString(), d.channelGroup]));
  const resolved = await resolveChannelGroups(docs);
  // Normalize unresolvable empty groups to the schema default for consistent grouping.
  for (const d of docs) if (!d.channelGroup) d.channelGroup = 'Uncategorized';
  const changed = docs.filter((d) => d.channelGroup !== original.get(d._id.toString()));
  console.log(`Resolvable (iptv-org + patterns): ${resolved}`);

  const byGroup = new Map<string, number>();
  for (const d of changed) byGroup.set(d.channelGroup, (byGroup.get(d.channelGroup) || 0) + 1);
  const top = [...byGroup.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`Top groups: ${top.map(([g, n]) => `${g}=${n}`).join(', ') || '(none)'}`);

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
