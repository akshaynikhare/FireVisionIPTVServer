const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session');
const RefreshToken = require('../models/RefreshToken');
const { audit } = require('../services/audit-log');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/email');

// Input validation helpers
const USERNAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required';
  if (username.length < 3 || username.length > 50)
    return 'Username must be between 3 and 50 characters';
  if (!USERNAME_REGEX.test(username))
    return 'Username can only contain letters, numbers, underscores, dots, and hyphens';
  return null;
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email is required';
  if (email.length > 254) return 'Email is too long';
  if (!EMAIL_REGEX.test(email)) return 'Invalid email format';
  return null;
}

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../public/uploads/profiles');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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
  },
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
        error: 'No session ID provided',
      });
    }

    // Find session in database
    const session = await Session.findOne({ sessionId }).populate('userId');

    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session',
      });
    }

    // Check if session is expired
    if (!session.isValid()) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'Session expired',
      });
    }

    // Check if user still exists and is active
    if (!session.userId || !session.userId.isActive) {
      await Session.deleteOne({ sessionId });
      return res.status(401).json({
        success: false,
        error: 'User account is inactive',
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
      channelListCode: session.userId.channelListCode,
      isActive: session.userId.isActive,
    };

    req.sessionId = sessionId;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
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
      error: 'Unauthorized',
    });
  }

  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden - Admin access required',
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
        error: 'Username and password are required',
      });
    }

    // Sanitize input for logging (prevent log injection)
    const safeInput = String(username)
      .replace(/[\r\n]/g, '')
      .substring(0, 100);

    // Find user by username or email
    const user = await User.findOne({
      $or: [{ username: username }, { email: username }],
    });

    if (!user) {
      console.warn(`Failed login attempt: user not found (input: ${safeInput}), IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.warn(`Failed login attempt: inactive account (${safeInput}), IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      console.warn(`Failed login attempt: bad password for ${safeInput}, IP: ${req.ip}`);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Get client info
    const ipAddress = req.ip || req.socket?.remoteAddress;
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
      userAgent,
    });

    await session.save();

    // Update user's last login
    user.lastLogin = new Date();
    await user.save();

    audit({
      userId: user._id,
      action: 'login',
      resource: 'session',
      resourceId: sessionId,
      ipAddress: ipAddress,
      userAgent,
    });

    res.json({
      success: true,
      sessionId,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        channelListCode: user.channelListCode,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

/**
 * Logout endpoint
 * Destroys the current session
 */
router.post('/logout', requireAuth, async (req, res) => {
  try {
    // Delete the current session (ownership is guaranteed by requireAuth which
    // already validated the session belongs to req.user)
    await Session.deleteOne({ sessionId: req.sessionId, userId: req.user.id });

    audit({
      userId: req.user.id,
      action: 'logout',
      resource: 'session',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
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
        error: 'User not found',
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
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin,
        channels: user.channels,
        metadata: user.metadata,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get user info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user information',
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
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 8 characters long',
      });
    }

    if (newPassword.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Password must not exceed 128 characters',
      });
    }

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Invalidate all other sessions and refresh tokens for this user (force re-login)
    await Promise.all([
      Session.deleteMany({
        userId: user._id,
        sessionId: { $ne: req.sessionId },
      }),
      RefreshToken.deleteMany({ userId: user._id }),
    ]);

    audit({
      userId: req.user.id,
      action: 'change_password',
      resource: 'user',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Other sessions have been logged out.',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password',
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
        error: 'User not found',
      });
    }

    // Validate username format if provided
    if (username) {
      const usernameError = validateUsername(username);
      if (usernameError) {
        return res.status(400).json({ success: false, error: usernameError });
      }
    }

    // Validate email format if provided
    if (email) {
      const emailError = validateEmail(email);
      if (emailError) {
        return res.status(400).json({ success: false, error: emailError });
      }
    }

    // Check if username is being changed and if it's already taken
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken',
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
          error: 'Email already in use',
        });
      }
      user.email = email;
    }

    // Update profile picture if provided (strict allowlist validation)
    if (profilePicture !== undefined) {
      const isLocalUpload =
        /^\/uploads\/profiles\/profile-[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif)$/.test(profilePicture);
      const isOAuthAvatar =
        /^https:\/\/(lh3\.googleusercontent\.com|avatars\.githubusercontent\.com)\//.test(
          profilePicture,
        );
      if (profilePicture && !isLocalUpload && !isOAuthAvatar) {
        return res.status(400).json({
          success: false,
          error: 'Invalid profile picture path',
        });
      }
      user.profilePicture = profilePicture || null;
    }

    await user.save();
    audit({
      userId: req.user.id,
      action: 'update_profile',
      resource: 'user',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profilePicture: user.profilePicture,
        channelListCode: user.channelListCode,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        error: `That ${field} is already taken`,
      });
    }
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
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
        error: 'User not found',
      });
    }

    // Generate new channel list code
    const newCode = await User.generateChannelListCode();
    user.channelListCode = newCode;
    await user.save();
    audit({
      userId: req.user.id,
      action: 'regenerate_channel_code',
      resource: 'user',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Channel list code regenerated successfully',
      channelListCode: newCode,
    });
  } catch (error) {
    console.error('Regenerate code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate channel list code',
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
      expiresAt: { $gt: new Date() },
    })
      .select('-__v')
      .sort('-createdAt');

    res.json({
      success: true,
      sessions: sessions.map((session) => ({
        id: session._id,
        sessionId: session.sessionId,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        lastActivity: session.lastActivity,
        isCurrent: session.sessionId === req.sessionId,
      })),
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions',
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
      userId: req.user.id,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    await Session.deleteOne({ sessionId });
    audit({
      userId: req.user.id,
      action: 'revoke_session',
      resource: 'session',
      resourceId: sessionId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session',
    });
  }
});

