import { IptvOrgChannel } from '../models/IptvOrgCache';

const norm = (s?: string): string => (s || '').toLowerCase().trim();

/**
 * Rule-based category from near-deterministic name patterns — provider/Xtream playlist dumps
 * mix VOD (series episodes "S01 E09", movies "(2021)") and country-prefixed feeds ("DE: …")
 * with no group-title. Conservative by design: returns null when unsure.
 */
export function patternCategory(name?: string): string | null {
  const n = (name || '').trim();
  if (!n) return null;
  // VOD markers first — unambiguous
  if (/\bs\d{1,2}\s*[·.\- ]?\s*e\d{1,3}\b/i.test(n)) return 'series';
  if (/\((19|20)\d{2}\)\s*$/.test(n)) return 'movies';
  // Genre keywords
  const l = n.toLowerCase();
  if (/\b(sports?|espn|eurosport|bundesliga|dazn|bein)\b/.test(l)) return 'sports';
  if (/\bnews\b/.test(l)) return 'news';
  if (/\b(movies?|cinema|kino|film)\b/.test(l)) return 'movies';
  if (/\b(kids|cartoon|junior|disney)\b/.test(l)) return 'kids';
  if (/\b(music|mtv|hits)\b/.test(l)) return 'music';
  if (/\b(documentary|discovery|natgeo|history)\b/.test(l)) return 'documentary';
  // Country-code prefix ("DE: Sky …", "USA: FOX …") → group by country code
  const cc = n.match(/^([A-Z]{2,3})\s*[:|]/);
  if (cc) return cc[1];
  return null;
}

// A synthetic channelId is minted when an M3U line has no tvg-id; these are unique per row
// and must never be treated as the same logical channel (no clubbing, no id-based category match).
const isSynthetic = (id?: string): boolean => !id || id.startsWith('channel_');

/**
 * Resolve a channelGroup for channels that would otherwise be 'Uncategorized', by matching
 * against the iptv-org cache — first by tvg-id/channelId, then by normalized name. Mutates each
 * channel in place and returns how many were resolved. Unmatched channels keep 'Uncategorized'.
 * This is why imports stop producing a mostly-uncategorized catalog.
 */
export async function resolveChannelGroups(channels: any[]): Promise<number> {
  const needsGroup = channels.filter((c) => !c.channelGroup || c.channelGroup === 'Uncategorized');
  if (needsGroup.length === 0) return 0;

  const catalog: any[] = await IptvOrgChannel.find(
    {},
    { channelId: 1, channelName: 1, categories: 1 },
  ).lean();

  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const m of catalog) {
    const cat = m.categories?.[0];
    if (!cat) continue;
    if (m.channelId && !byId.has(m.channelId)) byId.set(m.channelId, cat);
    const n = norm(m.channelName);
    if (n && !byName.has(n)) byName.set(n, cat);
  }

  let resolved = 0;
  for (const c of needsGroup) {
    const cat =
      (!isSynthetic(c.channelId) && byId.get(c.channelId)) ||
      byName.get(norm(c.channelName)) ||
      patternCategory(c.channelName);
    if (cat) {
      c.channelGroup = cat;
      resolved++;
    }
  }
  return resolved;
}

/**
 * Collapse parsed channels that share a real tvg-id into one channel + alternateStreams
 * (capped at 50). Synthetic ids are treated as unique (never clubbed). Returns the deduped list —
 * so a multi-stream import yields one channel with fallbacks instead of N separate rows.
 */
export function clubByChannelId(channels: any[]): any[] {
  const result: any[] = [];
  const byId = new Map<string, any>();

  for (const ch of channels) {
    if (isSynthetic(ch.channelId) || !byId.has(ch.channelId)) {
      if (!isSynthetic(ch.channelId)) byId.set(ch.channelId, ch);
      result.push(ch);
      continue;
    }
    // Same logical channel already seen — fold this URL in as an alternate.
    const primary = byId.get(ch.channelId);
    if (ch.channelUrl && ch.channelUrl !== primary.channelUrl) {
      primary.alternateStreams = primary.alternateStreams || [];
      if (
        primary.alternateStreams.length < 50 &&
        !primary.alternateStreams.some((a: any) => a.streamUrl === ch.channelUrl)
      ) {
        primary.alternateStreams.push({ streamUrl: ch.channelUrl, source: 'import' });
      }
    }
  }
  return result;
}

