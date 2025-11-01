const express = require('express');
const router = express.Router();

// Simple session storage (in production, use Redis or database)
const sessions = new Map();

// Static admin credentials (in production, use database with hashed passwords)
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    const sessionId = req.headers['x-session-id'];

    if (sessionId && sessions.has(sessionId)) {
        const session = sessions.get(sessionId);
        if (session.expiresAt > Date.now()) {
            req.user = session.user;
            return next();
        } else {
            sessions.delete(sessionId);
        }
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized'
    });
};

// Login endpoint
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Generate session ID
        const sessionId = require('crypto').randomBytes(32).toString('hex');

        // Store session (expires in 24 hours)
        sessions.set(sessionId, {
            user: { username },
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        });

        res.json({
            success: true,
            sessionId,
            user: { username }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Invalid credentials'
        });
    }
});

// Logout endpoint
router.post('/logout', (req, res) => {
    const sessionId = req.headers['x-session-id'];

    if (sessionId) {
        sessions.delete(sessionId);
    }

    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});

// Check session endpoint
router.get('/me', requireAuth, (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

module.exports = { router, requireAuth };
