const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const {
  signAccessToken,
  signRefreshToken,
  persistRefreshToken,
  hashToken,
} = require('../utils/jwtUtil');

const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!REFRESH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_REFRESH_SECRET is required in production');
}
const effectiveRefreshSecret = REFRESH_SECRET || 'dev-refresh-secret-change-me';

// Use shared middleware instead of duplicating
const { requireJwtAuth } = require('../middleware/requireJwtAuth');

// Login (password) -> JWT tokens
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password required' });
    }
    const user = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    user.lastLogin = new Date();
    await user.save();
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(refreshToken, user, req);
    return res.json({
      success: true,
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        channelListCode: user.channelListCode,
      },
    });
  } catch (e) {
    console.error('JWT login error', e);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Refresh endpoint
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken required' });
    }
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, effectiveRefreshSecret);
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });
    if (!tokenDoc || !tokenDoc.isActive()) {
      return res.status(401).json({ success: false, error: 'Refresh token inactive' });
    }
    const user = await User.findById(decoded.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'User inactive' });
    }
    const newAccess = signAccessToken(user);
    return res.json({ success: true, accessToken: newAccess });
  } catch (e) {
    console.error('Refresh error', e);
    return res.status(500).json({ success: false, error: 'Refresh failed' });
  }
});

// Revoke refresh token
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken required' });
    }
    try {
      jwt.verify(refreshToken, effectiveRefreshSecret);
    } catch {
      return res.status(200).json({ success: true, message: 'Already invalid' });
    }
    const tokenHash = hashToken(refreshToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });
    if (tokenDoc && !tokenDoc.revokedAt) {
      tokenDoc.revokedAt = new Date();
      await tokenDoc.save();
    }
    return res.json({ success: true, message: 'Logged out' });
  } catch (e) {
    console.error('Logout error', e);
    return res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// Current user via JWT
router.get('/me', requireJwtAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    return res.json({ success: true, user });
  } catch (e) {
    console.error('Me error', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch user' });
  }
});

// User channel list (M3U) via JWT
router.get('/playlist.m3u', requireJwtAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).send('#EXTM3U\n#ERROR:User not found');
    }
    const m3u = await user.generateUserPlaylist();
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    const safeUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="${safeUsername}-channels.m3u"`);
    return res.send(m3u);
  } catch (e) {
    console.error('Channel list m3u error', e);
    return res.status(500).send('#EXTM3U\n#ERROR:Internal error');
  }
});

module.exports = { router, requireJwtAuth };