/**
 * Extract the display title from an #EXTINF line — the text after the comma FOLLOWING the
 * attribute list. A naive /,(.+)$/ grabs the FIRST comma, which corrupts the name whenever an
 * attribute value contains commas (Cloudinary tvg-logo URLs "fl_lossy,q_auto,...", user-agent
 * strings "(KHTML, like Gecko)"). Searching from the last closing quote skips all attributes.
 */
export function extractExtinfTitle(line: string): string {
  const lastQuote = line.lastIndexOf('"');
  const commaIdx = line.indexOf(',', lastQuote >= 0 ? lastQuote : 0);
  return commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '';
}

/**
 * Cap how many channel refs can be added to a user's channels[] (route-level, not a schema
 * validator — a validator would brick over-limit legacy users on ANY save, even removals).
 * This pre-check is best-effort under concurrency (the count is a snapshot); pair $addToSet
 * updates with withChannelCapFilter() below for an atomic backstop.
 */
export function capChannelAdditions(
  currentCount: number,
  ids: any[],
): { allowed: any[]; rejected: number } {
  const max = Number(process.env.USER_CHANNELS_MAX) || 5000;
  const room = Math.max(0, max - currentCount);
  if (ids.length <= room) return { allowed: ids, rejected: 0 };
  return { allowed: ids.slice(0, room), rejected: ids.length - room };
}

/**
 * Update filter enforcing the channels cap atomically at write time — closes the window
 * where two concurrent imports both observe room and overshoot USER_CHANNELS_MAX.
 * The update matches nothing (matchedCount 0) when the addition would exceed the cap.
 */
export function withChannelCapFilter(userId: any, addCount: number): Record<string, any> {
  const max = Number(process.env.USER_CHANNELS_MAX) || 5000;
  return {
    _id: userId,
    $expr: { $lte: [{ $size: { $ifNull: ['$channels', []] } }, max - addCount] },
  };
}

/**
 * Repair a channel name corrupted by the old first-comma EXTINF parse. Only rewrites when
 * the prefix before the last `",` shows attribute leakage (a quoted attribute or a URL) —
 * a legitimate title like `Show "Name", Extended` is left untouched.
 */
export function repairLeakedExtinfName(name: string): string | null {
  const idx = name.lastIndexOf('",');
  if (idx < 0) return null;
  const prefix = name.slice(0, idx);
  if (!prefix.includes('="') && !prefix.includes('://')) return null;
  const fixed = name.slice(idx + 2).trim();
  return fixed && fixed !== name ? fixed : null;
}

/**
 * Remove channels whose URL already exists in the shared catalog (ownerId:null), and de-dup
 * within the batch itself. Prevents re-imports from re-creating duplicate catalog rows.
 */
export async function dedupAgainstCatalog(channels: any[]): Promise<any[]> {
  const Channel = require('../models/Channel');

  const seen = new Set<string>();
  const batch = channels.filter((c) => {
    if (!c.channelUrl || seen.has(c.channelUrl)) return false;
    seen.add(c.channelUrl);
    return true;
  });
  if (batch.length === 0) return batch;

  const existing: any[] = await Channel.find(
    { ownerId: null, channelUrl: { $in: batch.map((c) => c.channelUrl) } },
    { channelUrl: 1 },
  ).lean();
  const existingUrls = new Set(existing.map((c) => c.channelUrl));
  return batch.filter((c) => !existingUrls.has(c.channelUrl));
}

module.exports = {
  resolveChannelGroups,
  clubByChannelId,
  dedupAgainstCatalog,
  capChannelAdditions,
  withChannelCapFilter,
  repairLeakedExtinfName,
  patternCategory,
  extractExtinfTitle,
};
