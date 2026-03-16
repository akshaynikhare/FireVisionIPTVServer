const express = require('express');
const router = express.Router();
const axios = require('axios');
const Channel = require('../models/Channel');
const { requireAuth } = require('./auth');

router.use(requireAuth);

// Cache with TTL
const cache = {};
const CACHE_TTL = 3600000; // 1 hour

function getCached(key) {
  const entry = cache[key];
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache[key] = { data, timestamp: Date.now() };
}

// ─── Pluto TV ──────────────────────────────────────────────
const PLUTO_REGIONS = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' },
  { code: 'it', name: 'Italy' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
  { code: 'ca', name: 'Canada' },
  { code: 'at', name: 'Austria' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'dk', name: 'Denmark' },
  { code: 'no', name: 'Norway' },
  { code: 'se', name: 'Sweden' },
];

router.get('/pluto-tv/regions', (req, res) => {
  res.json({ success: true, data: PLUTO_REGIONS });
});

router.get('/pluto-tv/channels', async (req, res) => {
  try {
    const country = (req.query.country || 'us').toLowerCase();
    const cacheKey = `pluto_${country}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const response = await axios.get(
      `https://boot.pluto.tv/v4/start?channelSlug=*&appName=web&appVersion=9&deviceMake=Chrome&deviceModel=web&deviceType=web&deviceVersion=131&appName=web&clientModelNumber=1.0.0&serverSideAds=false&clientID=1&country=${country.toUpperCase()}`,
      { timeout: 15000 }
    );

    const channels = (response.data.channels || []).map((ch) => ({
      channelId: ch.slug || ch._id,
      channelName: ch.name,
      channelUrl: ch.stitched?.urls?.[0]?.url || '',
      tvgLogo: ch.colorLogoPNG?.url || ch.logo?.url || ch.thumbnail?.url || '',
      groupTitle: ch.category || 'Uncategorized',
      country: country.toUpperCase(),
      source: 'pluto-tv',
      summary: ch.summary || '',
    }));

    // Filter out channels without stream URLs
    const validChannels = channels.filter((ch) => ch.channelUrl);
    setCache(cacheKey, validChannels);
    res.json({ success: true, data: validChannels });
  } catch (error) {
    console.error('Pluto TV fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Pluto TV channels' });
  }
});

// ─── Samsung TV Plus ───────────────────────────────────────
const SAMSUNG_REGIONS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'IN', name: 'India' },
  { code: 'KR', name: 'South Korea' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
];

router.get('/samsung-tv-plus/regions', (req, res) => {
  res.json({ success: true, data: SAMSUNG_REGIONS });
});

router.get('/samsung-tv-plus/channels', async (req, res) => {
  try {
    const country = (req.query.country || 'US').toUpperCase();
    const cacheKey = `samsung_${country}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached, fromCache: true });

    const response = await axios.get(
      `https://api.samsungtvplus.com/content/v3/channel-list/${country}`,
      {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    const rawChannels = response.data?.channels || response.data?.data?.channels || response.data || [];
    const channelList = Array.isArray(rawChannels) ? rawChannels : [];

    const channels = channelList.map((ch) => ({
      channelId: ch.channelId || ch.id || ch.slug || '',
      channelName: ch.channelName || ch.title || ch.name || '',
      channelUrl: ch.mediaUrl || ch.streamUrl || ch.url || '',
      tvgLogo: ch.channelLogoUrl || ch.logo || ch.thumbnail || '',
      groupTitle: ch.genreName || ch.category || ch.genre || 'Uncategorized',
      country: country,
      source: 'samsung-tv-plus',
      summary: ch.description || '',
    }));

    const validChannels = channels.filter((ch) => ch.channelName);
    setCache(cacheKey, validChannels);
    res.json({ success: true, data: validChannels });
  } catch (error) {
    console.error('Samsung TV Plus fetch error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch Samsung TV Plus channels' });
  }
});

