const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;

// Path to versions.json file and apks directory
const VERSIONS_FILE = path.join(__dirname, '../../versions.json');
const APKS_DIR = path.join(__dirname, '../../apks');

// Helper function to read versions from JSON file
async function getVersionsData() {
  try {
    const data = await fs.readFile(VERSIONS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading versions.json:', error);
    return { versions: [], latestVersion: null };
  }
}

// Helper function to get latest active version
function getLatestVersion(versionsData) {
  const activeVersions = versionsData.versions.filter(v => v.isActive);
  if (activeVersions.length === 0) return null;

  // Sort by version code descending
  activeVersions.sort((a, b) => b.versionCode - a.versionCode);
  return activeVersions[0];
}

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

    const versionsData = await getVersionsData();
    const latestVersion = getLatestVersion(versionsData);

    if (!latestVersion) {
      return res.json({
        success: true,
        updateAvailable: false,
        message: 'No updates available'
      });
    }

    const updateAvailable = latestVersion.versionCode > currentVersionCode;

    res.json({
      success: true,
      updateAvailable,
      latestVersion: latestVersion.versionName,
      latestVersionCode: latestVersion.versionCode,
      currentVersion: currentVersionCode,
      isMandatory: updateAvailable && latestVersion.isMandatory,
      releaseNotes: latestVersion.releaseNotes,
      downloadUrl: `${req.protocol}://${req.get('host')}/api/v1/app/apk`,
      minCompatibleVersion: latestVersion.minCompatibleVersion
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
    const versionsData = await getVersionsData();
    const latestVersion = getLatestVersion(versionsData);

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
        releaseNotes: latestVersion.releaseNotes,
        apkFileName: latestVersion.apkFileName,
        apkFileSize: latestVersion.apkFileSize,
        downloadUrl: `${req.protocol}://${req.get('host')}/api/v1/app/apk`,
        isMandatory: latestVersion.isMandatory,
        releasedAt: latestVersion.releasedAt
      }
    });
  } catch (error) {
    console.error('Error fetching latest version:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch latest version'
    });
  }
});

// Get all versions
router.get('/versions', async (req, res) => {
  try {
    const versionsData = await getVersionsData();

    res.json({
      success: true,
      data: versionsData.versions
    });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch versions'
    });
  }
});

// Download APK by version code (optional)
router.get('/download', async (req, res) => {
  try {
    const { version } = req.query;
    const versionsData = await getVersionsData();

    let selectedVersion;

    if (version) {
      const versionCode = parseInt(version);
      selectedVersion = versionsData.versions.find(v => v.versionCode === versionCode && v.isActive);
    } else {
      selectedVersion = getLatestVersion(versionsData);
    }

    if (!selectedVersion) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    const apkPath = path.join(
      process.env.APK_STORAGE_PATH || './apks',
      selectedVersion.apkFileName
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
    res.setHeader('Content-Disposition', `attachment; filename="${selectedVersion.apkFileName}"`);

    // Get file size
    const stats = await fs.stat(apkPath);
    res.setHeader('Content-Length', stats.size);

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
    const versionsData = await getVersionsData();
    const latestVersion = getLatestVersion(versionsData);

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
        downloadUrl: `${req.protocol}://${req.get('host')}/api/v1/app/apk`,
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
    const versionsData = await getVersionsData();
    const latestVersion = getLatestVersion(versionsData);

    if (!latestVersion) {
      return res.status(404).send('No APK version available. Please add a version to versions.json file.');
    }

    const apkPath = path.join(
      process.env.APK_STORAGE_PATH || './apks',
      latestVersion.apkFileName
    );

    // Check if file exists
    try {
      await fs.access(apkPath);
    } catch (error) {
      return res.status(404).send(`APK file not found: ${latestVersion.apkFileName}. Please add the APK file to the apks/ directory.`);
    }

    // Get file size
    const stats = await fs.stat(apkPath);

    // Set headers for APK download
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', `attachment; filename="${latestVersion.apkFileName}"`);
    res.setHeader('Content-Length', stats.size);

    // Stream the file
    const fileStream = require('fs').createReadStream(apkPath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error downloading APK via /apk endpoint:', error);
    res.status(500).send('Failed to download APK. Please try again later.');
  }
});

module.exports = router;
