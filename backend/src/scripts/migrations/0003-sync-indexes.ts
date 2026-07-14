/**
 * Migration 0003 — Apply the retention/index declaration changes from the DB optimization pass.
 *
 * The model declarations changed, but Mongoose `autoIndex` only CREATES missing
 * indexes — it never drops or alters an existing one. On a database that predates
 * these changes the old indexes survive until this script reconciles them:
 *
 *   - AuditLog          timestamp TTL 365d → 180d; drop redundant userId_1 / resource_1
 *                       (covered by { userId, timestamp } / { resource, timestamp })
 *   - ScheduledTaskRun  NEW createdAt TTL (30d) — history was unbounded
 *   - Channel           drop redundant channelGroup_1 (covered by { channelGroup, order });
 *                       also applies the 0001 index swap on catalogs that never ran it:
 *                       drops the legacy global-unique channelId_1 and builds
 *                       { ownerId, channelId } unique + ownerId_1 (channelId stays
 *                       indexed non-unique). Safe while channelId values are unique.
 *   - IptvOrgChannel    drop redundant channelId_1 (covered by { channelId, streamUrl })
 *                       and country_1 (covered by the country_1_* compounds)
 *
 * Safe to re-run: syncIndexes() is a no-op once the live indexes match the schemas.
 *
 * Usage (from backend/):
 *   npx tsx src/scripts/migrations/0003-sync-indexes.ts            # DRY-RUN (default) — reports only
 *   npx tsx src/scripts/migrations/0003-sync-indexes.ts --commit   # apply changes
 *   npm run migrate:sync-indexes -- --commit
 *
 * ALWAYS take a `mongodump` before running with --commit.
 */
import path from 'path';
import mongoose from 'mongoose';

require('dotenv').config({ path: path.resolve(__dirname, '../../../../.env') });

// Importing the models registers their schemas (and current index definitions).
import AuditLog from '../../models/AuditLog';
import { ScheduledTaskRun } from '../../models/ScheduledTaskRun';
import Channel from '../../models/Channel';
import { IptvOrgChannel } from '../../models/IptvOrgCache';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const COMMIT = process.argv.includes('--commit');

type IndexInfo = {
  name: string;
  key: Record<string, number>;
  unique?: boolean;
  expireAfterSeconds?: number;
};

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
      const flags = [
        i.unique && 'unique',
        i.expireAfterSeconds !== undefined && `ttl:${i.expireAfterSeconds}s`,
      ]
        .filter(Boolean)
        .join(',');
      return `      ${i.name}${flags ? ` [${flags}]` : ''}`;
    })
    .join('\n');
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
  console.log(`\n=== Migration 0003: sync indexes (${COMMIT ? 'COMMIT' : 'DRY-RUN'}) ===`);
  await mongoose.connect(MONGODB_URI);
  console.log(`Connected: ${MONGODB_URI.replace(/\/\/[^@]*@/, '//***@')}`);

  await syncModel(AuditLog, 'AuditLog');
  await syncModel(ScheduledTaskRun, 'ScheduledTaskRun');
  await syncModel(Channel, 'Channel');
  await syncModel(IptvOrgChannel, 'IptvOrgChannel');

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
