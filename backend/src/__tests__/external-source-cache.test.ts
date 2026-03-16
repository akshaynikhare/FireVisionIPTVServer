import { ExternalSourceCacheMeta, ExternalSourceChannel } from '../models/ExternalSourceCache';
import axios from 'axios';
import type { ProbeResult } from '../services/stream-prober';

// ExternalSourceCacheService is only exported via module.exports
const { ExternalSourceCacheService } = require('../services/external-source-cache');

jest.mock('axios');
jest.mock('../services/stream-prober');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const { probeStream } = jest.requireMock('../services/stream-prober') as {
  probeStream: jest.Mock;
};

beforeEach(() => {
  mockedAxios.get.mockReset();
  probeStream.mockReset();
});

function makeService() {
  return new ExternalSourceCacheService();
}

function makeSamsungMjhResponse(channels: Record<string, any> = {}) {
  return {
    data: {
      slug: 'stvp-{id}',
      regions: {
        us: {
          name: 'United States',
          channels: {
            USBD1000001AA: {
              name: 'Samsung News',
              group: 'News',
              logo: 'https://logo.png',
              description: 'News channel',
            },
            USBD1000002BB: {
              name: 'Samsung Sports',
              group: 'Sports',
              logo: 'https://sports.png',
              description: 'Sports channel',
            },
            USBD1000003CC: {
              name: 'DRM Channel',
              group: 'Movies',
              logo: '',
              description: '',
              license_url: 'https://drm.example.com',
            },
            ...channels,
          },
        },
      },
    },
  };
}

function makePlutoMjhResponse() {
  return {
    data: {
      regions: {
        us: {
          name: 'United States',
          channels: {
            'pluto-ch1': {
              name: 'Pluto News',
              group: 'News',
              logo: 'https://pluto.png',
              description: 'Pluto news',
            },
          },
        },
      },
    },
  };
}

const ALIVE_PROBE: ProbeResult = {
  status: 'alive',
  responseTimeMs: 150,
  statusCode: 200,
  error: null,
  manifestValid: true,
  segmentReachable: true,
  manifestInfo: { isLive: true, hasVideo: true, segmentCount: 5 },
};

const DEAD_PROBE: ProbeResult = {
  status: 'dead',
  responseTimeMs: 0,
  statusCode: 404,
  error: 'Not found',
  manifestValid: false,
  segmentReachable: false,
  manifestInfo: null,
};

// ─── isCacheStale ────────────────────────────────────────────

