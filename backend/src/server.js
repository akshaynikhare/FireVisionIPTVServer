const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'SUPER_ADMIN_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
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
      scriptSrc: ["'self'", "'unsafe-inline'", "https://vjs.zencdn.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://vjs.zencdn.net"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "blob:", "data:", "ws:", "wss:"],
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
    : (process.env.NODE_ENV === 'production' ? false : '*'),
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

// Static files for node_modules (AdminLTE, Bootstrap, etc.)
app.use('/vendor', express.static(path.join(PROJECT_ROOT, 'node_modules')));

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
app.use('/api/v1/test', require('./routes/channel-test'));
app.use('/api/v1/image-proxy', require('./routes/image-proxy'));
app.use('/api/v1/stream-proxy', require('./routes/stream-proxy'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/tv', require('./routes/tv'));
app.use('/api/v1/config', require('./routes/config'));

// Initialize Redis (optional - app works without it)
const { getRedisClient, isRedisReady, closeRedis } = require('./services/redis');
getRedisClient();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
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
  await closeRedis();
  mongoose.connection.close(() => {
    console.log('MongoDB and Redis connections closed');
    process.exit(0);
  });
});