/**
 * Cleanup expired sessions (can be called by cron job)
 */
router.post('/cleanup-sessions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await Session.deleteMany({
      expiresAt: { $lt: new Date() },
    });
    audit({
      userId: req.user.id,
      action: 'cleanup_sessions',
      resource: 'session',
      resourceId: `${result.deletedCount} expired`,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: `Cleaned up ${result.deletedCount} expired sessions`,
    });
  } catch (error) {
    console.error('Cleanup sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup sessions',
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
        error: 'User not found',
      });
    }

    // Validate username format if provided
    if (username) {
      const usernameError = validateUsername(username);
      if (usernameError) {
        return res.status(400).json({ success: false, error: usernameError });
      }
    }

    // Validate email format if provided
    if (email) {
      const emailError = validateEmail(email);
      if (emailError) {
        return res.status(400).json({ success: false, error: emailError });
      }
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Username already taken',
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
          error: 'Email already taken',
        });
      }
      user.email = email;
    }

    await user.save();
    audit({
      userId: req.user.id,
      action: 'update_profile',
      resource: 'user',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        channelListCode: user.channelListCode,
        profilePicture: user.profilePicture,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({
        success: false,
        error: `That ${field} is already taken`,
      });
    }
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
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
        error: 'No file uploaded',
      });
    }

    // Find user
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Delete old profile picture if exists (with path traversal protection)
    if (user.profilePicture) {
      try {
        const uploadsDir = path.resolve(__dirname, '../../../public/uploads/profiles');
        const oldPath = path.resolve(__dirname, '../../../public', user.profilePicture);
        // Ensure the resolved path is within the uploads directory
        if (oldPath.startsWith(uploadsDir)) {
          await fs.unlink(oldPath);
        }
      } catch (error) {
        console.log('Could not delete old profile picture:', error.message);
      }
    }

    // Update user with new profile picture path
    user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    await user.save();
    audit({
      userId: req.user.id,
      action: 'upload_profile_picture',
      resource: 'user',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload profile picture',
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
        error: 'User not found',
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        error: 'No profile picture to delete',
      });
    }

    // Delete file from disk (with path traversal protection)
    try {
      const uploadsDir = path.resolve(__dirname, '../../../public/uploads/profiles');
      const filePath = path.resolve(__dirname, '../../../public', user.profilePicture);
      if (filePath.startsWith(uploadsDir)) {
        await fs.unlink(filePath);
      }
    } catch (error) {
      console.log('Could not delete profile picture file:', error.message);
    }

    // Remove from user record
    user.profilePicture = null;
    await user.save();
    audit({
      userId: req.user.id,
      action: 'delete_profile_picture',
      resource: 'user',
      resourceId: String(req.user.id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Profile picture deleted successfully',
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete profile picture',
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
        error: 'Username, email, and password are required',
      });
    }

    // Validate username format
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ success: false, error: usernameError });
    }

    // Validate email format
    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).json({ success: false, error: emailError });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters long',
      });
    }

    if (password.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'Password must not exceed 128 characters',
      });
    }

    // Check if username or email already exists (generic message to prevent enumeration)
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already in use',
      });
    }

    // Create new user with retry-safe channelListCode generation
    const user = await User.generateAndSaveWithCode({
      username,
      email,
      password,
      role: 'User',
      isActive: true,
      createdAt: new Date(),
    });

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Fire-and-forget verification email (includes welcome content)
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
    sendVerificationEmail(email, { username, verificationUrl });

    console.log('New user registered:', username);

    audit({
      userId: user._id,
      action: 'register',
      resource: 'user',
      resourceId: String(user._id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        channelListCode: user.channelListCode,
        emailVerified: false,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already in use',
      });
    }
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
});

