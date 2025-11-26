const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session');

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../public/uploads/profiles');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF) are allowed'));
    }
  }
});

/**
 * Middleware to check if user is authenticated
 * Validates session from database and attaches user info to request
 */
const requireAuth = async (req, res, next) => {
  try {
    const sessionId = req.headers['x-session-id'];

    if (!sessionId) {
      return res.status(401).json({
        success: false,
        error: 'No session ID provided'
      });
    }

    // Find session in database
    const session = await Session.findOne({ sessionId }).populate('userId');

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Check if session is expired
    if (!session.isValid()) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    // Check if user still exists and is active
    if (!session.userId || !session.userId.isActive) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'User account is inactive'
      });
    }

    // Update last activity
    await session.updateActivity();

    // Attach user info to request
    req.user = {
      id: session.userId._id,
      username: session.userId.username,
      email: session.userId.email,
      role: session.userId.role,
      playlistCode: session.userId.playlistCode,
      isActive: session.userId.isActive
    };

    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - Admin access required'
    });
  }

  next();
};

/**
 * Login endpoint
 * Authenticates user against database and creates session
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username },
        { email: username }
      ]
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is inactive. Please contact administrator.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Get client info
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Create session in database (expires in 24 hours)
    const session = new Session({
      sessionId,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress,
      userAgent
    });

    await session.save();

    // Update user's last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      sessionId,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        playlistCode: user.playlistCode,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * Logout endpoint
 * Destroys the current session
 */
router.post('/logout', async (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];

    if (sessionId) {
      await Session.deleteOne({ sessionId });
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * Get current user info
 * Returns the authenticated user's information
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        channelListCode: user.channelListCode,
        profilePicture: user.profilePicture,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        channels: user.channels,
        metadata: user.metadata,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information'
    });
  }
});

/**
 * Change password
 * Allows authenticated user to change their password
 */
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Invalidate all other sessions for this user (force re-login)
    await Session.deleteMany({
      userId: user._id,
      sessionId: { $ne: req.sessionId }
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Other sessions have been logged out.'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
});

/**
 * Update user profile
 * Allows authenticated user to update their profile information
 */
router.put('/me', requireAuth, async (req, res) => {
  try {
    const { username, email, profilePicture } = req.body;

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
      user.username = username;
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          error: 'Email already in use'
        });
      }
      user.email = email;
    }

    // Update profile picture if provided
    if (profilePicture !== undefined) {
      user.profilePicture = profilePicture || null;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        channelListCode: user.channelListCode
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * Regenerate channel list code
 * Generates a new unique code for the user's channel list
 */
router.post('/regenerate-channel-code', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Generate new channel list code
    const newCode = await User.generateChannelListCode();
    user.channelListCode = newCode;
    await user.save();

    res.json({
      success: true,
      message: 'Channel list code regenerated successfully',
      channelListCode: newCode
    });
  } catch (error) {
    console.error('Regenerate code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate channel list code'
    });
  }
});

/**
 * Get all active sessions for current user
 */
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await Session.find({
      userId: req.user.id,
      expiresAt: { $gt: new Date() }
    }).select('-__v').sort('-createdAt');

    res.json({
      success: true,
      sessions: sessions.map(session => ({
        id: session._id,
        sessionId: session.sessionId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity,
        isCurrent: session.sessionId === req.sessionId
      }))
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions'
    });
  }
});

/**
 * Revoke a specific session
 */
router.delete('/sessions/:sessionId', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Only allow users to revoke their own sessions
    const session = await Session.findOne({
      sessionId,
      userId: req.user.id
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    await Session.deleteOne({ sessionId });

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session'
    });
  }
});

/**
 * Cleanup expired sessions (can be called by cron job)
 */
