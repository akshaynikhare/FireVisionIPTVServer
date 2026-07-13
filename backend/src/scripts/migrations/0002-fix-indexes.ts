/**
 * Migration 0002 — Reconcile changed indexes on existing databases.
 *
 * Three index definitions changed in the models, but Mongoose `autoIndex` only
 * CREATES missing indexes — it never drops or alters an index that already
 * exists under the same name. So on a database that predates these changes the
 * OLD indexes survive and the new options are silently ignored:
 *
 *   - EpgProgram   { channelEpgId, startTime }  non-unique  → unique
 *   - SeedChannel  { source, ytChannelId } / { source, directUrl }
 *                  sparse-unique  → partial-unique ($type:'string')
 *   - PairingRequest  pin  full-unique  → partial-unique ({ status: 'pending' })
 *
 * This script brings the live indexes in line with the current schemas via
 * `syncIndexes()` (which drops indexes not in the schema and builds the new
 * ones). For EpgProgram the new UNIQUE index cannot build while duplicate
 * { channelEpgId, startTime } rows exist, so those are de-duplicated first
 * (keeping the most recently updated row of each group).
 *
 * Safe to re-run: dedup finds nothing and syncIndexes is a no-op once aligned.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0002-fix-indexes.ts            # DRY-RUN (default) — reports only
 *   npx tsx src/scripts/migrations/0002-fix-indexes.ts --commit   # apply changes
 *   npm run migrate:fix-indexes -- --commit
 *
 * ALWAYS take a `mongodump` before running with --commit.
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

// Importing the models registers their schemas (and current index definitions).
import EpgProgram from '../../models/EpgProgram';
import { SeedChannel } from '../../models/SeedChannel';
import PairingRequest from '../../models/PairingRequest';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');

type IndexInfo = { name: string; key: Record<string, number>; unique?: boolean; sparse?: boolean };

async function listIndexes(model: mongoose.Model<any>): Promise<IndexInfo[]> {
  try {
    return (await model.collection.indexes()) as IndexInfo[];
  } catch {
    return []; // collection may not exist yet on a fresh DB
  }
}

function describe(ix: IndexInfo[]): string {
  return ix
    .filter((i) => i.name !== '_id_')
    .map((i) => {
      const flags = [i.unique && 'unique', i.sparse && 'sparse'].filter(Boolean).join(',');
      return `      ${i.name}${flags ? ` [${flags}]` : ''}`;
    })
    .join('\n');
}

/** Remove duplicate { channelEpgId, startTime } rows, keeping the freshest of each group. */
async function dedupeEpgPrograms(): Promise<number> {
  const groups = await EpgProgram.collection
    .aggregate(
      [
        { $sort: { updatedAt: -1 } },
        {
          $group: {
            _id: { c: '$channelEpgId', s: '$startTime' },
            ids: { $push: '$_id' },
            n: { $sum: 1 },
          },
        },
        { $match: { n: { $gt: 1 } } },
      ],
      { allowDiskUse: true },
    )
    .toArray();

  const toDelete: mongoose.Types.ObjectId[] = [];
  for (const g of groups) toDelete.push(...g.ids.slice(1)); // keep ids[0] (freshest)

  console.log(
    `  EpgProgram duplicates: ${groups.length} colliding key(s), ${toDelete.length} row(s) to remove.`,
  );

  if (COMMIT && toDelete.length) {
    const res = await EpgProgram.collection.deleteMany({ _id: { $in: toDelete } });
    console.log(`  Deleted ${res.deletedCount} duplicate EpgProgram rows.`);
  }
  return toDelete.length;
}

async function syncModel(model: mongoose.Model<any>, label: string): Promise<void> {
  console.log(`\n[${label}]`);
  const before = await listIndexes(model);
  console.log(`  Current indexes:\n${describe(before) || '      (none)'}`);

  if (!COMMIT) {
    console.log(`  (dry-run — would run syncIndexes() to match the schema)`);
    return;
  }

  const dropped = await model.syncIndexes();
  console.log(`  syncIndexes() dropped: ${dropped.length ? dropped.join(', ') : '(none)'}`);
  const after = await listIndexes(model);
  console.log(`  Resulting indexes:\n${describe(after) || '      (none)'}`);
}

async function run(): Promise<void> {
  console.log(`\n=== Migration 0002: fix indexes (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  // EpgProgram must be de-duplicated BEFORE its unique index can build.
  console.log(`\n[EpgProgram] de-duplication`);
  await dedupeEpgPrograms();

  await syncModel(EpgProgram, 'EpgProgram');
  await syncModel(SeedChannel, 'SeedChannel');
  await syncModel(PairingRequest, 'PairingRequest');

  if (!COMMIT) {
    console.log(`\nDry-run complete — no changes written. Re-run with --commit to apply.`);
  } else {
    console.log(`\nMigration complete.`);
  }

  await mongoose.connection.close();
  console.log('Done.\n');
}

run().catch(async (err) => {
  console.error('\nMigration error:', err);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