// NOTE: OAuth routes (/google, /google/callback, /github, /github/callback,
// /oauth-exchange) need rate limiting applied in server.js to prevent abuse.
// These endpoints are public and should be rate-limited more aggressively than
// authenticated endpoints.

/**
 * Google OAuth - Initiate authentication
 */
router.get('/google', (req, res) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

  if (!googleClientId || googleClientId === 'your-google-client-id') {
    return res
      .status(500)
      .send(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID in environment variables.',
      );
  }

  // Generate CSRF state parameter
  const state = crypto.randomBytes(16).toString('hex');
  // Store state in a secure httpOnly cookie for validation in callback
  res.cookie('oauth_state_google', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const scope = 'openid profile email';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${state}`;

  res.redirect(authUrl);
});

/**
 * Google OAuth - Callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect('/login?error=authentication_failed');
    }

    // Validate OAuth state parameter to prevent CSRF
    const expectedState = req.cookies?.oauth_state_google;
    res.clearCookie('oauth_state_google');
    if (!state || !expectedState || state !== expectedState) {
      return res.redirect('/login?error=invalid_state');
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;

    // Exchange code for tokens
    const axios = require('axios');
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: googleClientId,
      client_secret: googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: googleId, email, picture } = userInfoResponse.data;

    // Find by Google provider ID first, then fall back to email
    let user = await User.findOne({ googleId: String(googleId) });
    if (!user && email) {
      user = await User.findOne({ email });
    }

    if (user && !user.isActive) {
      return res.redirect('/login?error=account_inactive');
    }

    if (!user) {
      // Generate username from email
      const username = email.split('@')[0] + '_' + crypto.randomBytes(2).toString('hex');
      const channelListCode = await User.generateChannelListCode();

      user = new User({
        username,
        email,
        password: crypto.randomBytes(16).toString('hex'), // Random password for OAuth users
        role: 'User',
        channelListCode,
        googleId: String(googleId),
        profilePicture: picture,
        isActive: true,
        emailVerified: true,
        createdAt: new Date(),
      });

      await user.save();
      console.log('New Google OAuth user created:', username);
    } else if (!user.googleId && googleId) {
      // Account exists with this email but Google is not linked.
      // Do NOT auto-link to prevent account takeover. User must log in
      // with their password first and then link the provider manually.
      return res.redirect('/login?error=account_exists_link_required');
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
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    await session.save();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Redirect to frontend OAuth callback page with a short-lived one-time code
    // The frontend will extract the sessionId and store it in its auth store
    const oauthCode = crypto.randomBytes(16).toString('hex');
    // Store mapping: oauthCode -> sessionId (expires in 60 seconds)
    if (!global._oauthCodes) global._oauthCodes = new Map();
    // Clean up expired codes and enforce memory cap
    for (const [k, v] of global._oauthCodes) {
      if (v.expiresAt < Date.now()) global._oauthCodes.delete(k);
    }
    if (global._oauthCodes.size >= 1000) {
      // Evict oldest entry to prevent unbounded memory growth
      const firstKey = global._oauthCodes.keys().next().value;
      if (firstKey) global._oauthCodes.delete(firstKey);
    }
    global._oauthCodes.set(oauthCode, {
      sessionId,
      userId: user._id,
      expiresAt: Date.now() + 60000,
    });

    res.redirect(`/login?oauth_code=${oauthCode}`);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect('/login?error=authentication_failed');
  }
});

/**
 * GitHub OAuth - Initiate authentication
 */
router.get('/github', (req, res) => {
  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri =
    process.env.GITHUB_REDIRECT_URI ||
    `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;

  if (!githubClientId || githubClientId === 'your-github-client-id') {
    return res
      .status(500)
      .send(
        'GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID in environment variables.',
      );
  }

  // Generate CSRF state parameter
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state_github', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const scope = 'read:user user:email';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}`;

  res.redirect(authUrl);
});

