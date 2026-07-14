import Channel from '../models/Channel';
import { IptvOrgChannel } from '../models/IptvOrgCache';
import {
  clubByChannelId,
  resolveChannelGroups,
  dedupAgainstCatalog,
  capChannelAdditions,
  patternCategory,
  extractExtinfTitle,
  repairLeakedExtinfName,
} from '../services/import-helpers';

describe('import-helpers', () => {
  describe('clubByChannelId', () => {
    it('folds same tvg-id entries into alternateStreams', () => {
      const out = clubByChannelId([
        { channelId: 'BBC.uk', channelName: 'BBC', channelUrl: 'http://a' },
        { channelId: 'BBC.uk', channelName: 'BBC', channelUrl: 'http://b' },
        { channelId: 'CNN.us', channelName: 'CNN', channelUrl: 'http://c' },
      ]);
      expect(out).toHaveLength(2);
      const bbc = out.find((c) => c.channelId === 'BBC.uk');
      expect(bbc.channelUrl).toBe('http://a');
      expect(bbc.alternateStreams).toHaveLength(1);
      expect(bbc.alternateStreams[0].streamUrl).toBe('http://b');
    });

    it('never clubs synthetic channel_* ids (no tvg-id)', () => {
      const out = clubByChannelId([
        { channelId: 'channel_1', channelName: 'X', channelUrl: 'http://a' },
        { channelId: 'channel_2', channelName: 'X', channelUrl: 'http://b' },
      ]);
      expect(out).toHaveLength(2);
    });

    it('does not duplicate an identical alternate URL', () => {
      const out = clubByChannelId([
        { channelId: 'BBC.uk', channelUrl: 'http://a' },
        { channelId: 'BBC.uk', channelUrl: 'http://a' },
      ]);
      expect(out).toHaveLength(1);
      expect(out[0].alternateStreams || []).toHaveLength(0);
    });
  });

  describe('resolveChannelGroups', () => {
    it('categorizes Uncategorized channels by iptv-org id then name (case-insensitive)', async () => {
      await IptvOrgChannel.create({
        channelId: 'BBCNews.uk',
        channelName: 'BBC News',
        streamUrl: 'http://s',
        categories: ['news'],
      });
      const chans = [
        { channelId: 'BBCNews.uk', channelName: 'BBC News', channelGroup: 'Uncategorized' },
        { channelId: 'channel_9', channelName: 'bbc news', channelGroup: 'Uncategorized' },
        { channelId: 'x', channelName: 'Unknown Chan', channelGroup: 'Uncategorized' },
      ];
      const resolved = await resolveChannelGroups(chans);
      expect(resolved).toBe(2);
      expect(chans[0].channelGroup).toBe('news'); // matched by id
      expect(chans[1].channelGroup).toBe('news'); // matched by normalized name
      expect(chans[2].channelGroup).toBe('Uncategorized'); // no match — left as-is
    });

    it('does not overwrite a group that was already set', async () => {
      await IptvOrgChannel.create({
        channelId: 'A.uk',
        channelName: 'A',
        streamUrl: 'http://s',
        categories: ['news'],
      });
      const chans = [{ channelId: 'A.uk', channelName: 'A', channelGroup: 'Sports' }];
      await resolveChannelGroups(chans);
      expect(chans[0].channelGroup).toBe('Sports');
    });
  });

  describe('extractExtinfTitle', () => {
    it('handles commas inside tvg-logo URLs (Cloudinary transforms)', () => {
      const line =
        '#EXTINF:-1 tvg-id="ts1444" tvg-logo="https://res.cloudinary.com/x/image/fetch/fl_lossy,q_auto,h_250,w_250/https://cdn.example.com/TPMARCLS_Thumbnail.png",Tata Play Marathi Classics';
      expect(extractExtinfTitle(line)).toBe('Tata Play Marathi Classics');
    });

    it('handles commas inside user-agent attributes', () => {
      const line =
        '#EXTINF:-1 tvg-id="24TV.tr" http-user-agent="Mozilla/5.0 (KHTML, like Gecko) Chrome/76.0" group-title="News",24 TV (1080p)';
      expect(extractExtinfTitle(line)).toBe('24 TV (1080p)');
    });

    it('handles plain lines without attributes', () => {
      expect(extractExtinfTitle('#EXTINF:-1,Simple Channel')).toBe('Simple Channel');
    });

    it('keeps commas that are part of the actual title', () => {
      expect(extractExtinfTitle('#EXTINF:-1 tvg-id="x",News, Weather & Sports')).toBe(
        'News, Weather & Sports',
      );
    });

    it('returns empty string when no title separator exists', () => {
      expect(extractExtinfTitle('#EXTINF:-1 tvg-id="x"')).toBe('');
    });
  });

  describe('repairLeakedExtinfName', () => {
    it('repairs a name with a leaked logo URL', () => {
      expect(
        repairLeakedExtinfName(
          'fl_lossy,q_auto,h_250,w_250/https://cdn.example.com/x.png",Tata Play Marathi Classics',
        ),
      ).toBe('Tata Play Marathi Classics');
    });

    it('repairs a name with leaked user-agent attributes', () => {
      expect(
        repairLeakedExtinfName(
          'like Gecko Chrome/76.0.3809.25 Safari/537.36" group-title="News",24 TV (1080p)',
        ),
      ).toBe('24 TV (1080p)');
    });

    it('leaves a legitimate title containing quote-comma untouched', () => {
      expect(repairLeakedExtinfName('Show "Name", Extended')).toBeNull();
    });

    it('returns null when there is no quote-comma at all', () => {
      expect(repairLeakedExtinfName('Plain Channel Name')).toBeNull();
    });
  });

  describe('patternCategory', () => {
    it.each([
      ['Enlightened S01 E09', 'series'],
      ['Bored to Death S02E06', 'series'],
      ['Camp Crasher (2024)', 'movies'],
      ['Warten auf Bojangles (2021)', 'movies'],
      ['DE: Sky Bundesliga 7 FHD', 'sports'], // keyword beats prefix
      ['USA: FOX NEWS CHANNEL', 'news'],
      ['FR: USHUAIA TV', 'FR'], // no keyword → country prefix
      ['CL: TVO Tocopilla', 'CL'],
      ['MT: Smash Movies', 'movies'],
      ['Some Random Channel', null], // unsure → null, stays Uncategorized
      ['', null],
    ])('%s → %s', (name, expected) => {
      expect(patternCategory(name)).toBe(expected);
    });
  });

  describe('capChannelAdditions', () => {
    afterEach(() => {
      delete process.env.USER_CHANNELS_MAX;
    });

    it('allows everything when under the limit', () => {
      process.env.USER_CHANNELS_MAX = '10';
      expect(capChannelAdditions(3, ['a', 'b'])).toEqual({ allowed: ['a', 'b'], rejected: 0 });
    });

    it('trims additions to the remaining room', () => {
      process.env.USER_CHANNELS_MAX = '5';
      expect(capChannelAdditions(4, ['a', 'b', 'c'])).toEqual({ allowed: ['a'], rejected: 2 });
    });

    it('rejects all additions for an over-limit legacy user (but never throws)', () => {
      process.env.USER_CHANNELS_MAX = '5';
      expect(capChannelAdditions(19898, ['a'])).toEqual({ allowed: [], rejected: 1 });
    });
  });

  describe('dedupAgainstCatalog', () => {
    it('drops URLs already in the catalog and within-batch duplicates', async () => {
      await Channel.create({
        channelId: 'existing',
        channelName: 'E',
        channelUrl: 'http://dup',
        ownerId: null,
      });
      const out = await dedupAgainstCatalog([
        { channelId: 'a', channelName: 'A', channelUrl: 'http://dup' }, // already in catalog
        { channelId: 'b', channelName: 'B', channelUrl: 'http://new' }, // new
        { channelId: 'c', channelName: 'C', channelUrl: 'http://new' }, // within-batch dupe
      ]);
      expect(out.map((c) => c.channelUrl)).toEqual(['http://new']);
    });
  });
});