router.post('/cleanup-sessions', async (req, res) => {
  try {
    const result = await Session.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired sessions`
    });
  } catch (error) {
    console.error('Cleanup sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup sessions'
    });
  }
});

/**
 * Update user profile (username, email)
 * Allows authenticated user to update their profile information
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { username, email } = req.body;

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken'
        });
      }
      user.username = username;
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email already taken'
        });
      }
      user.email = email;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        playlistCode: user.playlistCode,
        profilePicture: user.profilePicture,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

/**
 * Upload profile picture
 * Allows authenticated user to upload a profile picture
 */
router.post('/profile-picture', requireAuth, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      try {
        const oldPath = path.join(__dirname, '../../public', user.profilePicture);
        await fs.unlink(oldPath);
      } catch (error) {
        console.log('Could not delete old profile picture:', error.message);
      }
    }

    // Update user with new profile picture path
    user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload profile picture'
    });
  }
});

/**
 * Delete profile picture
 * Allows authenticated user to delete their profile picture
 */
router.delete('/profile-picture', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        error: 'No profile picture to delete'
      });
    }

    // Delete file from disk
    try {
      const filePath = path.join(__dirname, '../../public', user.profilePicture);
      await fs.unlink(filePath);
    } catch (error) {
      console.log('Could not delete profile picture file:', error.message);
    }

    // Remove from user record
    user.profilePicture = null;
    await user.save();

    res.json({
      success: true,
      message: 'Profile picture deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete profile picture'
    });
  }
});

/**
 * User Registration
 * Allows new users to register without admin approval
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username, email, and password are required'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // Check if username already exists
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        error: 'Username already exists'
      });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        error: 'Email already exists'
      });
    }

    // Generate unique channel list code
    const channelListCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    // Create new user
    const user = new User({
      username,
      email,
      password,
      role: 'user',
      channelListCode,
      isActive: true,
      createdAt: new Date()
    });

    await user.save();

    console.log('New user registered:', username);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        channelListCode: user.channelListCode
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Registration failed'
    });
  }
});

/**
 * Google OAuth - Initiate authentication
 */
router.get('/google', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
  
  if (!googleClientId || googleClientId === 'your-google-client-id') {
    return res.status(500).send('Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in environment variables.');
  }

  const scope = 'openid profile email';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
  
  res.redirect(authUrl);
});

/**
 * Google OAuth - Callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect('/user/login.html?error=authentication_failed');
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

    // Exchange code for tokens
    const axios = require('axios');
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { email, name, picture } = userInfoResponse.data;

    // Find or create user
    let user = await User.findOne({ email });

    if (!user) {
      // Generate username from email
      const username = email.split('@')[0] + '_' + crypto.randomBytes(2).toString('hex');
      const channelListCode = crypto.randomBytes(3).toString('hex').toUpperCase();

      user = new User({
        username,
        email,
        password: crypto.randomBytes(16).toString('hex'), // Random password for OAuth users
        role: 'user',
        channelListCode,
        profilePicture: picture,
        isActive: true,
        createdAt: new Date()
      });

      await user.save();
      console.log('New Google OAuth user created:', username);
    }

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = new Session({
      sessionId,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    await session.save();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Redirect with session
    res.redirect(`/user/channels.html?sessionId=${sessionId}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect('/user/login.html?error=authentication_failed');
  }
});

/**
 * GitHub OAuth - Initiate authentication
 */
router.get('/github', (req, res) => {
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;
  
  if (!githubClientId || githubClientId === 'your-github-client-id') {
    return res.status(500).send('GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID in environment variables.');
  }

  const scope = 'read:user user:email';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
  
  res.redirect(authUrl);
});

/**
 * GitHub OAuth - Callback
 */
router.get('/github/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect('/user/login.html?error=authentication_failed');
    }

    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;

    // Exchange code for access token
    const axios = require('axios');
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: redirectUri
    }, {
      headers: { Accept: 'application/json' }
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const githubUser = userResponse.data;

    // Get user emails
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const primaryEmail = emailsResponse.data.find(e => e.primary)?.email || emailsResponse.data[0]?.email;

    // Find or create user
    let user = await User.findOne({ email: primaryEmail });

    if (!user) {
      const username = githubUser.login + '_' + crypto.randomBytes(2).toString('hex');
      const channelListCode = crypto.randomBytes(3).toString('hex').toUpperCase();

      user = new User({
        username,
        email: primaryEmail,
        password: crypto.randomBytes(16).toString('hex'), // Random password for OAuth users
        role: 'user',
        channelListCode,
        profilePicture: githubUser.avatar_url,
        isActive: true,
        createdAt: new Date()
      });

      await user.save();
      console.log('New GitHub OAuth user created:', username);
    }

    // Create session
    const sessionId = crypto.randomBytes(32).toString('hex');
    const session = new Session({
      sessionId,
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    await session.save();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Redirect with session
    res.redirect(`/user/channels.html?sessionId=${sessionId}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect('/user/login.html?error=authentication_failed');
  }
});

module.exports = { router, requireAuth, requireAdmin };
