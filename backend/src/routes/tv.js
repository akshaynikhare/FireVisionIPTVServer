const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Channel = require('../models/Channel');
const PairingRequest = require('../models/PairingRequest');
const { epgService } = require('../services/epg-service');
const { audit } = require('../services/audit-log');

// NO authentication required for TV endpoints

// Shared helper: validate code, find user, update lastLogin
async function findUserByCode(code, res) {
  if (!code || code.length !== 6) {
    res.status(400).json({
      success: false,
      error: 'Invalid channel list code. Code must be 6 characters.',
    });
    return null;
  }
  const user = await User.findOne({
    channelListCode: code.toUpperCase(),
    isActive: true,
  });
  if (!user) {
    res.status(404).json({
      success: false,
      error: 'Invalid or inactive channel list code',
    });
    return null;
  }
  user.lastLogin = new Date();
  await user.save();
  return user;
}

// Get playlist by code (TV App endpoint)
router.get('/playlist/:code', async (req, res) => {
  try {
    const user = await findUserByCode(req.params.code, res);
    if (!user) return;

    // Generate M3U playlist for this user (with EPG URL)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const m3uContent = await user.generateUserPlaylist(baseUrl);

    // Set response headers for M3U
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    const safeUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeUsername}-playlist.m3u"`);
    res.send(m3uContent);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch playlist',
    });
  }
});

// Get playlist as JSON (alternative format for TV apps)
router.get('/playlist/:code/json', async (req, res) => {
  try {
    const user = await findUserByCode(req.params.code, res);
    if (!user) return;

    const Channel = require('../models/Channel');
    let channels;

    if (user.role === 'Admin') {
      // Admin gets all channels
      channels = await Channel.find({}).sort({ channelGroup: 1, order: 1 });
    } else {
      // Regular users get only their assigned channels
      const channelIds = (user.channels || []).filter(Boolean);
      channels = await Channel.find({
        _id: { $in: channelIds },
      }).sort({ channelGroup: 1, order: 1 });
    }

    res.json({
      success: true,
      user: {
        username: user.username,
        channelListCode: user.channelListCode,
      },
      count: channels.length,
      channels: channels,
    });
  } catch (error) {
    console.error('Error fetching playlist JSON:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch playlist',
    });
  }
});

// Resolve proxy URL for a channel (TV app calls this when direct playback fails)
// GET /tv/proxy-url/:code?url=<stream_url>
router.get('/proxy-url/:code', async (req, res) => {
  try {
    const user = await findUserByCode(req.params.code, res);
    if (!user) return;

    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, error: 'url parameter is required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL format' });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const proxyUrl = `${baseUrl}/api/v1/tv/stream/${req.params.code}?url=${encodeURIComponent(url)}`;

    res.json({ success: true, data: { proxyUrl, originalUrl: url } });
  } catch (error) {
    console.error('Error resolving proxy URL:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve proxy URL' });
  }
});

