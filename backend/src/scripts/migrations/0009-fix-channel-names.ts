/**
 * Migration 0009 — Repair channel names corrupted by the first-comma EXTINF parse.
 *
 * The M3U parsers extracted the title with /,(.+)$/ — everything after the FIRST comma.
 * Attribute values legally contain commas (Cloudinary tvg-logo URLs "fl_lossy,q_auto,…",
 * user-agent strings "(KHTML, like Gecko)"), so ~756 stored names begin mid-attribute:
 *
 *   before: …Thumbnail.png",Tata Play Marathi Classics
 *   after:  Tata Play Marathi Classics
 *
 * The real title always follows the LAST `",` (end of the final quoted attribute), so the
 * repair takes the substring after it — but ONLY when the prefix shows attribute leakage
 * (`="` or a URL), so a legitimate title like `Show "Name", Extended` is never truncated.
 * The parsers now use extractExtinfTitle(), so new imports can't recreate this.
 *
 * Safe to re-run: repaired names no longer contain `",`.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0009-fix-channel-names.ts            # DRY-RUN (default)
 *   npx tsx src/scripts/migrations/0009-fix-channel-names.ts --commit   # apply changes
 *   npm run migrate:fix-names -- --commit
 *
 * ALWAYS take a `mongodump` before running with --commit.
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

import Channel from '../../models/Channel';
import { repairLeakedExtinfName } from '../../services/import-helpers';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');

async function run(): Promise<void> {
  console.log(`\n=== Migration 0009: fix channel names (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  const docs: any[] = await Channel.find({ channelName: /",/ }, { channelName: 1 }).lean();
  console.log(`Corrupted names found: ${docs.length}`);

  // repairLeakedExtinfName only rewrites names whose prefix shows attribute leakage
  // (`="` or a URL) — a legitimate title containing `",` is left untouched.
  const fixes = docs
    .map((d) => ({
      _id: d._id,
      from: d.channelName as string,
      to: repairLeakedExtinfName(d.channelName),
    }))
    .filter((f): f is { _id: any; from: string; to: string } => f.to !== null);

  fixes.slice(0, 5).forEach((f) => console.log(`  "${f.from.slice(0, 60)}…" → "${f.to}"`));
  console.log(`Repairable: ${fixes.length}`);

  if (!COMMIT) {
    console.log(`\nDry-run complete — no changes written. Re-run with --commit to apply.`);
  } else if (fixes.length) {
    const res = await Channel.bulkWrite(
      fixes.map((f) => ({
        updateOne: { filter: { _id: f._id }, update: { $set: { channelName: f.to } } },
      })),
      { ordered: false },
    );
    console.log(`\nUpdated ${res.modifiedCount} channel names.`);
    const remaining = await Channel.countDocuments({ channelName: /:\/\// });
    console.log(`Names still containing "://" (for manual review): ${remaining}`);
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('\nMigration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
