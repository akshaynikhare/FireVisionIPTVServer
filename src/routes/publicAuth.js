const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../models/User');
const Playlist = require('../models/Playlist');
const { signAccessToken, signRefreshToken, persistRefreshToken } = require('../utils/jwtUtil');

// Rate limiter for signup to mitigate abuse
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.SIGNUP_RATE_LIMIT_MAX || '10'),
  standardHeaders: true,
  legacyHeaders: false
});

// Basic validators
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateUsername(username) {
  return /^[A-Za-z0-9_]{3,50}$/.test(username);
}

function validatePassword(pw) {
  if (typeof pw !== 'string') return false;
  return pw.length >= 8; // Could enhance with complexity checks later
}

// POST /api/v1/public/signup
router.post('/signup', signupLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'username, email, password required' });
    }
    if (!validateUsername(username)) {
      return res.status(400).json({ success: false, error: 'Invalid username (3-50 chars, alphanumeric + underscore)' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Prevent creating reserved super admin username if defined
    const reserved = process.env.SUPER_ADMIN_USERNAME;
    if (reserved && username.toLowerCase() === reserved.toLowerCase()) {
      return res.status(403).json({ success: false, error: 'Username reserved' });
    }

    // Uniqueness checks
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Username or email already in use' });
    }

    // Generate playlist code using User static (to keep parity)
    const playlistCode = await User.generatePlaylistCode();

    // Create user with role User only
    const user = new User({
      username,
      email,
      password,
      role: 'User',
      playlistCode,
      channels: []
    });
    await user.save();

    // Create playlist doc (Option B model)
    const playlist = new Playlist({
      userId: user._id,
      name: `${username}'s Playlist`,
      playlistCode,
      channels: [],
      isPublic: false
    });
    await playlist.save();

    // Issue JWT tokens
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user);
    await persistRefreshToken(refreshToken, user, req);

    return res.status(201).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        playlistCode: user.playlistCode
      },
      tokens: { accessToken, refreshToken }
    });
  } catch (err) {
    console.error('Signup error', err);
    return res.status(500).json({ success: false, error: 'Signup failed' });
  }
});

module.exports = router;
