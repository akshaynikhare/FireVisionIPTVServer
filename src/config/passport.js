const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User');

/**
 * Passport Configuration
 * Supports Local, Google, GitHub, and Facebook authentication
 */

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// ============================================
// LOCAL STRATEGY
// ============================================
passport.use(new LocalStrategy(
  {
    usernameField: 'username',
    passwordField: 'password'
  },
  async (username, password, done) => {
    try {
      // Find user by username or email
      const user = await User.findOne({
        $or: [
          { username: username },
          { email: username }
        ],
        authProvider: 'local'
      });

      if (!user) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Check if account is active
      if (!user.isActive) {
        return done(null, false, { message: 'Account is disabled' });
      }

      // Verify password
      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return done(null, false, { message: 'Invalid username or password' });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

// ============================================
// GOOGLE OAUTH STRATEGY
// ============================================
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/google/callback',
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists with this Google ID
        let user = await User.findOne({
          authProvider: 'google',
          oauthId: profile.id
        });

        if (user) {
          // Update existing user
          user.lastLogin = new Date();
          if (profile.photos && profile.photos.length > 0) {
            user.profilePicture = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // Check if user exists with this email (different provider)
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Email already exists with different provider
          return done(null, false, {
            message: 'Email already registered with different provider'
          });
        }

        // Create new user
        const playlistCode = await User.generatePlaylistCode();

        user = new User({
          username: profile.emails[0].value.split('@')[0] + '_' + Math.random().toString(36).substr(2, 5),
          email: profile.emails[0].value,
          authProvider: 'google',
          oauthId: profile.id,
          profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
          playlistCode: playlistCode,
          isActive: true,
          lastLogin: new Date()
        });

        await user.save();
        return done(null, user);

      } catch (error) {
        return done(error);
      }
    }
  ));
}

// ============================================
// GITHUB OAUTH STRATEGY
// ============================================
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/v1/auth/github/callback',
      scope: ['user:email'],
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists with this GitHub ID
        let user = await User.findOne({
          authProvider: 'github',
          oauthId: profile.id
        });

        if (user) {
          // Update existing user
          user.lastLogin = new Date();
          if (profile.photos && profile.photos.length > 0) {
            user.profilePicture = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // Get email from profile
        const email = profile.emails && profile.emails.length > 0
          ? profile.emails[0].value
          : `${profile.username}@github.local`;

        // Check if user exists with this email (different provider)
        user = await User.findOne({ email: email });

        if (user) {
          // Email already exists with different provider
          return done(null, false, {
            message: 'Email already registered with different provider'
          });
        }

        // Create new user
        const playlistCode = await User.generatePlaylistCode();

        user = new User({
          username: profile.username + '_' + Math.random().toString(36).substr(2, 5),
          email: email,
          authProvider: 'github',
          oauthId: profile.id,
          profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
          playlistCode: playlistCode,
          isActive: true,
          lastLogin: new Date()
        });

        await user.save();
        return done(null, user);

      } catch (error) {
        return done(error);
      }
    }
  ));
}

// ============================================
// FACEBOOK OAUTH STRATEGY
// ============================================
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/v1/auth/facebook/callback',
      profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
      passReqToCallback: true
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists with this Facebook ID
        let user = await User.findOne({
          authProvider: 'facebook',
          oauthId: profile.id
        });

        if (user) {
          // Update existing user
          user.lastLogin = new Date();
          if (profile.photos && profile.photos.length > 0) {
            user.profilePicture = profile.photos[0].value;
          }
          await user.save();
          return done(null, user);
        }

        // Get email from profile
        const email = profile.emails && profile.emails.length > 0
          ? profile.emails[0].value
          : `${profile.id}@facebook.local`;

        // Check if user exists with this email (different provider)
        user = await User.findOne({ email: email });

        if (user) {
          // Email already exists with different provider
          return done(null, false, {
            message: 'Email already registered with different provider'
          });
        }

        // Create new user
        const playlistCode = await User.generatePlaylistCode();

        const username = profile.name
          ? `${profile.name.givenName}_${profile.name.familyName}_${Math.random().toString(36).substr(2, 5)}`.toLowerCase()
          : `fb_${profile.id}`;

        user = new User({
          username: username,
          email: email,
          authProvider: 'facebook',
          oauthId: profile.id,
          profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
          playlistCode: playlistCode,
          isActive: true,
          lastLogin: new Date()
        });

        await user.save();
        return done(null, user);

      } catch (error) {
        return done(error);
      }
    }
  ));
}

module.exports = passport;