// TV stream proxy — authenticates via channel list code in URL path
// GET /tv/stream/:code?url=<stream_url>
router.get('/stream/:code', async (req, res) => {
  try {
    const user = await findUserByCode(req.params.code, res);
    if (!user) return;

    const { url } = req.query;
    if (!url) {
      return res.status(400).send('URL parameter is required');
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).send('Invalid URL format');
    }

    const { validateUrlForSSRF, isPrivateIP } = require('../utils/ssrf-guard');
    const ssrfCheck = await validateUrlForSSRF(url);
    if (!ssrfCheck.safe) {
      return res.status(403).send(ssrfCheck.reason);
    }

    const axios = require('axios');
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
      },
      maxRedirects: 5,
      beforeRedirect: (options) => {
        const hostname = (options.hostname || '').replace(/^\[|\]$/g, '');
        if (
          isPrivateIP(hostname) ||
          ['localhost', 'metadata.google.internal'].includes(hostname.toLowerCase())
        ) {
          throw new Error('Redirect to private/internal address blocked');
        }
      },
    });

    const finalUrl = response.request?.res?.responseUrl || response.request?.responseURL || url;
    const contentType = (response.headers['content-type'] || '').toLowerCase();
    const isManifest =
      url.includes('.m3u8') ||
      finalUrl.includes('.m3u8') ||
      contentType.includes('mpegurl') ||
      contentType.includes('apple.mpegurl');

    res.set({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Content-Type': isManifest
        ? 'application/vnd.apple.mpegurl'
        : response.headers['content-type'] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    if (isManifest) {
      const MAX_MANIFEST_SIZE = 10 * 1024 * 1024;
      let data = '';
      let dataSize = 0;

      response.data.on('data', (chunk) => {
        dataSize += chunk.length;
        if (dataSize > MAX_MANIFEST_SIZE) {
          response.data.destroy();
          if (!res.headersSent) res.status(413).send('Manifest too large');
          return;
        }
        data += chunk.toString();
      });

      response.data.on('end', () => {
        if (res.headersSent) return;
        const baseUrl = finalUrl.substring(0, finalUrl.lastIndexOf('/') + 1);
        const code = req.params.code;

        function resolveAndProxy(rawUrl) {
          const trimmed = rawUrl.trim();
          if (!trimmed) return trimmed;
          if (trimmed.includes('/api/v1/tv/stream/')) return trimmed;
          let absolute;
          if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
            absolute = trimmed;
          } else if (trimmed.startsWith('/')) {
            try {
              const parsed = new URL(finalUrl);
              absolute = `${parsed.protocol}//${parsed.host}${trimmed}`;
            } catch {
              absolute = baseUrl + trimmed;
            }
          } else {
            absolute = baseUrl + trimmed;
          }
          return `/api/v1/tv/stream/${code}?url=${encodeURIComponent(absolute)}`;
        }

        const lines = data.split('\n');
        const rewrittenLines = lines.map((line) => {
          const trimmedLine = line.trim();
          if (trimmedLine === '') return line;
          if (trimmedLine.startsWith('#')) {
            return line.replace(/URI="([^"]+)"/gi, (match, uri) => {
              return `URI="${resolveAndProxy(uri)}"`;
            });
          }
          return resolveAndProxy(trimmedLine);
        });

        res.send(rewrittenLines.join('\n'));
      });

      response.data.on('error', (error) => {
        console.error('TV stream error:', error);
        if (!res.headersSent) res.status(500).send('Stream error');
      });
    } else {
      response.data.pipe(res);
      response.data.on('error', (error) => {
        console.error('TV stream error:', error);
        if (!res.headersSent) res.status(500).send('Stream error');
      });
    }
  } catch (error) {
    console.error('TV proxy error:', error.message);
    if (res.headersSent) return;
    if (error.response) {
      res.status(error.response.status).send(error.response.statusText);
    } else if (error.code === 'ECONNABORTED') {
      res.status(504).send('Gateway Timeout');
    } else {
      res.status(502).send('Bad Gateway');
    }
  }
});

// Pair device with code (verify code exists)
router.post('/pair', async (req, res) => {
  try {
    const { code, deviceName, deviceModel } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel list code. Code must be 6 characters.',
      });
    }

    // Find user by channel list code
    const user = await User.findOne({
      channelListCode: code.toUpperCase(),
      isActive: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or inactive channel list code',
      });
    }

    // Update device metadata
    user.metadata = user.metadata || {};
    user.metadata.lastPairedDevice = deviceName || 'Unknown Device';
    user.metadata.deviceModel = deviceModel || 'Unknown Model';
    user.metadata.pairedAt = new Date();
    user.lastLogin = new Date();

    await user.save();
    audit({
      userId: String(user._id),
      action: 'pair_device',
      resource: 'pairing',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Device paired successfully',
      data: {
        username: user.username,
        channelListCode: user.channelListCode,
        channelsCount: user.role === 'Admin' ? 'All' : user.channels.length,
      },
    });
  } catch (error) {
    console.error('Error pairing device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pair device',
    });
  }
});

// Verify code (check if valid without pairing)
router.get('/verify/:code', async (req, res) => {
  try {
    const { code } = req.params;

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel list code format',
      });
    }

    const user = await User.findOne({
      channelListCode: code.toUpperCase(),
      isActive: true,
    });

    if (!user) {
      return res.json({
        success: false,
        valid: false,
        message: 'Invalid or inactive code',
      });
    }

    res.json({
      success: true,
      valid: true,
      data: {
        username: user.username,
        role: user.role,
        channelsCount: user.role === 'Admin' ? 'All' : user.channels.length,
      },
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code',
    });
  }
});

// ====================
// EPG (Electronic Program Guide) ENDPOINTS
// ====================