/**
 * GitHub OAuth - Callback
 */
router.get('/github/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.redirect('/login?error=authentication_failed');
    }

    // Validate OAuth state parameter to prevent CSRF
    const expectedState = req.cookies?.oauth_state_github;
    res.clearCookie('oauth_state_github');
    if (!state || !expectedState || state !== expectedState) {
      return res.redirect('/login?error=invalid_state');
    }

    const githubClientId = process.env.GITHUB_CLIENT_ID;
    const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri =
      process.env.GITHUB_REDIRECT_URI ||
      `${req.protocol}://${req.get('host')}/api/v1/auth/github/callback`;

    // Exchange code for access token
    const axios = require('axios');
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: githubClientId,
        client_secret: githubClientSecret,
        code,
        redirect_uri: redirectUri,
      },
      {
        headers: { Accept: 'application/json' },
      },
    );

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const githubUser = userResponse.data;

    // Get user emails
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const primaryEmail =
      emailsResponse.data.find((e) => e.primary)?.email || emailsResponse.data[0]?.email;

    // Find by GitHub provider ID first, then fall back to email
    const githubIdStr = String(githubUser.id);
    let user = await User.findOne({ githubId: githubIdStr });
    if (!user && primaryEmail) {
      user = await User.findOne({ email: primaryEmail });
    }

    if (user && !user.isActive) {
      return res.redirect('/login?error=account_inactive');
    }

    if (!user) {
      const username = githubUser.login + '_' + crypto.randomBytes(2).toString('hex');
      const channelListCode = await User.generateChannelListCode();

      user = new User({
        username,
        email: primaryEmail,
        password: crypto.randomBytes(16).toString('hex'), // Random password for OAuth users
        role: 'User',
        channelListCode,
        githubId: githubIdStr,
        profilePicture: githubUser.avatar_url,
        isActive: true,
        emailVerified: true,
        createdAt: new Date(),
      });

      await user.save();
      console.log('New GitHub OAuth user created:', username);
    } else if (!user.githubId && githubUser.id) {
      // Account exists with this email but GitHub is not linked.
      // Do NOT auto-link to prevent account takeover. User must log in
      // with their password first and then link the provider manually.
      return res.redirect('/login?error=account_exists_link_required');
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
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    await session.save();

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Redirect to frontend OAuth callback page with a short-lived one-time code
    const oauthCode = crypto.randomBytes(16).toString('hex');
    if (!global._oauthCodes) global._oauthCodes = new Map();
    // Clean up expired codes and enforce memory cap
    for (const [k, v] of global._oauthCodes) {
      if (v.expiresAt < Date.now()) global._oauthCodes.delete(k);
    }
    if (global._oauthCodes.size >= 1000) {
      const firstKey = global._oauthCodes.keys().next().value;
      if (firstKey) global._oauthCodes.delete(firstKey);
    }
    global._oauthCodes.set(oauthCode, {
      sessionId,
      userId: user._id,
      expiresAt: Date.now() + 60000,
    });

    res.redirect(`/login?oauth_code=${oauthCode}`);
  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    res.redirect('/login?error=authentication_failed');
  }
});

