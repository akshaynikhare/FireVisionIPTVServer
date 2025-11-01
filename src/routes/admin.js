const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Channel = require('../models/Channel');
const AppVersion = require('../models/AppVersion');
const { requireAuth } = require('./auth');

// Apply session authentication to all admin routes
router.use(requireAuth);

// ============ CHANNEL MANAGEMENT ============

// Create new channel
router.post('/channels', async (req, res) => {
  try {
    const channel = new Channel(req.body);
    await channel.save();

    res.status(201).json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error creating channel:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create channel'
    });
  }
});

// Update channel
router.put('/channels/:id', async (req, res) => {
  try {
    const channel = await Channel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update channel'
    });
  }
});

// Delete channel
router.delete('/channels/:id', async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);

    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found'
      });
    }

    res.json({
      success: true,
      message: 'Channel deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete channel'
    });
  }
});

// Bulk import channels from M3U
router.post('/channels/import-m3u', async (req, res) => {
  try {
    const { m3uContent, clearExisting } = req.body;

    if (!m3uContent) {
      return res.status(400).json({
        success: false,
        error: 'M3U content is required'
      });
    }

    // Clear existing channels if requested
    if (clearExisting) {
      await Channel.deleteMany({});
    }

    // Parse M3U content
    const lines = m3uContent.split('\n');
    const channels = [];
    let currentChannel = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXTINF:')) {
        // Parse channel metadata
        const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
        const tvgNameMatch = line.match(/tvg-name="([^"]*)"/);
        const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
        const groupTitleMatch = line.match(/group-title="([^"]*)"/);
        const channelNameMatch = line.match(/,(.+)$/);

        currentChannel = {
          channelId: tvgIdMatch ? tvgIdMatch[1] : `channel_${Date.now()}_${i}`,
          tvgName: tvgNameMatch ? tvgNameMatch[1] : '',
          channelImg: tvgLogoMatch ? tvgLogoMatch[1] : '',
          tvgLogo: tvgLogoMatch ? tvgLogoMatch[1] : '',
          channelGroup: groupTitleMatch ? groupTitleMatch[1] : 'Uncategorized',
          channelName: channelNameMatch ? channelNameMatch[1].trim() : 'Unknown',
          order: channels.length
        };
      } else if (line && !line.startsWith('#') && currentChannel) {
        // This is the stream URL
        currentChannel.channelUrl = line;
        channels.push(currentChannel);
        currentChannel = null;
      }
    }

    // Insert channels into database
    const insertedChannels = await Channel.insertMany(channels, { ordered: false });

    res.json({
      success: true,
      message: `Successfully imported ${insertedChannels.length} channels`,
      count: insertedChannels.length
    });
  } catch (error) {
    console.error('Error importing M3U:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to import M3U'
    });
  }
});

// Get all channels including inactive (for admin)
router.get('/channels', async (req, res) => {
  try {
    const { group, isActive } = req.query;
    const filter = {};

    if (group) filter.channelGroup = group;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const channels = await Channel.find(filter)
      .sort({ channelGroup: 1, order: 1 });

    res.json({
      success: true,
      count: channels.length,
      data: channels
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch channels'
    });
  }
});

// ============ APP VERSION MANAGEMENT ============

// Configure multer for APK uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = process.env.APK_STORAGE_PATH || './apks';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueName = `firevision-iptv-${Date.now()}.apk`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 // 100MB default
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.apk') {
      cb(null, true);
    } else {
      cb(new Error('Only APK files are allowed'));
    }
  }
});

// Upload new APK version
router.post('/app/upload', upload.single('apk'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'APK file is required'
      });
    }

    const { versionName, versionCode, releaseNotes, isMandatory, minCompatibleVersion } = req.body;

    if (!versionName || !versionCode) {
      return res.status(400).json({
        success: false,
        error: 'versionName and versionCode are required'
      });
    }

    const downloadUrl = `${req.protocol}://${req.get('host')}/apks/${req.file.filename}`;

    const appVersion = new AppVersion({
      versionName,
      versionCode: parseInt(versionCode),
      apkFileName: req.file.filename,
      apkFileSize: req.file.size,
      downloadUrl,
      releaseNotes: releaseNotes || '',
      isMandatory: isMandatory === 'true',
      minCompatibleVersion: minCompatibleVersion ? parseInt(minCompatibleVersion) : 1
    });

    await appVersion.save();

    res.status(201).json({
      success: true,
      message: 'APK uploaded successfully',
      data: appVersion
    });
  } catch (error) {
    console.error('Error uploading APK:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload APK'
    });
  }
});

// Get all app versions
router.get('/app/versions', async (req, res) => {
  try {
    const versions = await AppVersion.find().sort({ versionCode: -1 });

    res.json({
      success: true,
      count: versions.length,
      data: versions
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch versions'
    });
  }
});

// Update app version
router.put('/app/versions/:id', async (req, res) => {
  try {
    const appVersion = await AppVersion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!appVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    res.json({
      success: true,
      data: appVersion
    });
  } catch (error) {
    console.error('Error updating version:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update version'
    });
  }
});

// Delete app version
router.delete('/app/versions/:id', async (req, res) => {
  try {
    const appVersion = await AppVersion.findById(req.params.id);

    if (!appVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    // Delete APK file
    const apkPath = path.join(
      process.env.APK_STORAGE_PATH || './apks',
      appVersion.apkFileName
    );

    try {
      await fs.unlink(apkPath);
    } catch (error) {
      console.warn('Could not delete APK file:', error.message);
    }

    await appVersion.deleteOne();

    res.json({
      success: true,
      message: 'Version deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete version'
    });
  }
});

// ============ STATISTICS ============

router.get('/stats', async (req, res) => {
  try {
    const totalChannels = await Channel.countDocuments();
    const activeChannels = await Channel.countDocuments({ isActive: true });
    const channelsByGroup = await Channel.aggregate([
      {
        $group: {
          _id: '$channelGroup',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const totalVersions = await AppVersion.countDocuments();
    const latestVersion = await AppVersion.getLatestVersion();

    res.json({
      success: true,
      data: {
        channels: {
          total: totalChannels,
          active: activeChannels,
          inactive: totalChannels - activeChannels,
          byGroup: channelsByGroup
        },
        app: {
          totalVersions,
          latestVersion
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

module.exports = router;
