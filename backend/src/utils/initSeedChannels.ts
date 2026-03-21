import { SeedChannel } from '../models/SeedChannel';
import seedData from '../data/free-source-seeds.json';

interface SeedEntry {
  source: string;
  channelName: string;
  ytChannelId?: string;
  directUrl?: string;
  tvgLogo?: string;
  groupTitle?: string;
  language?: string;
}

async function initializeSeedChannels(): Promise<void> {
  try {
    const entries = seedData as SeedEntry[];
    let created = 0;

    for (const entry of entries) {
      const filter: Record<string, string> = { source: entry.source };
      if (entry.ytChannelId) filter.ytChannelId = entry.ytChannelId;
      else if (entry.directUrl) filter.directUrl = entry.directUrl;
      else continue;

      const exists = await SeedChannel.findOne(filter);
      if (!exists) {
        const doc: Record<string, any> = {
          source: entry.source,
          channelName: entry.channelName,
          tvgLogo: entry.tvgLogo || '',
          groupTitle: entry.groupTitle || 'Uncategorized',
          language: entry.language || '',
          enabled: true,
        };
        // Only set ytChannelId/directUrl when present — sparse index requires
        // the field to be absent (not null) so multiple docs can coexist
        if (entry.ytChannelId) doc.ytChannelId = entry.ytChannelId;
        if (entry.directUrl) doc.directUrl = entry.directUrl;
        await SeedChannel.create(doc);
        created++;
      }
    }

    if (created > 0) {
      console.log(`[seed-channels] Created ${created} seed channels from JSON`);
    } else {
      console.log('[seed-channels] All seed channels already exist');
    }
  } catch (error) {
    console.error('[seed-channels] Initialization failed:', (error as Error).message);
  }
}

module.exports = { initializeSeedChannels };
export { initializeSeedChannels };
