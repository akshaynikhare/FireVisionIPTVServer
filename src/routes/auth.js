const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const User = require('../models/User');

/**
 * Authentication Routes
 * Supports Local, Google, GitHub, and Facebook authentication
 */

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Middleware to check if user is authenticated
 */
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Authentication required'
  });
};

/**
 * Middleware to check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'Admin') {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Admin access required'
  });
};

// ============================================
// LOCAL AUTHENTICATION ROUTES
// ============================================

/**
 * POST /api/v1/auth/login
 * Login with username/email and password
 */
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: info?.message || 'Invalid credentials'
      });
    }

    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Login failed'
        });
      }

      res.json({
        success: true,
        message: 'Login successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          playlistCode: user.playlistCode,
          profilePicture: user.profilePicture
        },
        sessionId: req.sessionID
      });
    });
  })(req, res, next);
});

/**
 * POST /api/v1/auth/register
 * Register new user with local authentication
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

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username: username },
        { email: email }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Username or email already exists'
      });
    }

    // Generate unique playlist code
    const playlistCode = await User.generatePlaylistCode();

    // Create new user
    const user = new User({
      username,
      email,
      password,
      playlistCode,
      authProvider: 'local',
      role: 'User',
      isActive: true
    });

    await user.save();

    // Auto-login after registration
    req.logIn(user, (err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Registration successful but login failed'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          playlistCode: user.playlistCode
        },
        sessionId: req.sessionID
      });
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout current user
 */
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({
          success: false,
          error: 'Session destruction failed'
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      playlistCode: req.user.playlistCode,
      profilePicture: req.user.profilePicture,
      authProvider: req.user.authProvider,
      lastLogin: req.user.lastLogin
    }
  });
});

// ============================================
// GOOGLE OAUTH ROUTES
// ============================================

/**
 * GET /api/v1/auth/google
 * Initiate Google OAuth flow
 */
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

/**
 * GET /api/v1/auth/google/callback
 * Google OAuth callback
 */
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    const redirectUrl = process.env.OAUTH_SUCCESS_REDIRECT || '/dashboard';
    res.redirect(redirectUrl);
  }
);

// ============================================
// GITHUB OAUTH ROUTES
// ============================================

/**
 * GET /api/v1/auth/github
 * Initiate GitHub OAuth flow
 */
router.get('/github',
  passport.authenticate('github', {
    scope: ['user:email']
  })
);

/**
 * GET /api/v1/auth/github/callback
 * GitHub OAuth callback
 */
router.get('/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    const redirectUrl = process.env.OAUTH_SUCCESS_REDIRECT || '/dashboard';
    res.redirect(redirectUrl);
  }
);

// ============================================
// FACEBOOK OAUTH ROUTES
// ============================================

/**
 * GET /api/v1/auth/facebook
 * Initiate Facebook OAuth flow
 */
router.get('/facebook',
  passport.authenticate('facebook', {
    scope: ['email']
  })
);

/**
 * GET /api/v1/auth/facebook/callback
 * Facebook OAuth callback
 */
router.get('/facebook/callback',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    const redirectUrl = process.env.OAUTH_SUCCESS_REDIRECT || '/dashboard';
    res.redirect(redirectUrl);
  }
);

// ============================================
// EXPORTS
// ============================================

module.exports = {
  router,
  requireAuth,
  requireAdmin
};
