# Changes Summary - Simplified APK Management

## What Changed?

We've simplified APK version management by replacing MongoDB-based storage with a simple JSON file approach. This makes it easy to manage versions directly in your code!

## New Files Created

### 1. Core Files
- **`versions.json`** - Version history configuration (edit this to manage versions)
- **`apks/`** - Directory to store APK files
- **`src/routes/app-simple.js`** - New routes that read from JSON instead of MongoDB

### 2. Helper Files
- **`add-version.js`** - Script to automatically add new versions
- **`QUICK_START_APK.md`** - Quick reference guide
- **`APK_MANAGEMENT.md`** - Detailed documentation
- **`CHANGES_SUMMARY.md`** - This file

### 3. Modified Files
- **`src/server.js`** - Changed line 58 to use `app-simple.js` instead of `app.js`
- **`README.md`** - Added APK setup instructions

## Key Endpoints

All these endpoints now work with the JSON file:

1. **`GET /api/v1/app/apk`** - Download latest APK (simple URL)
2. **`GET /api/v1/app/version?currentVersion=1`** - Check for updates
3. **`GET /api/v1/app/latest`** - Get latest version info
4. **`GET /api/v1/app/versions`** - List all versions
5. **`GET /api/v1/app/download?version=1`** - Download specific version

## How It Works

```
┌─────────────────────────────────────────┐
│  versions.json                           │
│  {                                       │
│    "versions": [                         │
│      {                                   │
│        "versionName": "1.0.0",          │
│        "versionCode": 1,                │
│        "apkFileName": "...",            │
│        "releaseNotes": "...",           │
│        "isActive": true                 │
│      }                                   │
│    ]                                     │
│  }                                       │
└─────────────────────────────────────────┘
           │
           │ Read by
           ▼
┌─────────────────────────────────────────┐
│  app-simple.js                           │
│  - Reads versions.json                   │
│  - Serves APK files from apks/           │
│  - No MongoDB needed                     │
└─────────────────────────────────────────┘
           │
           │ Serves
           ▼
┌─────────────────────────────────────────┐
│  Android App / Users                     │
│  Downloads APK via /api/v1/app/apk      │
└─────────────────────────────────────────┘
```

## Advantages

✅ **Simple** - Just edit a JSON file
✅ **No Database** - No MongoDB needed for APK management
✅ **Version Control** - Track versions.json in git
✅ **Easy Updates** - Copy APK + update JSON + restart
✅ **Portable** - Works anywhere Node.js runs
✅ **Helper Script** - Automate with `add-version.js`

## Quick Usage

### Add a New Version (Easy Way)
```bash
node add-version.js path/to/app.apk 1.1.0 2 "Bug fixes"
```

### Add a New Version (Manual Way)
1. Copy APK to `apks/firevision-iptv-1.1.0.apk`
2. Edit `versions.json` and add the version
3. Restart server: `npm start` or `docker-compose restart api`

### Share Download Link
```
https://yourdomain.com/api/v1/app/apk
```
This URL always serves the latest active version!

## Migration Notes

### From Old MongoDB Approach
If you were using the old MongoDB approach:
1. The new `app-simple.js` replaces `app.js`
2. No database setup needed for APK management
3. Channel management still uses MongoDB (unchanged)
4. Admin UI APK upload removed (use JSON method instead)

### What Still Uses MongoDB?
- Channel management (CRUD operations)
- Channel metadata
- User authentication
- Everything except APK version management

## File Structure

```
FireVisionIPTVServer/
├── versions.json              # 👈 Edit this for versions
├── apks/                      # 👈 Put APK files here
│   ├── .gitignore
│   └── *.apk
├── add-version.js             # 👈 Helper script
├── src/
│   └── routes/
│       ├── app.js             # Old (MongoDB-based)
│       └── app-simple.js      # 👈 New (JSON-based)
├── QUICK_START_APK.md         # 👈 Quick guide
└── APK_MANAGEMENT.md          # 👈 Detailed docs
```

## Testing

Test your setup:

```bash
# 1. Check if server is running
curl http://localhost:8009/health

# 2. Get latest version info
curl http://localhost:8009/api/v1/app/latest

# 3. Test download endpoint
curl -I http://localhost:8009/api/v1/app/apk

# 4. Check for updates (as if you were version 1)
curl "http://localhost:8009/api/v1/app/version?currentVersion=1"
```

## Example versions.json

```json
{
  "versions": [
    {
      "versionName": "1.1.0",
      "versionCode": 2,
      "apkFileName": "firevision-iptv-1.1.0.apk",
      "apkFileSize": 16777216,
      "releaseNotes": "Bug fixes and improvements",
      "isActive": true,
      "isMandatory": false,
      "minCompatibleVersion": 1,
      "releasedAt": "2025-01-20T00:00:00.000Z"
    },
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
    "versionName": "1.1.0",
    "versionCode": 2
  }
}
```

## Troubleshooting

**Server won't start**
- Check if `versions.json` is valid JSON
- Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('versions.json')))"`

**APK not downloading**
- Check `apkFileName` in versions.json matches actual file
- Check file exists: `ls -la apks/`
- Check file permissions: `chmod 644 apks/*.apk`

**Old version downloading**
- Ensure new version has higher `versionCode`
- Ensure `isActive: true`
- Restart server to reload JSON

## Next Steps

1. ✅ Server is updated to use JSON-based approach
2. ✅ Helper script created for easy version management
3. ✅ Documentation created

Now you can:
1. Build your Android APK
2. Run `node add-version.js ...` to add it
3. Share the download URL with users
4. Update versions anytime by editing JSON

## Support

- Quick Guide: [QUICK_START_APK.md](QUICK_START_APK.md)
- Detailed Docs: [APK_MANAGEMENT.md](APK_MANAGEMENT.md)
- Main README: [README.md](README.md)

---

**Note**: The old admin UI APK upload section is still there but won't work with this JSON approach. You can remove it or keep it for reference. The JSON method is simpler and more maintainable!