// Get EPG as XMLTV format by channel list code
router.get('/epg/:code', async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 72);
    const user = await findUserByCode(req.params.code, res);
    if (!user) return;

    // Get user's channels
    let channels;
    if (user.role === 'Admin') {
      channels = await Channel.find({}).sort({ channelGroup: 1, order: 1 }).lean();
    } else {
      channels = await Channel.find({
        _id: { $in: user.channels },
      })
        .sort({ channelGroup: 1, order: 1 })
        .lean();
    }

    // Build EPG IDs from channel data (tvgId, channelId, tvgName)
    const epgIds = [];
    const channelInfoMap = new Map();

    for (const ch of channels) {
      const ids = [ch.channelId, ch.tvgId, ch.tvgName].filter(Boolean);
      for (const id of ids) {
        if (!channelInfoMap.has(id)) {
          epgIds.push(id);
          channelInfoMap.set(id, {
            epgId: id,
            name: ch.channelName,
            icon: ch.tvgLogo || ch.channelImg || '',
          });
        }
      }
    }

    // Query EPG programs
    const programs = await epgService.getEpgForChannels(epgIds, hours);

    // Build channel info for XMLTV output (only channels that have programs)
    const activeChannelIds = new Set(programs.map((p) => p.channelEpgId));
    const channelInfos = [];
    for (const id of activeChannelIds) {
      const info = channelInfoMap.get(id);
      if (info) {
        channelInfos.push(info);
      } else {
        channelInfos.push({ epgId: id, name: id, icon: '' });
      }
    }

    const xmltv = epgService.generateXmltv(channelInfos, programs);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(xmltv);
  } catch (error) {
    console.error('Error fetching EPG:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EPG data',
    });
  }
});

// Get EPG as JSON by channel list code
router.get('/epg/:code/json', async (req, res) => {
  try {
    const hours = Math.min(parseInt(req.query.hours) || 24, 72);
    const user = await findUserByCode(req.params.code, res);
    if (!user) return;

    // Get user's channels
    let channels;
    if (user.role === 'Admin') {
      channels = await Channel.find({}).sort({ channelGroup: 1, order: 1 }).lean();
    } else {
      channels = await Channel.find({
        _id: { $in: user.channels },
      })
        .sort({ channelGroup: 1, order: 1 })
        .lean();
    }

    // Build EPG IDs
    const epgIds = [];
    const channelNameMap = new Map();

    for (const ch of channels) {
      const ids = [ch.channelId, ch.tvgId, ch.tvgName].filter(Boolean);
      for (const id of ids) {
        if (!channelNameMap.has(id)) {
          epgIds.push(id);
          channelNameMap.set(id, {
            channelId: ch.channelId,
            channelName: ch.channelName,
            tvgLogo: ch.tvgLogo || ch.channelImg || '',
          });
        }
      }
    }

    const programs = await epgService.getEpgForChannels(epgIds, hours);

    // Group programs by channel
    const grouped = {};
    for (const prog of programs) {
      if (!grouped[prog.channelEpgId]) {
        const info = channelNameMap.get(prog.channelEpgId) || {};
        grouped[prog.channelEpgId] = {
          channelId: prog.channelEpgId,
          channelName: info.channelName || prog.channelEpgId,
          tvgLogo: info.tvgLogo || '',
          programs: [],
        };
      }
      grouped[prog.channelEpgId].programs.push({
        title: prog.title,
        description: prog.description,
        category: prog.category,
        start: prog.startTime,
        end: prog.endTime,
        icon: prog.icon,
        language: prog.language,
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      hours,
      channelCount: Object.keys(grouped).length,
      programCount: programs.length,
      channels: Object.values(grouped),
    });
  } catch (error) {
    console.error('Error fetching EPG JSON:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EPG data',
    });
  }
});

// ====================
// PIN-BASED PAIRING ENDPOINTS
// ====================

