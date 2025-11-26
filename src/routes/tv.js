const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PairingRequest = require('../models/PairingRequest');

// NO authentication required for TV endpoints

// Get playlist by code (TV App endpoint)
router.get('/playlist/:code', async (req, res) => {
    try {
        const { code } = req.params;

        if (!code || code.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid channel list code. Code must be 6 characters.'
            });
        }

        // Find user by channel list code
        const user = await User.findOne({
            channelListCode: code.toUpperCase(),
            isActive: true
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or inactive channel list code'
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
                error: 'Invalid channel list code. Code must be 6 characters.'
            });
        }

        // Find user by channel list code
        const user = await User.findOne({
            channelListCode: code.toUpperCase(),
            isActive: true
        }).populate('channels');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or inactive channel list code'
            });
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        const Channel = require('../models/Channel');
        let channels;

        if (user.role === 'Admin') {
            // Admin gets all channels
            channels = await Channel.find({}).sort({ channelGroup: 1, order: 1 });
        } else {
            // Regular users get only their assigned channels
            channels = await Channel.find({
                _id: { $in: user.channels }
            }).sort({ channelGroup: 1, order: 1 });
        }

        res.json({
            success: true,
            user: {
                username: user.username,
                channelListCode: user.channelListCode
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
                error: 'Invalid channel list code. Code must be 6 characters.'
            });
        }

        // Find user by channel list code
        const user = await User.findOne({
            channelListCode: code.toUpperCase(),
            isActive: true
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or inactive channel list code'
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
                channelListCode: user.channelListCode,
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
                error: 'Invalid channel list code format'
            });
        }

        const user = await User.findOne({
            channelListCode: code.toUpperCase(),
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

// ====================
// PIN-BASED PAIRING ENDPOINTS
// ====================

// Request new pairing (TV generates PIN)
router.post('/pairing/request', async (req, res) => {
    try {
        const { deviceName, deviceModel } = req.body;
        
        // Get pairing expiry from environment (default 10 minutes)
        const expiryMinutes = parseInt(process.env.PAIRING_PIN_EXPIRY_MINUTES || '10', 10);
        const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
        
        // Generate unique PIN
        const pin = await PairingRequest.generatePin();
        
        // Create pairing request
        const pairingRequest = new PairingRequest({
            pin,
            deviceName: deviceName || 'Android TV',
            deviceModel: deviceModel || 'Unknown Model',
            status: 'pending',
            expiresAt,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });
        
        await pairingRequest.save();
        
        console.log(`Pairing request created: PIN ${pin}, expires at ${expiresAt}`);
        
        res.json({
            success: true,
            pin,
            expiresAt,
            expiryMinutes,
            message: 'Enter this PIN on the web dashboard to pair your device'
        });
    } catch (error) {
        console.error('Error creating pairing request:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create pairing request'
        });
    }
});

// Confirm pairing (Web dashboard links user to PIN)
router.post('/pairing/confirm', async (req, res) => {
    try {
        const { pin, sessionId } = req.body;
        
        if (!pin || pin.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format. PIN must be 6 digits.'
            });
        }
        
        if (!sessionId) {
            return res.status(401).json({
                success: false,
                error: 'Session ID required for authentication'
            });
        }
        
        // Verify session and get user
        const Session = require('../models/Session');
        const session = await Session.findOne({ sessionId }).populate('userId');
        
        if (!session || !session.userId) {
            return res.status(401).json({
                success: false,
                error: 'Invalid or expired session'
            });
        }
        
        const user = session.userId;
        
        // Find pairing request
        const pairingRequest = await PairingRequest.findOne({
            pin: pin.toString(),
            status: 'pending'
        });
        
        if (!pairingRequest) {
            return res.status(404).json({
                success: false,
                error: 'Invalid or expired PIN'
            });
        }
        
        // Check if expired
        if (pairingRequest.isExpired()) {
            await pairingRequest.markExpired();
            return res.status(400).json({
                success: false,
                error: 'PIN has expired. Please generate a new one on your TV.'
            });
        }
        
        // Link user to pairing request
        pairingRequest.userId = user._id;
        pairingRequest.status = 'completed';
        await pairingRequest.save();
        
        // Update user metadata
        user.metadata = user.metadata || {};
        user.metadata.lastPairedDevice = pairingRequest.deviceName;
        user.metadata.deviceModel = pairingRequest.deviceModel;
        user.metadata.pairedAt = new Date();
        user.lastLogin = new Date();
        await user.save();
        
        console.log(`Pairing confirmed: PIN ${pin} linked to user ${user.username}`);
        
        res.json({
            success: true,
            message: 'Device paired successfully',
            device: {
                name: pairingRequest.deviceName,
                model: pairingRequest.deviceModel
            },
            user: {
                username: user.username,
                channelListCode: user.channelListCode,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Error confirming pairing:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm pairing'
        });
    }
});

// Check pairing status (TV polls this endpoint)
router.get('/pairing/status/:pin', async (req, res) => {
    try {
        const { pin } = req.params;
        
        if (!pin || pin.length !== 6) {
            return res.status(400).json({
                success: false,
                error: 'Invalid PIN format'
            });
        }
        
        // Find pairing request
        const pairingRequest = await PairingRequest.findOne({
            pin: pin.toString()
        }).populate('userId');
        
        if (!pairingRequest) {
            return res.json({
                success: false,
                paired: false,
                status: 'invalid',
                message: 'PIN not found'
            });
        }
        
        // Check if expired
        if (pairingRequest.isExpired() && pairingRequest.status === 'pending') {
            await pairingRequest.markExpired();
            return res.json({
                success: false,
                paired: false,
                status: 'expired',
                message: 'PIN has expired. Please request a new one.'
            });
        }
        
        // Check if completed
        if (pairingRequest.status === 'completed' && pairingRequest.userId) {
            const user = pairingRequest.userId;
            return res.json({
                success: true,
                paired: true,
                status: 'completed',
                channelListCode: user.channelListCode,
                username: user.username,
                role: user.role,
                message: 'Device paired successfully!'
            });
        }
        
        // Still pending
        res.json({
            success: true,
            paired: false,
            status: 'pending',
            expiresAt: pairingRequest.expiresAt,
            message: 'Waiting for user to confirm pairing on web dashboard...'
        });
    } catch (error) {
        console.error('Error checking pairing status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check pairing status'
        });
    }
});

module.exports = router;
