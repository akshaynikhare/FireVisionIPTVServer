# Quick Start - APK Management

## Super Simple: Using the Helper Script

### 1. Build Your APK
```bash
cd FireVisionIPTV
./gradlew assembleDebug
# or for release:
./gradlew assembleRelease
```

### 2. Add the Version
```bash
cd ../FireVisionIPTVServer

# Use the helper script (it copies APK + updates JSON automatically)
node add-version.js \
  ../FireVisionIPTV/app/build/outputs/apk/debug/app-debug.apk \
  1.0.0 \
  1 \
  "Initial release with live TV streaming"
```

### 3. Start Server
```bash
npm start
```

### 4. Test Download
```bash
# Direct download URL (always returns latest APK)
curl -I http://localhost:8009/api/v1/app/apk

# Check version info
curl http://localhost:8009/api/v1/app/latest
```

Done! 🎉

---

## Manual Method (If You Prefer)

### 1. Copy APK to apks/ directory
```bash
cp ../FireVisionIPTV/app/build/outputs/apk/debug/app-debug.apk \
   apks/firevision-iptv-1.0.0.apk
```

### 2. Edit versions.json
```json
{
  "versions": [
    {
      "versionName": "1.0.0",
      "versionCode": 1,
      "apkFileName": "firevision-iptv-1.0.0.apk",
      "apkFileSize": 15728640,
      "releaseNotes": "Initial release",
      "isActive": true,
      "isMandatory": false,
      "minCompatibleVersion": 1,
      "releasedAt": "2025-01-15T00:00:00.000Z"
    }
  ],
  "latestVersion": {
    "versionName": "1.0.0",
    "versionCode": 1
  }
}
```

### 3. Restart Server
```bash
npm start
```

---

## Share Download Link

Your users can download the latest APK at:

```
http://yourdomain.com/api/v1/app/apk
```

This URL **always** serves the latest active version!

---

## Common Tasks

### Add a New Version
```bash
node add-version.js path/to/app.apk 1.1.0 2 "Bug fixes"
```

### Make Update Mandatory
Edit `versions.json`:
```json
{
  "versionName": "2.0.0",
  "versionCode": 3,
  "isMandatory": true,
  ...
}
```

### Deactivate Old Version
Edit `versions.json`:
```json
{
  "versionName": "1.0.0",
  "versionCode": 1,
  "isActive": false,
  ...
}
```

### List All Versions
```bash
curl http://localhost:8009/api/v1/app/versions
```

### Check for Updates (from Android app)
```bash
curl "http://localhost:8009/api/v1/app/version?currentVersion=1"
```

---

## Files Structure

```
FireVisionIPTVServer/
├── versions.json              # 👈 Edit this to manage versions
├── apks/                      # 👈 Put APK files here
│   ├── .gitignore
│   └── firevision-iptv-*.apk
├── add-version.js             # 👈 Helper script
├── QUICK_START_APK.md         # 👈 You are here
└── APK_MANAGEMENT.md          # 👈 Detailed docs
```

---

## Troubleshooting

**"APK file not found"**
- Check filename in `versions.json` matches file in `apks/`
- Check file permissions

**"No version available"**
- Check `versions.json` has at least one version
- Check `isActive: true`

**Old version downloading**
- Check `versionCode` is highest number
- Restart server

---

## Pro Tips

1. **Always increment versionCode** (must be higher than previous)
2. **Use semantic versioning** for versionName (1.0.0, 1.1.0, 2.0.0)
3. **Test locally** before deploying
4. **Keep release notes** clear and concise
5. **Backup** versions.json before editing

---

Need more details? See [APK_MANAGEMENT.md](APK_MANAGEMENT.md)
