const express = require('express');
const router = express.Router();
const Playlist = require('../models/Playlist');

/**
 * Public endpoint to retrieve playlist by playlistCode without authentication
 * GET /api/v1/playlist/:code.m3u
 * Returns M3U playlist content for the given code
 */
router.get('/:code.m3u', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    
    if (!code || code.length !== 6) {
      return res.status(400).send('#EXTM3U\n#ERROR:Invalid playlist code format');
    }

    const playlist = await Playlist.findOne({ playlistCode: code });
    
    if (!playlist) {
      return res.status(404).send('#EXTM3U\n#ERROR:Playlist not found');
    }

    const m3u = await playlist.generateM3U();
    
    res.setHeader('Content-Type', 'audio/x-mpegurl');
    res.setHeader('Content-Disposition', `attachment; filename="${code}.m3u"`);
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    
    return res.send(m3u);
  } catch (error) {
    console.error('Public playlist endpoint error:', error);
    return res.status(500).send('#EXTM3U\n#ERROR:Internal server error');
  }
});

/**
 * Alternative endpoint format without .m3u extension
 * GET /api/v1/playlist/:code
 */
router.get('/:code', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    
    if (!code || code.length !== 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid playlist code format. Code must be 6 characters.' 
      });
    }

    const playlist = await Playlist.findOne({ playlistCode: code })
      .populate('userId', 'username')
      .lean();
    
    if (!playlist) {
      return res.status(404).json({ 
        success: false, 
        error: 'Playlist not found' 
      });
    }

    return res.json({
      success: true,
      playlist: {
        code: playlist.playlistCode,
        name: playlist.name,
        owner: playlist.userId?.username,
        channelCount: playlist.channels?.length || 0,
        isPublic: playlist.isPublic,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt
      }
    });
  } catch (error) {
    console.error('Public playlist info endpoint error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;
