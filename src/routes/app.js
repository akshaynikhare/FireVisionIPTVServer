const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const AppVersion = require('../models/AppVersion');

// Check for app updates
router.get('/version', async (req, res) => {
  try {
    const { currentVersion } = req.query;

    if (!currentVersion) {
      return res.status(400).json({
        success: false,
        error: 'Current version is required'
      });
    }

    const currentVersionCode = parseInt(currentVersion);

    if (isNaN(currentVersionCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version code'
      });
    }

    const updateInfo = await AppVersion.checkUpdate(currentVersionCode);

    res.json({
      success: true,
      ...updateInfo
    });
  } catch (error) {
    console.error('Error checking version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check version'
    });
  }
});

// Get latest version info
router.get('/latest', async (req, res) => {
  try {
    const latestVersion = await AppVersion.getLatestVersion();

    if (!latestVersion) {
      return res.status(404).json({
        success: false,
        error: 'No version available'
      });
    }

    res.json({
      success: true,
      data: latestVersion
    });
  } catch (error) {
    console.error('Error fetching latest version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest version'
    });
  }
});

// Download APK
router.get('/download', async (req, res) => {
  try {
    const { version } = req.query;

    let appVersion;

    if (version) {
      const versionCode = parseInt(version);
      appVersion = await AppVersion.findOne({ versionCode, isActive: true });
    } else {
      appVersion = await AppVersion.getLatestVersion();
    }

    if (!appVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    const apkPath = path.join(
      process.env.APK_STORAGE_PATH || './apks',
      appVersion.apkFileName
    );

    // Check if file exists
    try {
      await fs.access(apkPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        error: 'APK file not found'
      });
    }

    // Set headers for APK download
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${appVersion.apkFileName}"`);
    res.setHeader('Content-Length', appVersion.apkFileSize);

    // Stream the file
    const fileStream = require('fs').createReadStream(apkPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading APK:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download APK'
    });
  }
});

// Get download URL for latest APK
router.get('/download-url', async (req, res) => {
  try {
    const latestVersion = await AppVersion.getLatestVersion();

    if (!latestVersion) {
      return res.status(404).json({
        success: false,
        error: 'No version available'
      });
    }

    res.json({
      success: true,
      data: {
        versionName: latestVersion.versionName,
        versionCode: latestVersion.versionCode,
        downloadUrl: latestVersion.downloadUrl,
        fileSize: latestVersion.apkFileSize,
        releaseNotes: latestVersion.releaseNotes,
        isMandatory: latestVersion.isMandatory
      }
    });
  } catch (error) {
    console.error('Error getting download URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get download URL'
    });
  }
});

// Simple /apk endpoint - downloads latest APK directly
router.get('/apk', async (req, res) => {
  try {
    const latestVersion = await AppVersion.getLatestVersion();

    if (!latestVersion) {
      return res.status(404).send('No APK version available. Please upload an APK first.');
    }

    const apkPath = path.join(
      process.env.APK_STORAGE_PATH || './apks',
      latestVersion.apkFileName
    );

    // Check if file exists
    try {
      await fs.access(apkPath);
    } catch (error) {
      return res.status(404).send('APK file not found on server.');
    }

    // Set headers for APK download
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${latestVersion.apkFileName}"`);
    res.setHeader('Content-Length', latestVersion.apkFileSize);

    // Stream the file
    const fileStream = require('fs').createReadStream(apkPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading APK via /apk endpoint:', error);
    res.status(500).send('Failed to download APK. Please try again later.');
  }
});

module.exports = router;
