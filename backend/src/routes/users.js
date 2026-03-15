const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');

// Get all users (Admin only)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const users = await User.find()
            .select('-password')
            .populate('channels', 'channelName channelGroup')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: users.length,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch users'
        });
    }
});

// Create new user (Admin only)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { username, password, email, role, isActive } = req.body;

        // Validate required fields
        if (!username || !password || !email) {
            return res.status(400).json({
                success: false,
                error: 'Username, password, and email are required'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Username or email already exists'
            });
        }

        // Generate unique channel list code
        const channelListCode = await User.generateChannelListCode();

        // Create new user
        const user = new User({
            username,
            password,
            email,
            role: role || 'User',
            channelListCode,
            isActive: isActive !== undefined ? isActive : true
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: user
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user'
        });
    }
});

// Get user by ID (Admin or own profile)
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is accessing their own profile or is admin
        if (req.user.role !== 'Admin' && req.user.id.toString() !== id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const user = await User.findById(id)
            .select('-password')
            .populate('channels', 'channelName channelGroup channelUrl');

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user'
        });
    }
});

// Update user (Admin or own profile)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, password, role, isActive } = req.body;

        // Check if user is accessing their own profile or is admin
        const isAdmin = req.user.role === 'Admin';
        const isOwnProfile = req.user.id.toString() === id;

        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Update fields
        if (username) user.username = username;
        if (email) user.email = email;
        if (password) user.password = password; // Will be hashed by pre-save hook

        // Only admin can change role and isActive
        if (isAdmin) {
            if (role !== undefined) user.role = role;
            if (isActive !== undefined) user.isActive = isActive;
        }

        await user.save();

        res.json({
            success: true,
            message: 'User updated successfully',
            data: user
        });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update user'
        });
    }
});

// Delete user (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete user'
        });
    }
});

// Note: Channel assignment removed - users manage their own channels via /api/v1/user-playlist





// Regenerate playlist code (Admin or own profile)
router.put('/:id/regenerate-code', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user is accessing their own profile or is admin
        if (req.user.role !== 'Admin' && req.user.id.toString() !== id) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Generate new code
        user.channelListCode = await User.generateChannelListCode();
        await user.save();

        res.json({
            success: true,
            message: 'Channel list code regenerated successfully',
            data: {
                channelListCode: user.channelListCode
            }
        });
    } catch (error) {
        console.error('Error regenerating code:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to regenerate code'
        });
    }
});

module.exports = router;