// Request new pairing (TV generates PIN)
router.post('/pairing/request', async (req, res) => {
  try {
    const { deviceName, deviceModel } = req.body;

    // Get pairing expiry from environment (default 10 minutes)
    const expiryMinutes = parseInt(process.env.PAIRING_PIN_EXPIRY_MINUTES || '10', 10);
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // Generate unique PIN
    const pin = await PairingRequest.generatePin();

    // Create pairing request
    const pairingRequest = new PairingRequest({
      pin,
      deviceName: deviceName || 'Android TV',
      deviceModel: deviceModel || 'Unknown Model',
      status: 'pending',
      expiresAt,
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    await pairingRequest.save();
    audit({
      action: 'pairing_request',
      resource: 'pairing',
      resourceId: pin,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    console.log(`Pairing request created: PIN ${pin}, expires at ${expiresAt}`);

    res.json({
      success: true,
      pin,
      expiresAt,
      expiryMinutes,
      message: 'Enter this PIN on the web dashboard to pair your device',
    });
  } catch (error) {
    console.error('Error creating pairing request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pairing request',
    });
  }
});

// Confirm pairing (Web dashboard links user to PIN)
router.post('/pairing/confirm', async (req, res) => {
  try {
    const { pin } = req.body;

    console.log('Pairing confirmation attempt:', {
      pin,
      hasBody: !!req.body,
      hasHeader: !!req.headers['x-session-id'],
    });

    if (!pin || pin.length !== 6) {
      console.warn('Invalid PIN format:', pin);
      return res.status(400).json({
        success: false,
        error: 'Invalid PIN format. PIN must be 6 digits.',
      });
    }

    // Get session ID from header or body
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;

    if (!sessionId) {
      console.warn('No session ID provided in pairing request');
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please log in.',
      });
    }

    // Verify session and get user
    const Session = require('../models/Session');
    const session = await Session.findOne({ sessionId }).populate('userId');

    if (!session || !session.userId) {
      console.warn('Session not found or has no user:', sessionId);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please log in again.',
      });
    }

    // Check if session is still valid
    if (!session.isValid()) {
      console.warn('Session expired for user:', session.username);
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'Session has expired. Please log in again.',
      });
    }

    const user = session.userId;
    console.log(`User authenticated for pairing: ${user.username} (${user.role})`);

    // Find pairing request
    const pairingRequest = await PairingRequest.findOne({
      pin: pin.toString(),
      status: 'pending',
    });

    if (!pairingRequest) {
      console.warn('PIN not found or not pending:', pin);
      return res.status(404).json({
        success: false,
        error:
          'Invalid or expired PIN. The TV may have generated a new PIN or the PIN has already been used.',
      });
    }

    // Check if expired
    if (pairingRequest.isExpired()) {
      console.warn('PIN expired:', pin);
      await pairingRequest.markExpired();
      return res.status(400).json({
        success: false,
        error: 'PIN has expired. Please generate a new one on your TV.',
      });
    }

    // Link user to pairing request
    pairingRequest.userId = user._id;
    pairingRequest.status = 'completed';
    await pairingRequest.save();

    // Update user metadata
    user.metadata = user.metadata || {};
    user.metadata.lastPairedDevice = pairingRequest.deviceName;
    user.metadata.deviceModel = pairingRequest.deviceModel;
    user.metadata.pairedAt = new Date();
    user.lastLogin = new Date();
    await user.save();

    audit({
      userId: String(user._id),
      action: 'pairing_confirm',
      resource: 'pairing',
      resourceId: pin,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    console.log(
      `✅ Pairing confirmed: PIN ${pin} linked to user ${user.username} (${user.channelListCode})`,
    );

    res.json({
      success: true,
      message: 'Device paired successfully',
      device: {
        name: pairingRequest.deviceName,
        model: pairingRequest.deviceModel,
      },
      user: {
        username: user.username,
        channelListCode: user.channelListCode,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('❌ Error confirming pairing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to confirm pairing. Please try again.',
    });
  }
});

// Check pairing status (TV polls this endpoint)
router.get('/pairing/status/:pin', async (req, res) => {
  try {
    const { pin } = req.params;

    if (!pin || pin.length !== 6) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PIN format',
      });
    }

    // Find pairing request
    const pairingRequest = await PairingRequest.findOne({
      pin: pin.toString(),
    }).populate('userId');

    if (!pairingRequest) {
      return res.json({
        success: false,
        paired: false,
        status: 'invalid',
        message: 'PIN not found',
      });
    }

    // Check if expired
    if (pairingRequest.isExpired() && pairingRequest.status === 'pending') {
      await pairingRequest.markExpired();
      return res.json({
        success: false,
        paired: false,
        status: 'expired',
        message: 'PIN has expired. Please request a new one.',
      });
    }

    // Check if completed
    if (pairingRequest.status === 'completed' && pairingRequest.userId) {
      const user = pairingRequest.userId;
      return res.json({
        success: true,
        paired: true,
        status: 'completed',
        channelListCode: user.channelListCode,
        username: user.username,
        role: user.role,
        message: 'Device paired successfully!',
      });
    }

    // Still pending
    res.json({
      success: true,
      paired: false,
      status: 'pending',
      expiresAt: pairingRequest.expiresAt,
      message: 'Waiting for user to confirm pairing on web dashboard...',
    });
  } catch (error) {
    console.error('Error checking pairing status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check pairing status',
    });
  }
});

module.exports = router;
