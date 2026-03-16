const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables
{
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SUPER_ADMIN_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`Missing required environment variables: ${missing.join(', ')}`);
      process.exit(1);
    } else {
      console.warn(`WARNING: Missing environment variables: ${missing.join(', ')} — some features may not work`);
    }
  }
}

// Resolve paths relative to project root (two levels up from backend/src/)
const PROJECT_ROOT = path.resolve(__dirname, '../..');

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://vjs.zencdn.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://vjs.zencdn.net"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "wss:", "blob:", "data:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "blob:", "data:", "https:", "http:"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'", "blob:"],
    },
  },
}));
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
    : (process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:3001']),
  credentials: true
}));

// Cookie parser (needed for OAuth state cookies)
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// Route-specific larger body limit for M3U import (must be BEFORE the global 5MB parser)
app.use('/api/v1/admin/channels/import-m3u', express.json({ limit: '50mb' }));

// Default body limit is 5MB for all other routes
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('combined'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
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
app.use('/api/v1/jwt/login', authLimiter);

// Strict rate limiting for TV pairing endpoints (prevent PIN brute-force)
const pairingLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 attempts per 5 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many pairing attempts, please try again later' },
});
app.use('/api/v1/tv/pairing/confirm', pairingLimiter);
app.use('/api/v1/tv/pairing/status', pairingLimiter);
app.use('/api/v1/tv/pair', pairingLimiter);
app.use('/api/v1/tv/verify', pairingLimiter);

// Static files for specific vendor packages only (not the entire node_modules tree)
const vendorAllowList = ['adminlte', 'bootstrap', 'jquery', '@fortawesome'];
app.use('/vendor', (req, res, next) => {
  const reqPath = decodeURIComponent(req.path).replace(/\\/g, '/');
  const topDir = reqPath.split('/').filter(Boolean)[0] || '';
  if (vendorAllowList.some(pkg => topDir === pkg || (topDir.startsWith('@') && vendorAllowList.includes(topDir)))) {
    return next();
  }
  res.status(404).send('Not found');
}, express.static(path.join(PROJECT_ROOT, 'node_modules')));

// Static files for admin UI
app.use('/admin', express.static(path.join(PROJECT_ROOT, 'public/admin')));

// Static files for public homepage
app.use(express.static(path.join(PROJECT_ROOT, 'public')));

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

// Initialize Redis (optional - app works without it)
const { getRedisClient, isRedisReady, closeRedis } = require('./services/redis');
getRedisClient();

// Health check (minimal info in production to avoid reconnaissance)
app.get('/health', (req, res) => {
  const healthy = mongoose.connection.readyState === 1;
  if (process.env.NODE_ENV === 'production') {
    return res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded' });
  }
  res.json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: healthy ? 'connected' : 'disconnected',
    redis: isRedisReady() ? 'connected' : 'disconnected'
  });
});

// Root endpoint - now serves static HTML from public/index.html
// The static middleware above will handle serving the homepage

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).json({
    error: {
      message: status === 500 ? 'Internal Server Error' : err.message,
      status
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: 'Route not found',
      status: 404
    }
  });
});

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/firevision-iptv';
const PORT = process.env.PORT || 3000;

mongoose.connect(MONGODB_URI, {
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

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📺 FireVision IPTV Server v1.0.0`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  try {
    const { epgService } = require('./services/epg-service');
    epgService.stopBackgroundUpdates();
  } catch (e) { /* ignore if not loaded */ }
  await closeRedis();
  await mongoose.connection.close();
  console.log('MongoDB and Redis connections closed');
  process.exit(0);
});
