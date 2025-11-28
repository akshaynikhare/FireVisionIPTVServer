# APK Management - JSON-Based Approach

This simplified approach uses a JSON file to manage APK versions instead of MongoDB, making it easy to edit versions directly in your code.

## Structure

```
FireVisionIPTVServer/
├── versions.json          # Version history configuration
├── apks/                  # APK files storage
│   └── firevision-iptv-1.0.0.apk
└── src/
    └── routes/
        └── app-update.js  # GitHub-based APK routes
```

## How to Add a New Version

### 1. Build Your APK

Build your Android app and copy the APK to the `apks/` directory:

```bash
cd FireVisionIPTV
./gradlew assembleRelease
cp app/build/outputs/apk/release/app-release.apk ../FireVisionIPTVServer/apks/firevision-iptv-1.0.0.apk
```

### 2. Edit versions.json

Open `versions.json` and add your new version:

```json
{
  "versions": [
    {
      "versionName": "1.1.0",
      "versionCode": 2,
      "apkFileName": "firevision-iptv-1.1.0.apk",
      "apkFileSize": 15728640,
      "releaseNotes": "What's new in v1.1.0:\n- Bug fixes\n- Performance improvements\n- New features",
      "isActive": true,
      "isMandatory": false,
      "minCompatibleVersion": 1,
      "releasedAt": "2025-01-20T00:00:00.000Z"
    },
    {
      "versionName": "1.0.0",
      "versionCode": 1,
      "apkFileName": "firevision-iptv-1.0.0.apk",
      "apkFileSize": 14680064,
      "releaseNotes": "Initial release",
      "isActive": true,
      "isMandatory": false,
      "minCompatibleVersion": 1,
      "releasedAt": "2025-01-15T00:00:00.000Z"
    }
  ],
  "latestVersion": {
    "versionName": "1.1.0",
    "versionCode": 2
  }
}
```

### 3. Version Fields Explained

- **versionName**: Human-readable version (e.g., "1.0.0")
- **versionCode**: Integer version number (must be unique and increment)
- **apkFileName**: Name of the APK file in the `apks/` directory
- **apkFileSize**: File size in bytes (optional, will be calculated automatically)
- **releaseNotes**: What's new in this version
- **isActive**: `true` to make this version available for download
- **isMandatory**: `true` to force users to update
- **minCompatibleVersion**: Minimum version code that can update to this version
- **releasedAt**: ISO date string

### 4. Restart Server

The server will automatically read the updated JSON file:

```bash
npm start
```

Or with Docker:

```bash
docker-compose restart api
```

## Available Endpoints

### Download Latest APK
```
GET /api/v1/app/apk
```
Simple endpoint that always returns the latest active APK.

**Example:**
```
https://yourdomain.com/api/v1/app/apk
```

### Check for Updates
```
GET /api/v1/app/version?currentVersion=1
```

**Response:**
```json
{
  "success": true,
  "updateAvailable": true,
  "latestVersion": "1.1.0",
  "latestVersionCode": 2,
  "currentVersion": 1,
  "isMandatory": false,
  "releaseNotes": "What's new...",
  "downloadUrl": "https://yourdomain.com/api/v1/app/apk"
}
```

### Get Latest Version Info
```
GET /api/v1/app/latest
```

**Response:**
```json
{
  "success": true,
  "data": {
    "versionName": "1.1.0",
    "versionCode": 2,
    "releaseNotes": "What's new...",
    "downloadUrl": "https://yourdomain.com/api/v1/app/apk",
    "isMandatory": false
  }
}
```

### Get All Versions
```
GET /api/v1/app/versions
```

### Download Specific Version
```
GET /api/v1/app/download?version=1
```

## Quick Tips

### Make a Version Mandatory
Set `isMandatory: true` to force users to update:

```json
{
  "versionName": "2.0.0",
  "versionCode": 3,
  "isMandatory": true,
  ...
}
```

### Deactivate Old Versions
Set `isActive: false` to prevent downloads:

```json
{
  "versionName": "1.0.0",
  "versionCode": 1,
  "isActive": false,
  ...
}
```

### Multiple Active Versions
You can have multiple active versions. The highest version code will be served as "latest".

## File Size Calculation

To get the file size in bytes:

```bash
# On macOS/Linux
ls -l apks/firevision-iptv-1.0.0.apk | awk '{print $5}'

# Or use stat
stat -f%z apks/firevision-iptv-1.0.0.apk
```

## Example Workflow

1. **Develop new feature** in Android app
2. **Update version** in `app/build.gradle`:
   ```gradle
   versionCode 2
   versionName "1.1.0"
   ```
3. **Build APK**: `./gradlew assembleRelease`
4. **Copy APK** to `FireVisionIPTVServer/apks/firevision-iptv-1.1.0.apk`
5. **Edit** `versions.json` and add the new version
6. **Commit** to git:
   ```bash
   git add versions.json apks/firevision-iptv-1.1.0.apk
   git commit -m "Release v1.1.0"
   git push
   ```
7. **Deploy** server (Docker, PM2, etc.)

## Share Download Link

Give users this simple URL to always get the latest version:

```
https://yourdomain.com/api/v1/app/apk
```

Or even simpler if you add a redirect at root level:

```
https://yourdomain.com/apk
```

## Troubleshooting

### APK Not Found Error
- Check the `apkFileName` matches the actual file in `apks/` directory
- Ensure file permissions are readable
- Verify the file was copied correctly

### Old Version Downloading
- Check `isActive: true` on the new version
- Verify `versionCode` is higher than previous versions
- Restart the server to reload JSON

### Large APK Files in Git
If your APK files are too large for git, consider:
- Using Git LFS
- Storing APKs in cloud storage (S3, CloudFront)
- Using a separate build server

## Production Deployment

For production, you might want to:

1. **Use environment variables** for the APK storage path
2. **Add versioning** to `versions.json` in git
3. **Automate** APK builds with CI/CD
4. **Use CDN** for APK distribution
5. **Monitor** download metrics

## Migration from MongoDB

If you were using the MongoDB approach, you can export your versions:

1. Export from MongoDB to JSON
2. Update `versions.json` format
3. Copy APK files to `apks/` directory
4. Switch route in `server.js` to use `app-update.js`
