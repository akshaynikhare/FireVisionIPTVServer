/**
 * Migration 0006 — One-off trim of far-future EPG programs.
 *
 * EPG ingest is now bounded to EPG_MAX_LOOKAHEAD_HOURS (default 48h) ahead, but rows
 * fetched before that bound (up to ~6 days ahead, ~82% of DB storage) linger until the
 * 24h-after-endTime TTL reaps them naturally. This deletes them immediately instead of
 * waiting days. Purely optional — skipping it just means slower reclamation.
 *
 * Safe to re-run: bounded ingest means nothing beyond the window comes back.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0006-epg-trim.ts            # DRY-RUN (default)
 *   npx tsx src/scripts/migrations/0006-epg-trim.ts --commit   # apply changes
 *   npm run migrate:epg-trim -- --commit
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

import EpgProgram from '../../models/EpgProgram';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');
const MAX_AHEAD_MS = (Number(process.env.EPG_MAX_LOOKAHEAD_HOURS) || 48) * 3600000;

async function run(): Promise<void> {
  console.log(`\n=== Migration 0006: EPG trim (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  const cutoff = new Date(Date.now() + MAX_AHEAD_MS);
  const filter = { startTime: { $gt: cutoff } };

  const total = await EpgProgram.countDocuments();
  const beyond = await EpgProgram.countDocuments(filter);
  console.log(`Programs: ${total} total, ${beyond} start beyond ${cutoff.toISOString()}`);

  if (!COMMIT) {
    console.log(`\nDry-run complete — no changes written. Re-run with --commit to apply.`);
  } else if (beyond) {
    const res = await EpgProgram.deleteMany(filter);
    console.log(`\nDeleted ${res.deletedCount} far-future programs.`);
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('\nMigration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
