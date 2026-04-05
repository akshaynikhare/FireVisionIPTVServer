const express = require('express');
const router = express.Router();
const axios = require('axios');

// GitHub APK update routes

const GITHUB_OWNER = process.env.GH_APP_OWNER || 'akshaynikhare';
const GITHUB_REPO = process.env.GH_APP_REPO || 'FireVisionIPTV';
const GITHUB_APK_PATTERN = process.env.GH_APP_APK_PATTERN || '.apk';
const GITHUB_TOKEN = process.env.GH_APP_TOKEN;

// APP_VERSION is injected at build time via Docker build arg (e.g. "1.2.3")
const APP_VERSION = process.env.APP_VERSION || '0.0.0';

async function fetchLatestRelease() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'FireVisionIPTVServer',
  };

  if (GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  }

  const response = await axios.get(url, { headers });
  return response.data;
}

function pickApkAsset(release) {
  if (!release || !Array.isArray(release.assets)) return null;
  return release.assets.find((a) => a.name && a.name.includes(GITHUB_APK_PATTERN)) || null;
}

router.get('/version', async (req, res) => {
  try {
    const { currentVersion } = req.query;

    if (!currentVersion) {
      return res.status(400).json({
        success: false,
        error: 'Current version is required',
      });
    }

    const currentVersionCode = parseInt(currentVersion, 10);

    if (isNaN(currentVersionCode)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid version code',
      });
    }

    const release = await fetchLatestRelease();
    const apkAsset = pickApkAsset(release);

    if (!apkAsset) {
      return res.json({
        success: true,
        updateAvailable: false,
        message: 'No APK asset found in latest GitHub release',
      });
    }

    const latestVersionName = release.tag_name || release.name || APP_VERSION;
    const updateAvailable = latestVersionName !== String(currentVersionCode);

    return res.json({
      success: true,
      updateAvailable,
      latestVersion: latestVersionName,
      currentVersion: currentVersionCode,
      isMandatory: false,
      releaseNotes: release.body || '',
      downloadUrl: apkAsset.browser_download_url,
      minCompatibleVersion: 1,
    });
  } catch (error) {
    console.error('Error checking version via GitHub:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check version from GitHub',
    });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const release = await fetchLatestRelease();
    const apkAsset = pickApkAsset(release);

    if (!apkAsset) {
      return res.status(404).json({
        success: false,
        error: 'No APK asset available in latest GitHub release',
      });
    }

    const latestVersionName = release.tag_name || release.name || APP_VERSION;

    return res.json({
      success: true,
      data: {
        versionName: latestVersionName,
        releaseNotes: release.body || '',
        apkFileName: apkAsset.name,
        apkFileSize: apkAsset.size,
        downloadUrl: apkAsset.browser_download_url,
        isMandatory: false,
        releasedAt: release.published_at,
      },
    });
  } catch (error) {
    console.error('Error fetching latest version from GitHub:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch latest version from GitHub',
    });
  }
});

router.get('/versions', async (req, res) => {
  try {
    return res.json({
      success: true,
      data: [],
      source: 'github',
      message: 'Version history is managed via GitHub Releases',
    });
  } catch (error) {
    console.error('Error fetching versions from GitHub:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch versions from GitHub',
    });
  }
});

router.get('/download', async (req, res) => {
  try {
    const release = await fetchLatestRelease();
    const apkAsset = pickApkAsset(release);

    if (!apkAsset) {
      return res.status(404).json({
        success: false,
        error: 'No APK asset available in latest GitHub release',
      });
    }

    return res.redirect(apkAsset.browser_download_url);
  } catch (error) {
    console.error('Error redirecting to APK on GitHub:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to redirect to APK on GitHub',
    });
  }
});

router.get('/download-url', async (req, res) => {
  try {
    const release = await fetchLatestRelease();
    const apkAsset = pickApkAsset(release);

    if (!apkAsset) {
      return res.status(404).json({
        success: false,
        error: 'No APK asset available in latest GitHub release',
      });
    }

    const latestVersionName = release.tag_name || release.name || APP_VERSION;

    return res.json({
      success: true,
      data: {
        versionName: latestVersionName,
        downloadUrl: apkAsset.browser_download_url,
        fileSize: apkAsset.size,
        releaseNotes: release.body || '',
        isMandatory: false,
      },
    });
  } catch (error) {
    console.error('Error getting download URL from GitHub:', error.message || error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get download URL from GitHub',
    });
  }
});

router.get('/apk', async (req, res) => {
  try {
    const release = await fetchLatestRelease();
    const apkAsset = pickApkAsset(release);

    if (!apkAsset) {
      return res.status(404).send('No APK asset available in latest GitHub release.');
    }

    return res.redirect(apkAsset.browser_download_url);
  } catch (error) {
    console.error('Error redirecting to APK on GitHub via /apk endpoint:', error.message || error);
    return res.status(500).send('Failed to redirect to APK on GitHub. Please try again later.');
  }
});

router.get('/demo-code', (req, res) => {
  const code = process.env.SUPER_ADMIN_CHANNEL_LIST_CODE;
  if (!code) {
    return res.status(404).json({ success: false, error: 'Demo code not configured' });
  }
  return res.json({ code });
});

module.exports = router;
