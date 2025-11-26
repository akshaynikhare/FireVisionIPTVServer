const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Playlist = require('../models/Playlist');
const { signAccessToken, signRefreshToken, persistRefreshToken } = require('../utils/jwtUtil');

// Environment config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || '';

// Helper: generate random password (User model requires one)
function generateRandomPassword() {
  return Math.random().toString(36).slice(-10) + 'Aa1!';
}

// Helper: create user + playlist if new
async function ensureUserAndPlaylist(findCriteria, baseProfile) {
  let user = await User.findOne(findCriteria);
  if (!user) {
    const playlistCode = await User.generatePlaylistCode();
    user = new User({
      username: baseProfile.username,
      email: baseProfile.email || `${baseProfile.username}@placeholder.local`,
      password: generateRandomPassword(),
      role: 'User',
      playlistCode,
      googleId: baseProfile.googleId,
      githubId: baseProfile.githubId,
      isActive: true
    });
    await user.save();
    const playlist = new Playlist({
      userId: user._id,
      name: `${user.username}'s Playlist`,
      playlistCode: user.playlistCode,
      channels: [],
      isPublic: false
    });
    await playlist.save();
  } else {
    // Update email if newly provided and different
    if (baseProfile.email && baseProfile.email !== user.email) {
      user.email = baseProfile.email; // basic update (could validate)
      await user.save();
    }
  }
  return user;
}

// --- Google OAuth ---
router.get('/google/start', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ success: false, error: 'Google OAuth not configured' });
  }
  const state = req.query.state || '';
  const scope = encodeURIComponent('openid email profile');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  return res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).json({ success: false, error });
  }
  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing authorization code' });
  }
  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ success: false, error: tokenJson.error || 'Token exchange failed' });
    }
    const { access_token, id_token } = tokenJson;

    // Fetch user info (OpenID userinfo)
    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const profile = await userInfoRes.json();
    if (!userInfoRes.ok) {
      return res.status(400).json({ success: false, error: 'Failed to fetch Google user info' });
    }

    const baseProfile = {
      googleId: profile.sub,
      username: (profile.name || profile.email || 'googleuser').replace(/\s+/g, '').substring(0, 30) + '-' + profile.sub.slice(-4),
      email: profile.email
    };

    const user = await ensureUserAndPlaylist({ googleId: profile.sub }, baseProfile);
    user.lastLogin = new Date();
    await user.save();

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(refreshToken, user, req);

    return res.json({
      success: true,
      provider: 'google',
      state,
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        playlistCode: user.playlistCode
      }
    });
  } catch (e) {
    console.error('Google OAuth error', e);
    return res.status(500).json({ success: false, error: 'Google OAuth failed' });
  }
});

// --- GitHub OAuth ---
router.get('/github/start', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
    return res.status(500).json({ success: false, error: 'GitHub OAuth not configured' });
  }
  const state = req.query.state || '';
  const scope = 'read:user user:email';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  return res.redirect(authUrl);
});

router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    return res.status(400).json({ success: false, error });
  }
  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing authorization code' });
  }
  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI
      })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(400).json({ success: false, error: tokenJson.error || 'Token exchange failed' });
    }
    const ghAccess = tokenJson.access_token;

    // Fetch primary user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${ghAccess}`, 'User-Agent': 'FireVision-IPTV' }
    });
    const ghProfile = await userRes.json();
    if (!userRes.ok) {
      return res.status(400).json({ success: false, error: 'Failed to fetch GitHub user info' });
    }

    // Fetch emails (to get primary verified email if possible)
    let email = ghProfile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${ghAccess}`, 'User-Agent': 'FireVision-IPTV' }
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find(e => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    }

    const baseProfile = {
      githubId: ghProfile.id?.toString(),
      username: (ghProfile.login || 'githubuser') + '-' + (ghProfile.id?.toString().slice(-4) || '0000'),
      email
    };

    const user = await ensureUserAndPlaylist({ githubId: baseProfile.githubId }, baseProfile);
    user.lastLogin = new Date();
    await user.save();

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(refreshToken, user, req);

    return res.json({
      success: true,
      provider: 'github',
      state,
      tokens: { accessToken, refreshToken },
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        playlistCode: user.playlistCode
      }
    });
  } catch (e) {
    console.error('GitHub OAuth error', e);
    return res.status(500).json({ success: false, error: 'GitHub OAuth failed' });
  }
});

module.exports = router;