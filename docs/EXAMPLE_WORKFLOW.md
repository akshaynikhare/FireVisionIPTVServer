# Example Workflow - Release New Version

This is a real-world example of how to release a new version of your FireVision IPTV app.

## Scenario

You've fixed bugs and want to release version 1.1.0 (version code 2).

## Step-by-Step

### Step 1: Update Android App Version

Edit `FireVisionIPTV/app/build.gradle`:

```gradle
android {
    defaultConfig {
        applicationId "com.cadnative.firevisioniptv"
        minSdk 28
        targetSdk 34
        versionCode 2         // 👈 Change from 1 to 2
        versionName "1.1.0"   // 👈 Change from "1.0.0" to "1.1.0"
    }
}
```

### Step 2: Build the APK

```bash
cd FireVisionIPTV

# For debug build
./gradlew assembleDebug

# For release build (recommended for production)
./gradlew assembleRelease
```

The APK will be at:
- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

### Step 3: Add Version to Server

```bash
cd ../FireVisionIPTVServer

# Use the helper script (automatic)
node add-version.js \
  ../FireVisionIPTV/app/build/outputs/apk/debug/app-debug.apk \
  1.1.0 \
  2 \
  "Bug fixes and performance improvements"
```

You'll see:
```
📱 Adding APK version 1.1.0 (code: 2)
   File: ../FireVisionIPTV/app/build/outputs/apk/debug/app-debug.apk
   Size: 15.23 MB

📦 Copying APK to apks/firevision-iptv-1.1.0.apk...
✅ APK copied successfully

💾 Updating versions.json...
✅ versions.json updated successfully

✨ Version 1.1.0 added successfully!
```

### Step 4: Review changes

Check `versions.json`:

```bash
cat versions.json
```

You should see:
```json
{
  "versions": [
    {
      "versionName": "1.1.0",
      "versionCode": 2,
      "apkFileName": "firevision-iptv-1.1.0.apk",
      "apkFileSize": 15962112,
      "releaseNotes": "Bug fixes and performance improvements",
      "isActive": true,
      "isMandatory": false,
      "minCompatibleVersion": 1,
      "releasedAt": "2025-01-20T10:30:00.000Z"
    },
    {
      "versionName": "1.0.0",
      "versionCode": 1,
      ...
    }
  ],
  "latestVersion": {
    "versionName": "1.1.0",
    "versionCode": 2
  }
}
```

### Step 5: Test Locally

Start the server:

```bash
npm start
# or if using Docker:
docker-compose restart api
```

Test the endpoints:

```bash
# Get latest version
curl http://localhost:8009/api/v1/app/latest

# Check for updates (simulating app with version 1)
curl "http://localhost:8009/api/v1/app/version?currentVersion=1"

# Try downloading
curl -I http://localhost:8009/api/v1/app/apk
```

### Step 6: Commit Changes

```bash
git add versions.json apks/
git commit -m "Release v1.1.0: Bug fixes and improvements"
git push origin main
```

### Step 7: Deploy to Production

```bash
# SSH to your server
ssh user@tv.cadnative.com

# Pull latest changes
cd /path/to/FireVisionIPTVServer
git pull

# Restart server
docker-compose restart api

# Or if using PM2
pm2 restart firevision-server
```

### Step 8: Verify Production

```bash
# Check from outside
curl https://tv.cadnative.com/api/v1/app/latest

# Should return:
{
  "success": true,
  "data": {
    "versionName": "1.1.0",
    "versionCode": 2,
    "releaseNotes": "Bug fixes and performance improvements",
    "downloadUrl": "https://tv.cadnative.com/api/v1/app/apk",
    ...
  }
}
```

### Step 9: Share with Users

Send users the download link:

```
📱 New version available!

Download: https://tv.cadnative.com/api/v1/app/apk

What's new in v1.1.0:
- Bug fixes and performance improvements
```

### Step 10: Monitor

Watch your server logs:

```bash
# Docker
docker-compose logs -f api

# PM2
pm2 logs firevision-server
```

You should see download requests:
```
GET /api/v1/app/apk 200 - - 15.234 MB - 2.3 ms
```

## Advanced: Making Update Mandatory

If this is a critical security update, make it mandatory:

Edit `versions.json`:

```json
{
  "versionName": "1.1.0",
  "versionCode": 2,
  "isMandatory": true,  // 👈 Force users to update
  ...
}
```

Restart server and push changes.

Now when users with version 1 check for updates:

```bash
curl "http://localhost:8009/api/v1/app/version?currentVersion=1"
```

Response:
```json
{
  "success": true,
  "updateAvailable": true,
  "isMandatory": true,  // 👈 App should force update
  "latestVersion": "1.1.0",
  ...
}
```

## Advanced: Deactivating Old Versions

After everyone updates, deactivate version 1.0.0:

Edit `versions.json`:

```json
{
  "versionName": "1.0.0",
  "versionCode": 1,
  "isActive": false,  // 👈 No longer available for download
  ...
}
```

## Manual Method (Without Helper Script)

If you prefer to do it manually:

1. **Copy APK:**
   ```bash
   cp ../FireVisionIPTV/app/build/outputs/apk/debug/app-debug.apk \
      apks/firevision-iptv-1.1.0.apk
   ```

2. **Get file size:**
   ```bash
   ls -l apks/firevision-iptv-1.1.0.apk | awk '{print $5}'
   # Output: 15962112
   ```

3. **Edit versions.json** (add new version at top of array)

4. **Restart server**

## Rollback

Made a mistake? Easy rollback:

1. **Edit versions.json** - set old version's `isActive: true`
2. **Set new version's** `isActive: false`
3. **Restart server**

Example:
```json
{
  "versions": [
    {
      "versionName": "1.1.0",
      "versionCode": 2,
      "isActive": false,  // 👈 Deactivate problematic version
      ...
    },
    {
      "versionName": "1.0.0",
      "versionCode": 1,
      "isActive": true,   // 👈 Roll back to this
      ...
    }
  ],
  "latestVersion": {
    "versionName": "1.0.0",  // 👈 Update latest
    "versionCode": 1
  }
}
```

## Checklist

Before releasing:

- [ ] Updated `versionCode` in build.gradle
- [ ] Updated `versionName` in build.gradle
- [ ] Built APK (debug or release)
- [ ] Added version to server (with helper script or manually)
- [ ] Tested locally
- [ ] Committed to git
- [ ] Deployed to production
- [ ] Verified download URL works
- [ ] Tested update check from old version
- [ ] Shared download link with users

## Tips

1. **Always increment versionCode** - It must be higher than all previous versions
2. **Use semantic versioning** - 1.0.0 → 1.1.0 → 2.0.0
3. **Test before deploying** - Try downloading locally first
4. **Keep old versions** - Users might need to rollback
5. **Clear release notes** - Tell users what changed
6. **Backup versions.json** - Before making changes

## Common Issues

**"Version code 2 already exists"**
- You already added this version, check versions.json

**"APK file not found"**
- Check the APK was copied to apks/ directory
- Verify filename matches in versions.json

**Old version still downloading**
- Restart server to reload JSON
- Check new version has `isActive: true`
- Verify versionCode is higher

**Large APK won't commit to git**
- Add to .gitignore: `apks/*.apk`
- Store APKs elsewhere (S3, CDN)
- Use Git LFS

---

That's it! You've successfully released a new version. 🎉
