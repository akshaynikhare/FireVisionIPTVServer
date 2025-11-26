const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

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
  origin: process.env.ALLOWED_ORIGINS || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('combined'));

// Rate limiting (disabled for development)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 1000, // limit each IP to 1000 requests per windowMs
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/', limiter);

// Static files for APK downloads
app.use('/apks', express.static(process.env.APK_STORAGE_PATH || './apks'));

// Static files for node_modules (AdminLTE, Bootstrap, etc.)
app.use('/vendor', express.static('node_modules'));

// Static files for admin UI
app.use('/admin', express.static('public/admin'));

// Static files for public homepage
app.use(express.static('public'));

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
// Use simplified JSON-based app routes instead of MongoDB-based
app.use('/api/v1/app', require('./routes/app-simple'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/iptv-org', require('./routes/iptv-org'));
app.use('/api/v1/test', require('./routes/channel-test'));
app.use('/api/v1/image-proxy', require('./routes/image-proxy'));
app.use('/api/v1/stream-proxy', require('./routes/stream-proxy'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/tv', require('./routes/tv'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint - now serves static HTML from public/index.html
// The static middleware above will handle serving the homepage

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: err.status || 500
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

mongoose.connect(MONGODB_URI)
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
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});