/**
 * Exchange a one-time OAuth code for a session.
 * The code is issued during OAuth callback and expires after 60 seconds.
 */
router.post('/oauth-exchange', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }

    if (!global._oauthCodes) {
      return res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }

    const entry = global._oauthCodes.get(code);
    // Always delete the code (one-time use)
    global._oauthCodes.delete(code);

    if (!entry || entry.expiresAt < Date.now()) {
      return res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }

    // Validate the session still exists
    const session = await Session.findOne({ sessionId: entry.sessionId });
    if (!session || !session.isValid()) {
      return res.status(401).json({ success: false, error: 'Session no longer valid' });
    }

    const user = await User.findById(entry.userId).select('-password');
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Invalid or expired code' });
    }

    res.json({
      success: true,
      sessionId: entry.sessionId,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        channelListCode: user.channelListCode,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
      },
    });
  } catch (error) {
    console.error('OAuth exchange error:', error);
    res.status(500).json({ success: false, error: 'Exchange failed' });
  }
});

// ---------------------------------------------------------------------------
// Email Verification
// ---------------------------------------------------------------------------

/**
 * Verify email address using token from email link
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, error: 'Invalid or expired verification token' });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    audit({
      userId: user._id,
      action: 'verify_email',
      resource: 'user',
      resourceId: String(user._id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ success: false, error: 'Email verification failed' });
  }
});

/**
 * Resend verification email (requires authentication)
 */
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ success: false, error: 'Email is already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationUrl = `${appUrl}/verify-email?token=${verificationToken}`;
    sendVerificationEmail(user.email, { username: user.username, verificationUrl });

    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ success: false, error: 'Failed to resend verification email' });
  }
});

// ---------------------------------------------------------------------------
// Password Reset
// ---------------------------------------------------------------------------

/**
 * Request a password reset (public, always returns success to prevent enumeration)
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Always respond with success to prevent email enumeration
    const successResponse = {
      success: true,
      message: 'If that email is registered, a password reset link has been sent.',
    };

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.json(successResponse);
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
    sendPasswordResetEmail(user.email, { username: user.username, resetUrl });

    res.json(successResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process password reset request' });
  }
});

/**
 * Reset password using token from email link
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ success: false, error: 'New password is required' });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ success: false, error: 'Password must be at least 8 characters long' });
    }

    if (newPassword.length > 128) {
      return res
        .status(400)
        .json({ success: false, error: 'Password must not exceed 128 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Invalidate all sessions and refresh tokens for this user
    await Promise.all([
      Session.deleteMany({ userId: user._id }),
      RefreshToken.deleteMany({ userId: user._id }),
    ]);

    audit({
      userId: user._id,
      action: 'reset_password',
      resource: 'user',
      resourceId: String(user._id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

module.exports = { router, requireAuth, requireAdmin };
