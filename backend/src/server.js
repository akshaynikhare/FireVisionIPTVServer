const Sentry = require('@sentry/node');
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

Sentry.init({
  dsn: process.env.BACKEND_SENTRY_DSN,
  integrations: [Sentry.httpIntegration()],
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV ?? 'development',
  enabled: !!process.env.BACKEND_SENTRY_DSN,
});

// Validate required environment variables
{
  const required = [
    'MONGODB_URI',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'SUPER_ADMIN_PASSWORD',
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    } else {
      console.warn(
        `WARNING: Missing environment variables: ${missing.join(', ')} — some features may not work`,
      );
    }
  }
}

// Resolve paths relative to project root (two levels up from backend/src/)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const app = express();

// Trust reverse proxy (Docker/Portainer/nginx) so rate-limiter
// uses the real client IP from X-Forwarded-For
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);
app.use(compression());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
      : process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  }),
);

// Cookie parser (needed for OAuth state cookies)
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Route-specific larger body limit for M3U import (must be BEFORE the global 5MB parser)
app.use('/api/v1/admin/channels/import-m3u', express.json({ limit: '50mb' }));

// Default body limit is 5MB for all other routes
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('combined'));

// CSRF protection: validate Origin/Referer on state-changing requests
const { csrfProtection } = require('./middleware/csrfProtection');
app.use(csrfProtection);

// Rate limiting
const Session = require('./models/Session');
const jwt = require('jsonwebtoken');

// In-memory TTL cache for admin-session lookups to avoid hitting MongoDB
// on every single API request. Entries expire after 60 seconds.
const adminSessionCache = new Map(); // key: sessionId, value: { isAdmin, expiresAt }
const ADMIN_CACHE_TTL_MS = 60_000;
const ADMIN_CACHE_MAX_SIZE = 5_000;

function getCachedAdminSession(sessionId) {
  const entry = adminSessionCache.get(sessionId);
  if (!entry) return null;
  if (Date.now() > entry.cachedUntil) {
    adminSessionCache.delete(sessionId);
    return null;
  }
  return entry;
}

function setCachedAdminSession(sessionId, isAdmin, expiresAt) {
  if (adminSessionCache.size >= ADMIN_CACHE_MAX_SIZE) {
    // Evict oldest entry instead of clearing all — prevents thundering herd
    const oldestKey = adminSessionCache.keys().next().value;
    if (oldestKey) adminSessionCache.delete(oldestKey);
  }
  adminSessionCache.set(sessionId, {
    isAdmin,
    expiresAt,
    cachedUntil: Date.now() + ADMIN_CACHE_TTL_MS,
  });
}

// Resolve a per-user rate-limit key from session or JWT, falling back to IP.
// Keys are always anchored to the client IP so that an attacker cannot bypass
// the rate limit by cycling fake session IDs or JWTs.
function resolveRateLimitIdentity(req) {
  // Session-based auth (frontend dashboard)
  const sessionId = req.headers['x-session-id'];
  if (sessionId) return { key: `sess:${sessionId}:${req.ip}`, sessionId };

  // JWT auth (TV app / API clients)
  const auth = req.headers.authorization || '';
  const [, token] = auth.split(' ');
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
      });
      if (payload.sub) return { key: `jwt:${payload.sub}:${req.ip}` };
    } catch {
      // Invalid/expired token — fall through to IP-based limiting
    }
  }

  return null;
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Key by user identity + IP when authenticated, otherwise by IP alone
  keyGenerator: (req) => {
    const identity = resolveRateLimitIdentity(req);
    return identity ? identity.key : req.ip;
  },
  // Skip rate limiting entirely for authenticated admin sessions (cached)
  skip: async (req) => {
    try {
      const sessionId = req.headers['x-session-id'];
      if (!sessionId) return false;

      // Check in-memory cache first
      const cached = getCachedAdminSession(sessionId);
      if (cached) {
        return cached.isAdmin && cached.expiresAt > new Date();
      }

      // Cache miss — query MongoDB and cache the result
      const session = await Session.findOne({ sessionId }, { role: 1, expiresAt: 1 }).lean();
      const isAdmin = !!(session && session.role === 'Admin' && session.expiresAt > new Date());
      setCachedAdminSession(sessionId, isAdmin, session?.expiresAt);
      return isAdmin;
    } catch {
      return false;
    }
  },
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);
app.use('/api/v1/auth/verify-email', authLimiter);
app.use('/api/v1/auth/reset-password', authLimiter);
app.use('/api/v1/jwt/login', authLimiter);

// Stricter rate limit for forgot-password and resend-verification
// Per-IP limit: 3 requests per hour
const emailActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
});
// Per-account limit: key by email in request body (prevents abuse of a single account)
const emailAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body && req.body.email) || '';
    return `email-action:${email.toLowerCase().trim()}:${req.ip}`;
  },
});
app.use('/api/v1/auth/forgot-password', emailActionLimiter, emailAccountLimiter);
app.use('/api/v1/auth/resend-verification', emailActionLimiter, emailAccountLimiter);

