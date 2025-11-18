const express = require('express');
const router = express.Router();
const User = require('../models/User');

// NO authentication required for TV endpoints

// Get playlist by code (TV App endpoint)
router.get('/playlist/:code', async (req, res) => {
    try {
        const { code } = req.params;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid playlist code. Code must be 6 characters.'
            });
        }

        // Find user by playlist code
        const user = await User.findOne({
            playlistCode: code.toUpperCase(),
            isActive: true
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or inactive playlist code'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate M3U playlist for this user
        const m3uContent = await user.generateUserPlaylist();

        // Set response headers for M3U
        res.setHeader('Content-Type', 'audio/x-mpegurl');
        res.setHeader('Content-Disposition', `attachment; filename="${user.username}-playlist.m3u"`);
        res.send(m3uContent);
    } catch (error) {
        console.error('Error fetching playlist:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch playlist'
        });
    }
});

// Get playlist as JSON (alternative format for TV apps)
router.get('/playlist/:code/json', async (req, res) => {
    try {
        const { code } = req.params;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid playlist code. Code must be 6 characters.'
            });
        }

        // Find user by playlist code
        const user = await User.findOne({
            playlistCode: code.toUpperCase(),
            isActive: true
        }).populate('channels');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or inactive playlist code'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        const Channel = require('../models/Channel');
        let channels;

        if (user.role === 'Admin') {
            // Admin gets all active channels
            channels = await Channel.find({ isActive: true }).sort({ channelGroup: 1, order: 1 });
        } else {
            // Regular users get only their assigned channels
            channels = await Channel.find({
                _id: { $in: user.channels },
                isActive: true
            }).sort({ channelGroup: 1, order: 1 });
        }

        res.json({
            success: true,
            user: {
                username: user.username,
                playlistCode: user.playlistCode
            },
            count: channels.length,
            channels: channels
        });
    } catch (error) {
        console.error('Error fetching playlist JSON:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch playlist'
        });
    }
});

// Pair device with code (verify code exists)
router.post('/pair', async (req, res) => {
    try {
        const { code, deviceName, deviceModel } = req.body;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid playlist code. Code must be 6 characters.'
            });
        }

        // Find user by playlist code
        const user = await User.findOne({
            playlistCode: code.toUpperCase(),
            isActive: true
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or inactive playlist code'
            });
        }

        // Update device metadata
        user.metadata = user.metadata || {};
        user.metadata.lastPairedDevice = deviceName || 'Unknown Device';
        user.metadata.deviceModel = deviceModel || 'Unknown Model';
        user.metadata.pairedAt = new Date();
        user.lastLogin = new Date();

        await user.save();

        res.json({
            success: true,
            message: 'Device paired successfully',
            data: {
                username: user.username,
                playlistCode: user.playlistCode,
                channelsCount: user.role === 'Admin' ? 'All' : user.channels.length
            }
        });
    } catch (error) {
        console.error('Error pairing device:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to pair device'
        });
    }
});

// Verify code (check if valid without pairing)
router.get('/verify/:code', async (req, res) => {
    try {
        const { code } = req.params;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid playlist code format'
            });
        }

        const user = await User.findOne({
            playlistCode: code.toUpperCase(),
            isActive: true
        });

        if (!user) {
            return res.json({
                success: false,
                valid: false,
                message: 'Invalid or inactive code'
            });
        }

        res.json({
            success: true,
            valid: true,
            data: {
                username: user.username,
                role: user.role,
                channelsCount: user.role === 'Admin' ? 'All' : user.channels.length
            }
        });
    } catch (error) {
        console.error('Error verifying code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify code'
        });
    }
});

module.exports = router;
