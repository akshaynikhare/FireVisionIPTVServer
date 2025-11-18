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
        playlistCode: user.playlistCode,
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

module.exports = { router, requireAuth, requireAdmin };
