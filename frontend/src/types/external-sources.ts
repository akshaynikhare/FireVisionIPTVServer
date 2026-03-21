export interface ChannelLiveness {
  status: 'alive' | 'dead' | 'unknown';
  lastCheckedAt?: string | null;
  responseTimeMs?: number | null;
  error?: string | null;
}

export interface SourceChannel {
  _uid: string;
  channelId: string;
  channelName: string;
  channelUrl: string;
  tvgLogo?: string;
  groupTitle?: string;
  country?: string;
  source?: string;
  summary?: string;
  codec?: string;
  bitrate?: number;
  language?: string;
  votes?: number;
  homepage?: string;
  liveness?: ChannelLiveness;
}

export interface Region {
  code: string;
  name: string;
  channelCount?: number;
}

export interface LivenessStats {
  alive: number;
  dead: number;
  unknown: number;
}

export type SourceTab = 'pluto-tv' | 'samsung-tv-plus' | 'youtube-live' | 'prasar-bharati';

export interface SeedChannel {
  _id: string;
  ytChannelId?: string;
  directUrl?: string;
  channelName: string;
  tvgLogo: string;
  groupTitle: string;
  language: string;
  enabled: boolean;
  source: 'youtube-live' | 'prasar-bharati';
  createdAt: string;
  updatedAt: string;
}

export const COUNTRY_NAMES: Record<string, string> = {
  us: 'United States',
  gb: 'United Kingdom',
  de: 'Germany',
  fr: 'France',
  es: 'Spain',
  it: 'Italy',
  br: 'Brazil',
  mx: 'Mexico',
  ca: 'Canada',
  at: 'Austria',
  ch: 'Switzerland',
  dk: 'Denmark',
  no: 'Norway',
  se: 'Sweden',
  ar: 'Argentina',
  cl: 'Chile',
  in: 'India',
  kr: 'South Korea',
  au: 'Australia',
};

export function regionDisplayName(r: Region): string {
  if (r.name && r.name !== r.code.toUpperCase()) return r.name;
  return COUNTRY_NAMES[r.code.toLowerCase()] || r.code.toUpperCase();
}
