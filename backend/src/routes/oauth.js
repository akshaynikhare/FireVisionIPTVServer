const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { signAccessToken, signRefreshToken, persistRefreshToken } = require('../utils/jwtUtil');
const { sendWelcomeEmail } = require('../services/email');

// Environment config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || '';

// Helper: generate random password (User model requires one)
function generateRandomPassword() {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// Helper: create user with channel list if new
// Returns { user, isNew } so callers know whether to send a welcome email
async function ensureUserAndPlaylist(findCriteria, baseProfile) {
  let user = await User.findOne(findCriteria);
  if (!user) {
    const channelListCode = await User.generateChannelListCode();
    user = new User({
      username: baseProfile.username,
      email: baseProfile.email || `${baseProfile.username}@placeholder.local`,
      password: generateRandomPassword(),
      role: 'User',
      channelListCode,
      googleId: baseProfile.googleId,
      githubId: baseProfile.githubId,
      emailVerified: true,
      isActive: true,
    });
    await user.save();
    return { user, isNew: true };
  } else {
    // Block inactive accounts
    if (!user.isActive) {
      const err = new Error('Account is inactive');
      err.code = 'ACCOUNT_INACTIVE';
      throw err;
    }
    // Update email if newly provided and different
    if (baseProfile.email && baseProfile.email !== user.email) {
      user.email = baseProfile.email;
      await user.save();
    }
  }
  return { user, isNew: false };
}

// --- Google OAuth ---
router.get('/google/start', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(500).json({ success: false, error: 'Google OAuth not configured' });
  }
  const crypto = require('crypto');
  const state = crypto.randomBytes(16).toString('hex');
  if (!global._oauthStates) global._oauthStates = new Map();
  // Purge expired entries first
  for (const [k, v] of global._oauthStates) {
    if (v.expiresAt < Date.now()) global._oauthStates.delete(k);
  }
  if (global._oauthStates.size >= 1000) {
    return res.status(503).json({
      success: false,
      error: 'Too many pending OAuth requests. Please try again shortly.',
    });
  }
  global._oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
  const scope = encodeURIComponent('openid email profile');
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
  return res.redirect(authUrl);
});

const KNOWN_OAUTH_ERRORS = [
  'access_denied',
  'invalid_request',
  'unauthorized_client',
  'server_error',
];

router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    const safeError = KNOWN_OAUTH_ERRORS.includes(error) ? error : 'Authentication failed';
    return res.status(400).json({ success: false, error: safeError });
  }
  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing authorization code' });
  }
  // Validate CSRF state parameter
  if (!state || !global._oauthStates || !global._oauthStates.has(state)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing state parameter' });
  }
  const stateEntry = global._oauthStates.get(state);
  global._oauthStates.delete(state); // one-time use
  if (stateEntry.expiresAt < Date.now()) {
    return res.status(400).json({ success: false, error: 'State parameter expired' });
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
        grant_type: 'authorization_code',
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(400).json({ success: false, error: 'Token exchange failed' });
    }
    const { access_token } = tokenJson;

    // Fetch user info (OpenID userinfo)
    const userInfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const profile = await userInfoRes.json();
    if (!userInfoRes.ok) {
      return res.status(400).json({ success: false, error: 'Failed to fetch Google user info' });
    }

    const baseProfile = {
      googleId: profile.sub,
      username:
        (profile.name || profile.email || 'googleuser').replace(/\s+/g, '').substring(0, 30) +
        '-' +
        profile.sub.slice(-4),
      email: profile.email,
    };

    const { user, isNew } = await ensureUserAndPlaylist({ googleId: profile.sub }, baseProfile);
    user.lastLogin = new Date();
    await user.save();
    if (isNew && user.email && !user.email.endsWith('@placeholder.local')) {
      sendWelcomeEmail(user.email, { username: user.username });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(refreshToken, user, req);

    return res.json({
      success: true,
      provider: 'google',
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
    if (e.code === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({ success: false, error: 'Account is inactive' });
    }
    if (e.code === 11000) {
      return res
        .status(409)
        .json({ success: false, error: 'Account already exists. Please try logging in.' });
    }
    console.error('Google OAuth error', e);
    return res.status(500).json({ success: false, error: 'Google OAuth failed' });
  }
});

// --- GitHub OAuth ---
router.get('/github/start', (req, res) => {
  if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
    return res.status(500).json({ success: false, error: 'GitHub OAuth not configured' });
  }
  const crypto = require('crypto');
  const state = crypto.randomBytes(16).toString('hex');
  if (!global._oauthStates) global._oauthStates = new Map();
  // Purge expired entries first
  for (const [k, v] of global._oauthStates) {
    if (v.expiresAt < Date.now()) global._oauthStates.delete(k);
  }
  if (global._oauthStates.size >= 1000) {
    return res.status(503).json({
      success: false,
      error: 'Too many pending OAuth requests. Please try again shortly.',
    });
  }
  global._oauthStates.set(state, { expiresAt: Date.now() + 10 * 60 * 1000 });
  const scope = 'read:user user:email';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;
  return res.redirect(authUrl);
});

router.get('/github/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    const safeError = KNOWN_OAUTH_ERRORS.includes(error) ? error : 'Authentication failed';
    return res.status(400).json({ success: false, error: safeError });
  }
  if (!code) {
    return res.status(400).json({ success: false, error: 'Missing authorization code' });
  }
  // Validate CSRF state parameter
  if (!state || !global._oauthStates || !global._oauthStates.has(state)) {
    return res.status(400).json({ success: false, error: 'Invalid or missing state parameter' });
  }
  const stateEntry = global._oauthStates.get(state);
  global._oauthStates.delete(state);
  if (stateEntry.expiresAt < Date.now()) {
    return res.status(400).json({ success: false, error: 'State parameter expired' });
  }
  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(400).json({ success: false, error: 'Token exchange failed' });
    }
    const ghAccess = tokenJson.access_token;

    // Fetch primary user profile
    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${ghAccess}`, 'User-Agent': 'FireVision-IPTV' },
    });
    const ghProfile = await userRes.json();
    if (!userRes.ok) {
      return res.status(400).json({ success: false, error: 'Failed to fetch GitHub user info' });
    }

    // Fetch emails (to get primary verified email if possible)
    let email = ghProfile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${ghAccess}`, 'User-Agent': 'FireVision-IPTV' },
      });
      if (emailRes.ok) {
        const emails = await emailRes.json();
        const primary = emails.find((e) => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    }

    const baseProfile = {
      githubId: ghProfile.id?.toString(),
      username:
        (ghProfile.login || 'githubuser') + '-' + (ghProfile.id?.toString().slice(-4) || '0000'),
      email,
    };

    const { user, isNew } = await ensureUserAndPlaylist(
      { githubId: baseProfile.githubId },
      baseProfile,
    );
    user.lastLogin = new Date();
    await user.save();
    if (isNew && user.email && !user.email.endsWith('@placeholder.local')) {
      sendWelcomeEmail(user.email, { username: user.username });
    }

    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(refreshToken, user, req);

    return res.json({
      success: true,
      provider: 'github',
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
    if (e.code === 'ACCOUNT_INACTIVE') {
      return res.status(403).json({ success: false, error: 'Account is inactive' });
    }
    if (e.code === 11000) {
      return res
        .status(409)
        .json({ success: false, error: 'Account already exists. Please try logging in.' });
    }
    console.error('GitHub OAuth error', e);
    return res.status(500).json({ success: false, error: 'GitHub OAuth failed' });
  }
});

module.exports = router;