describe('ExternalSourceCacheService', () => {
  describe('isCacheStale', () => {
    it('returns true when no meta doc exists', async () => {
      const svc = makeService();
      const result = await svc.isCacheStale('samsung-tv-plus', 'us');
      expect(result).toBe(true);
    });

    it('returns true when meta exists but lastRefreshedAt is null', async () => {
      // Insert directly via the collection to bypass Mongoose's required validator.
      // This simulates the real bug: a failed refresh that created a meta doc
      // with refreshInProgress but never set lastRefreshedAt.
      const col = ExternalSourceCacheMeta.collection;
      await col.insertOne({
        cacheKey: 'samsung-tv-plus:us',
        source: 'samsung-tv-plus',
        region: 'us',
        refreshInProgress: false,
        lastRefreshedAt: null,
      });

      const svc = makeService();
      const result = await svc.isCacheStale('samsung-tv-plus', 'us');
      expect(result).toBe(true);
    });

    it('returns false when cache was recently refreshed', async () => {
      await ExternalSourceCacheMeta.create({
        cacheKey: 'samsung-tv-plus:us',
        source: 'samsung-tv-plus',
        region: 'us',
        refreshInProgress: false,
        lastRefreshedAt: new Date(), // just now
      });

      const svc = makeService();
      const result = await svc.isCacheStale('samsung-tv-plus', 'us');
      expect(result).toBe(false);
    });

    it('returns true when cache is older than TTL', async () => {
      await ExternalSourceCacheMeta.create({
        cacheKey: 'samsung-tv-plus:us',
        source: 'samsung-tv-plus',
        region: 'us',
        refreshInProgress: false,
        lastRefreshedAt: new Date(Date.now() - 2 * 3600000), // 2 hours ago
      });

      const svc = makeService();
      const result = await svc.isCacheStale('samsung-tv-plus', 'us');
      expect(result).toBe(true);
    });
  });

  // ─── refreshRegion ───────────────────────────────────────────

  describe('refreshRegion', () => {
    it('fetches Samsung channels from MJH and upserts to DB', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      const result = await svc.refreshRegion('samsung-tv-plus', 'us');

      // 3 channels in MJH response, but 1 has DRM → 2 inserted
      expect(result.channelCount).toBe(2);

      const channels = await ExternalSourceChannel.find({
        source: 'samsung-tv-plus',
        region: 'us',
      });
      expect(channels).toHaveLength(2);

      const names = channels.map((c) => c.channelName).sort();
      expect(names).toEqual(['Samsung News', 'Samsung Sports']);

      // Verify DRM channel was skipped
      const drm = await ExternalSourceChannel.findOne({ channelId: 'USBD1000003CC' });
      expect(drm).toBeNull();
    });

    it('sets liveness to unknown on initial insert', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      const ch = await ExternalSourceChannel.findOne({ channelId: 'USBD1000001AA' });
      expect(ch!.liveness!.status).toBe('unknown');
    });

    it('does not overwrite liveness on re-refresh', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());
      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      // Simulate a liveness check marking channel as alive
      await ExternalSourceChannel.updateOne(
        { channelId: 'USBD1000001AA' },
        { $set: { 'liveness.status': 'alive' } },
      );

      // Re-refresh — should NOT reset liveness
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());
      await svc.refreshRegion('samsung-tv-plus', 'us');

      const ch = await ExternalSourceChannel.findOne({ channelId: 'USBD1000001AA' });
      expect(ch!.liveness!.status).toBe('alive');
    });

    it('creates meta doc with lastRefreshedAt after successful refresh', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      const meta = await ExternalSourceCacheMeta.findOne({ cacheKey: 'samsung-tv-plus:us' });
      expect(meta).not.toBeNull();
      expect(meta!.lastRefreshedAt).toBeInstanceOf(Date);
      expect(meta!.refreshInProgress).toBe(false);
      expect(meta!.channelCount).toBe(2);
    });

    it('stores language as empty string instead of null', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      const ch = await ExternalSourceChannel.findOne({ channelId: 'USBD1000001AA' });
      // language should be '' not null — null breaks the text index
      expect(ch!.language).toBe('');
    });

    it('generates correct Samsung stream URLs using slug template', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      const ch = await ExternalSourceChannel.findOne({ channelId: 'USBD1000001AA' });
      expect(ch!.streamUrl).toBe('https://jmp2.uk/stvp-USBD1000001AA');
    });
  });

  // ─── getChannels ─────────────────────────────────────────────

  describe('getChannels', () => {
    it('triggers refresh when cache is empty and returns channels', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      const channels = await svc.getChannels('samsung-tv-plus', 'us');

      expect(channels.length).toBe(2);
      expect(channels[0].channelName).toBeDefined();
    });

    it('returns channels sorted by name', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      const channels = await svc.getChannels('samsung-tv-plus', 'us');

      const names = channels.map((c: any) => c.channelName);
      expect(names).toEqual([...names].sort());
    });

    it('filters by liveness status', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      // Mark one channel as alive
      await ExternalSourceChannel.updateOne(
        { channelId: 'USBD1000001AA' },
        { $set: { 'liveness.status': 'alive' } },
      );

      const alive = await svc.getChannels('samsung-tv-plus', 'us', { status: 'alive' });
      expect(alive.length).toBe(1);
      expect(alive[0].channelId).toBe('USBD1000001AA');

      const unknown = await svc.getChannels('samsung-tv-plus', 'us', { status: 'unknown' });
      expect(unknown.length).toBe(1);
    });
  });

  // ─── clearCache ──────────────────────────────────────────────

  describe('clearCache', () => {
    beforeEach(async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());
      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');
    });

    it('clears all data when no args', async () => {
      const svc = makeService();
      await svc.clearCache();

      expect(await ExternalSourceChannel.countDocuments()).toBe(0);
      expect(await ExternalSourceCacheMeta.countDocuments()).toBe(0);
    });

    it('clears only specified source', async () => {
      // Add a pluto channel manually
      await ExternalSourceChannel.create({
        source: 'pluto-tv',
        region: 'us',
        channelId: 'p1',
        channelName: 'Pluto Ch',
        streamUrl: '',
      });

      const svc = makeService();
      await svc.clearCache('samsung-tv-plus');

      expect(await ExternalSourceChannel.countDocuments({ source: 'samsung-tv-plus' })).toBe(0);
      expect(await ExternalSourceChannel.countDocuments({ source: 'pluto-tv' })).toBe(1);
    });

    it('clears only specified source + region', async () => {
      // Add samsung channels for another region
      await ExternalSourceChannel.create({
        source: 'samsung-tv-plus',
        region: 'gb',
        channelId: 'gb1',
        channelName: 'GB Channel',
        streamUrl: '',
      });

      const svc = makeService();
      await svc.clearCache('samsung-tv-plus', 'us');

      expect(
        await ExternalSourceChannel.countDocuments({ source: 'samsung-tv-plus', region: 'us' }),
      ).toBe(0);
      expect(
        await ExternalSourceChannel.countDocuments({ source: 'samsung-tv-plus', region: 'gb' }),
      ).toBe(1);
    });
  });

  // ─── checkSingleStream ──────────────────────────────────────

  describe('checkSingleStream', () => {
    it('returns null for non-existent doc', async () => {
      const svc = makeService();
      const result = await svc.checkSingleStream('000000000000000000000000');
      expect(result).toBeNull();
    });

    it('probes stream and updates liveness in DB', async () => {
      const ch = await ExternalSourceChannel.create({
        source: 'samsung-tv-plus',
        region: 'us',
        channelId: 'test1',
        channelName: 'Test',
        streamUrl: 'https://example.com/stream.m3u8',
      });

      probeStream.mockResolvedValueOnce(ALIVE_PROBE);

      const svc = makeService();
      const result = await svc.checkSingleStream(ch._id.toString());

      expect(result).not.toBeNull();
      expect(result!.status).toBe('alive');
      expect(probeStream).toHaveBeenCalledWith('https://example.com/stream.m3u8', {
        timeout: 10000,
      });

      // Verify DB was updated
      const updated = await ExternalSourceChannel.findById(ch._id);
      expect(updated!.liveness!.status).toBe('alive');
      expect(updated!.liveness!.responseTimeMs).toBe(150);
    });

    it('returns dead when stream URL is empty', async () => {
      const ch = await ExternalSourceChannel.create({
        source: 'samsung-tv-plus',
        region: 'us',
        channelId: 'test2',
        channelName: 'No URL',
        streamUrl: '',
      });

      const svc = makeService();
      const result = await svc.checkSingleStream(ch._id.toString());

      expect(result!.status).toBe('dead');
      expect(result!.error).toBe('No stream URL');
      expect(probeStream).not.toHaveBeenCalled();
    });
  });

  // ─── runBatchLivenessCheck ───────────────────────────────────

  describe('runBatchLivenessCheck', () => {
    it('probes all channels and updates liveness stats', async () => {
      // Seed channels
      await ExternalSourceChannel.insertMany([
        {
          source: 'samsung-tv-plus',
          region: 'us',
          channelId: 'b1',
          channelName: 'Ch1',
          streamUrl: 'https://s1.m3u8',
        },
        {
          source: 'samsung-tv-plus',
          region: 'us',
          channelId: 'b2',
          channelName: 'Ch2',
          streamUrl: 'https://s2.m3u8',
        },
        {
          source: 'samsung-tv-plus',
          region: 'us',
          channelId: 'b3',
          channelName: 'Ch3',
          streamUrl: 'https://s3.m3u8',
        },
      ]);
      // Create meta doc so batch check can mark livenessCheckInProgress
      await ExternalSourceCacheMeta.create({
        cacheKey: 'samsung-tv-plus:us',
        source: 'samsung-tv-plus',
        region: 'us',
        lastRefreshedAt: new Date(),
      });

      probeStream
        .mockResolvedValueOnce(ALIVE_PROBE)
        .mockResolvedValueOnce(DEAD_PROBE)
        .mockResolvedValueOnce(ALIVE_PROBE);

      const svc = makeService();
      const result = await svc.runBatchLivenessCheck('samsung-tv-plus', 'us');

      expect(result.checked).toBe(3);
      expect(result.alive).toBe(2);
      expect(result.dead).toBe(1);

      // Verify meta was updated
      const meta = await ExternalSourceCacheMeta.findOne({ cacheKey: 'samsung-tv-plus:us' });
      expect(meta!.livenessCheckInProgress).toBe(false);
      expect(meta!.lastLivenessCheckAt).toBeInstanceOf(Date);
      expect(meta!.livenessStats!.alive).toBe(2);
      expect(meta!.livenessStats!.dead).toBe(1);
    });
  });

  // ─── Region fetchers ────────────────────────────────────────

  describe('getSamsungRegions', () => {
    it('returns regions from MJH data', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      const regions = await svc.getSamsungRegions();

      expect(regions).toHaveLength(1);
      expect(regions[0].code).toBe('us');
      expect(regions[0].name).toBe('United States');
      // 3 total channels in mock data (including DRM one)
      expect(regions[0].channelCount).toBe(3);
    });
  });

  describe('getPlutoRegions', () => {
    it('returns regions from MJH data', async () => {
      mockedAxios.get.mockResolvedValueOnce(makePlutoMjhResponse());

      const svc = makeService();
      const regions = await svc.getPlutoRegions();

      expect(regions).toHaveLength(1);
      expect(regions[0].code).toBe('us');
      expect(regions[0].channelCount).toBe(1);
    });
  });

  // ─── getCacheMeta ────────────────────────────────────────────

  describe('getCacheMeta', () => {
    it('returns null when no meta exists', async () => {
      const svc = makeService();
      const meta = await svc.getCacheMeta('samsung-tv-plus', 'us');
      expect(meta).toBeNull();
    });

    it('returns meta after refresh', async () => {
      mockedAxios.get.mockResolvedValueOnce(makeSamsungMjhResponse());

      const svc = makeService();
      await svc.refreshRegion('samsung-tv-plus', 'us');

      const meta = await svc.getCacheMeta('samsung-tv-plus', 'us');
      expect(meta).not.toBeNull();
      expect(meta!.channelCount).toBe(2);
    });
  });
});