// ─── Radio Browser ─────────────────────────────────────────
const RADIO_BROWSER_BASE = 'https://de1.api.radio-browser.info/json';

router.get('/radio-browser/countries', async (req, res) => {
  try {
    const cacheKey = 'radio_countries';
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached });

    const response = await axios.get(`${RADIO_BROWSER_BASE}/countries?hidebroken=true&order=stationcount&reverse=true`, {
      timeout: 10000,
    });

    // Return top 50 countries with most stations
    const countries = (response.data || [])
      .filter((c) => c.stationcount > 10)
      .slice(0, 50)
      .map((c) => ({
        code: c.iso_3166_1,
        name: c.name,
        stationCount: c.stationcount,
      }));

    setCache(cacheKey, countries);
    res.json({ success: true, data: countries });
  } catch (error) {
    console.error('Radio Browser countries error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

router.get('/radio-browser/stations', async (req, res) => {
  try {
    const { country, tag, search, limit = '100', offset = '0' } = req.query;
    const params = new URLSearchParams({
      hidebroken: 'true',
      order: 'votes',
      reverse: 'true',
      limit: String(Math.min(parseInt(limit) || 100, 500)),
      offset: String(parseInt(offset) || 0),
    });

    let endpoint = '/stations/search';
    if (country) params.set('country', country);
    if (tag) params.set('tag', tag);
    if (search) params.set('name', search);

    const cacheKey = `radio_${endpoint}_${params.toString()}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ success: true, data: cached.channels, total: cached.total, fromCache: true });

    const response = await axios.get(`${RADIO_BROWSER_BASE}${endpoint}?${params.toString()}`, {
      timeout: 10000,
    });

    const stations = (response.data || []).map((st) => ({
      channelId: st.stationuuid,
      channelName: st.name,
      channelUrl: st.url_resolved || st.url,
      tvgLogo: st.favicon || '',
      groupTitle: st.tags ? st.tags.split(',')[0].trim() : 'Radio',
      country: st.country || '',
      source: 'radio-browser',
      summary: `${st.codec || ''} ${st.bitrate ? st.bitrate + 'kbps' : ''} | ${st.language || ''} | Votes: ${st.votes || 0}`.trim(),
      codec: st.codec,
      bitrate: st.bitrate,
      language: st.language,
      votes: st.votes,
      homepage: st.homepage,
    }));

    setCache(cacheKey, { channels: stations, total: stations.length });
    res.json({ success: true, data: stations, total: stations.length });
  } catch (error) {
    console.error('Radio Browser stations error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch radio stations' });
  }
});

// ─── Import to System ──────────────────────────────────────
router.post('/import', async (req, res) => {
  try {
    const { channels, replaceExisting } = req.body;
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({ success: false, error: 'No channels provided' });
    }

    if (replaceExisting) {
      await Channel.deleteMany({});
    }

    const docs = channels.map((ch) => ({
      channelName: ch.channelName,
      channelUrl: ch.channelUrl,
      tvgLogo: ch.tvgLogo || '',
      channelGroup: ch.groupTitle || ch.channelGroup || 'Imported',
      channelId: ch.channelId || '',
    }));

    const result = await Channel.insertMany(docs, { ordered: false }).catch((err) => {
      if (err.insertedDocs) return err.insertedDocs;
      throw err;
    });

    const count = Array.isArray(result) ? result.length : 0;
    res.json({
      success: true,
      message: `Imported ${count} channels to system`,
      importedCount: count,
    });
  } catch (error) {
    console.error('External sources import error:', error.message);
    res.status(500).json({ success: false, error: 'Import failed: ' + error.message });
  }
});

// ─── Clear Cache ───────────────────────────────────────────
router.post('/clear-cache', (req, res) => {
  Object.keys(cache).forEach((key) => delete cache[key]);
  res.json({ success: true, message: 'Cache cleared' });
});

module.exports = router;