// OAuth rate limiting — prevent abuse of OAuth initiation endpoints
const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/v1/oauth/google/start', oauthLimiter);
app.use('/api/v1/oauth/github/start', oauthLimiter);

// Strict rate limiting for TV pairing mutation endpoints (prevent PIN brute-force)
const pairingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many pairing attempts, please try again later' },
});
app.use('/api/v1/tv/pairing/confirm', pairingLimiter);
app.use('/api/v1/tv/pair', pairingLimiter);
app.use('/api/v1/tv/verify', pairingLimiter);

// Permissive rate limiting for pairing status polling (TV polls this endpoint repeatedly)
// PIN expires in 10 minutes; allow up to 120 polls per 10-minute window (~1 every 5 seconds)
const pairingStatusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many status requests, please slow down' },
});
app.use('/api/v1/tv/pairing/status', pairingStatusLimiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(PROJECT_ROOT, 'uploads')));

// Routes
const { router: authRouter } = require('./routes/auth');
const { router: jwtRouter } = require('./routes/jwt');
const publicAuthRouter = require('./routes/publicAuth');
const oauthRouter = require('./routes/oauth');
const userPlaylistRouter = require('./routes/user-playlist');
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/jwt', jwtRouter);
app.use('/api/v1/public', publicAuthRouter);
app.use('/api/v1/oauth', oauthRouter);
app.use('/api/v1/user-playlist', userPlaylistRouter);
app.use('/api/v1/channels', require('./routes/channels'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/favorites', require('./routes/favorites'));
// App update routes (GitHub-based APK delivery)
app.use('/api/v1/app', require('./routes/app-update'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/iptv-org', require('./routes/iptv-org'));
app.use('/api/v1/external-sources', require('./routes/external-sources'));
app.use('/api/v1/test', require('./routes/channel-test'));
app.use('/api/v1/image-proxy', require('./routes/image-proxy'));
app.use('/api/v1/stream-proxy', require('./routes/stream-proxy'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/tv', require('./routes/tv'));
app.use('/api/v1/epg', require('./routes/epg'));
app.use('/api/v1/config', require('./routes/config'));
app.use('/api/v1/activity', require('./routes/activity'));
app.use('/api/v1/scheduler', require('./routes/scheduler'));

// Initialize Redis (optional - app works without it)
const { getRedisClient, isRedisReady, closeRedis } = require('./services/redis');
getRedisClient();

// Health check
app.get('/health', (req, res) => {
  const healthy = mongoose.connection.readyState === 1;
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '0.0.0',
    mongodb: healthy ? 'connected' : 'disconnected',
    redis: isRedisReady() ? 'connected' : 'disconnected',
  });
});

// Sentry error handler must come before the default error handler
app.use(Sentry.expressErrorHandler());

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal Server Error' : err.message,
      status,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404,
    },
  });
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const PORT = process.env.PORT || 3000;
let httpServer = null;

mongoose
  .connect(MONGODB_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(async () => {
    console.log('✅ Connected to MongoDB');

    // Initialize Super Admin user
    const { initializeSuperAdmin } = require('./utils/initSuperAdmin');
    await initializeSuperAdmin();

    // Initialize optional test user (only if TEST_USER_USERNAME is set)
    const { initializeTestUser } = require('./utils/initTestUser');
    await initializeTestUser();

    // Load seed channels from JSON (YouTube Live + Prasar Bharati)
    const { initializeSeedChannels } = require('./utils/initSeedChannels');
    await initializeSeedChannels();

    // Initialize IPTV-org cache (populate from DB or fetch if empty)
    const { iptvOrgCacheService } = require('./services/iptv-org-cache');
    iptvOrgCacheService.initializeOnStartup().catch((err) => {
      console.error('iptv-org cache initialization failed:', err.message);
    });

    // Initialize EPG service (auto-fetch program guides)
    const { epgService } = require('./services/epg-service');
    epgService.initializeOnStartup().catch((err) => {
      console.error('EPG service initialization failed:', err.message);
    });

    // Initialize scheduler service (liveness checks, EPG refresh, cache refresh)
    // Only start interval timers if the external scheduler container is not running
    if (process.env.DISABLE_SCHEDULER !== 'true') {
      const { schedulerService } = require('./services/scheduler-service');
      schedulerService.start().catch((err) => {
        console.error('Scheduler service start failed:', err.message);
      });
    } else {
      console.log('[scheduler] Disabled — running in separate container');
    }

    // Start server
    httpServer = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📺 FireVision IPTV Server v1.0.0`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📧 Email provider: ${process.env.MAIL_PROVIDER || 'mailhog'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`${signal} received: shutting down gracefully`);
  try {
    const { epgService } = require('./services/epg-service');
    epgService.stopBackgroundUpdates();
  } catch {
    /* ignore if not loaded */
  }
  try {
    const { schedulerService } = require('./services/scheduler-service');
    schedulerService.stop();
  } catch {
    /* ignore if not loaded */
  }
  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
    console.log('HTTP server closed — no longer accepting connections');
  }
  await closeRedis();
  await mongoose.connection.close();
  console.log('MongoDB and Redis connections closed');
  process.exit(0);
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
