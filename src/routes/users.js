const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Channel = require('../models/Channel');
const { requireAuth, requireAdmin } = require('./auth');

// Apply authentication to all routes
router.use(requireAuth);

// Get all users (Admin only)
router.get('/', requireAdmin, async (req, res) => {
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
router.post('/', requireAdmin, async (req, res) => {
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

        // Generate unique playlist code
        const playlistCode = await User.generatePlaylistCode();

        // Create new user
        const user = new User({
            username,
            password,
            email,
            role: role || 'User',
            playlistCode,
            authProvider: 'local',
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
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id.toString();

        // Check if user is accessing their own profile or is admin
        if (req.user.role !== 'Admin' && currentUserId !== id) {
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
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id.toString();
        const { username, email, password, role, isActive } = req.body;

        // Check if user is accessing their own profile or is admin
        const isAdmin = req.user.role === 'Admin';
        const isOwnProfile = currentUserId === id;

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
router.delete('/:id', requireAdmin, async (req, res) => {
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

// Assign channels to user (Admin only)
router.post('/:id/channels', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { channelIds } = req.body;

        if (!Array.isArray(channelIds)) {
            return res.status(400).json({
                success: false,
                error: 'channelIds must be an array'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Verify all channel IDs exist
        const channels = await Channel.find({ _id: { $in: channelIds } });
        if (channels.length !== channelIds.length) {
            return res.status(400).json({
                success: false,
                error: 'Some channel IDs are invalid'
            });
        }

        user.channels = channelIds;
        await user.save();

        res.json({
            success: true,
            message: 'Channels assigned successfully',
            data: {
                userId: user._id,
                channelsCount: channelIds.length
            }
        });
    } catch (error) {
        console.error('Error assigning channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to assign channels'
        });
    }
});

// Add channels to user (Admin only)
router.post('/:id/channels/add', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { channelIds } = req.body;

        if (!Array.isArray(channelIds)) {
            return res.status(400).json({
                success: false,
                error: 'channelIds must be an array'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Add new channels without duplicates
        const existingIds = user.channels.map(id => id.toString());
        const newChannelIds = channelIds.filter(id => !existingIds.includes(id.toString()));

        if (newChannelIds.length === 0) {
            return res.json({
                success: true,
                message: 'No new channels to add',
                data: {
                    userId: user._id,
                    channelsCount: user.channels.length
                }
            });
        }

        user.channels.push(...newChannelIds);
        await user.save();

        res.json({
            success: true,
            message: `Added ${newChannelIds.length} channels`,
            data: {
                userId: user._id,
                channelsCount: user.channels.length,
                addedCount: newChannelIds.length
            }
        });
    } catch (error) {
        console.error('Error adding channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add channels'
        });
    }
});

// Remove channels from user (Admin only)
router.post('/:id/channels/remove', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { channelIds } = req.body;

        if (!Array.isArray(channelIds)) {
            return res.status(400).json({
                success: false,
                error: 'channelIds must be an array'
            });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const beforeCount = user.channels.length;
        user.channels = user.channels.filter(
            id => !channelIds.includes(id.toString())
        );
        await user.save();

        const removedCount = beforeCount - user.channels.length;

        res.json({
            success: true,
            message: `Removed ${removedCount} channels`,
            data: {
                userId: user._id,
                channelsCount: user.channels.length,
                removedCount
            }
        });
    } catch (error) {
        console.error('Error removing channels:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove channels'
        });
    }
});

// Regenerate playlist code (Admin or own profile)
router.put('/:id/regenerate-code', async (req, res) => {
    try {
        const { id } = req.params;
        const currentUserId = req.user._id.toString();

        // Check if user is accessing their own profile or is admin
        if (req.user.role !== 'Admin' && currentUserId !== id) {
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
        user.playlistCode = await User.generatePlaylistCode();
        await user.save();

        res.json({
            success: true,
            message: 'Playlist code regenerated successfully',
            data: {
                playlistCode: user.playlistCode
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
