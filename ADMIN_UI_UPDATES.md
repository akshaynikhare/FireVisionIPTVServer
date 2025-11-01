# Admin UI Updates - JSON-Based APK Management

## What Changed in the Admin UI?

The APK Manager section in the admin panel has been updated to work with the new JSON-based approach instead of MongoDB.

## Updated Features

### 1. **View Mode Only** ✅

The admin UI now displays APK versions in **read-only mode**:

- ✅ **View** version details
- ✅ **Download** APK files
- ✅ **See** statistics (total versions, active versions, latest version)
- ✅ **Display** download links
- ❌ **No upload** form (use JSON file instead)
- ❌ **No edit/delete** buttons (edit versions.json directly)

### 2. **Instructions Box**

The upload form has been replaced with clear instructions on how to add new versions:

**Method 1: Helper Script (Recommended)**
```bash
node add-version.js path/to/app.apk 1.1.0 2 "Release notes"
```

**Method 2: Manual**
1. Copy APK to `apks/` directory
2. Edit `versions.json` file
3. Restart server

### 3. **Live Data from JSON**

The admin UI automatically fetches and displays:
- All versions from `versions.json`
- Real-time statistics
- Download URLs
- Version status (Active/Inactive, Mandatory/Optional)

## How to Use the Admin UI

### Access the APK Manager

1. Login to admin panel: `http://localhost:8009/admin`
2. Click "📱 APK Manager" in the sidebar

### What You Can Do

#### View All Versions
The table shows all versions from `versions.json`:
- Version name and code
- APK filename
- File size
- Active/Inactive status
- Mandatory/Optional flag
- Release date

#### View Version Details
Click "View" button to see:
- Full version information
- Release notes
- Download URL
- Instructions to modify

#### Download APK
Click "Download" button to download any version directly.

#### Copy Download Links
Use the "Copy" buttons to copy download URLs to clipboard:
- Simple endpoint: `/api/v1/app/apk`
- Full URL: `http://yourdomain.com/api/v1/app/apk`

### What You Can't Do (And Why)

❌ **Upload APKs via UI** - Use the helper script or manual method instead
❌ **Edit versions** - Edit `versions.json` file directly
❌ **Delete versions** - Remove from `versions.json` file
❌ **Toggle active status** - Edit `isActive` in `versions.json`

**Why?** The JSON-based approach is simpler, more maintainable, and version-controlled.

## Screenshots & Examples

### APK Manager View

```
┌─────────────────────────────────────────────────────┐
│ APK Version Manager                                  │
├─────────────────────────────────────────────────────┤
│ Statistics:                                          │
│ Total: 2  |  Active: 2  |  Latest: 1.1.0  |  Code: 2│
├─────────────────────────────────────────────────────┤
│ Add New APK Version                                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 📝 JSON-Based Management                        │ │
│ │                                                 │ │
│ │ Method 1: Helper Script (Recommended) ⚡        │ │
│ │ node add-version.js path/to/app.apk 1.1.0 2 ... │ │
│ │                                                 │ │
│ │ Method 2: Manual 📝                             │ │
│ │ 1. Copy APK to apks/ directory                  │ │
│ │ 2. Edit versions.json file                      │ │
│ │ 3. Restart server                               │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Existing Versions                      [🔄 Refresh] │
│                                                      │
│ Version | Code | File          | Size   | Actions   │
│ 1.1.0   | 2    | ...1.1.0.apk | 15.2MB | View Down │
│ 1.0.0   | 1    | ...1.0.0.apk | 14.8MB | View Down │
├─────────────────────────────────────────────────────┤
│ Quick Download Links                                 │
│ Latest APK: /api/v1/app/apk                [Copy]  │
└─────────────────────────────────────────────────────┘
```

## Technical Details

### Changes Made

1. **[public/admin/app.js](public/admin/app.js)**
   - Line 1524: Changed to fetch from `/api/v1/app/versions` (public endpoint)
   - Line 1572-1576: Simplified action buttons (View & Download only)
   - Line 1765-1791: Updated `viewApkDetails()` to use versionCode instead of MongoDB _id

2. **[public/admin/index.html](public/admin/index.html)**
   - Line 224-249: Replaced upload form with instructions box

### API Endpoint Used

```javascript
// Fetch versions
GET /api/v1/app/versions

// Response
{
  "success": true,
  "data": [
    {
      "versionName": "1.1.0",
      "versionCode": 2,
      "apkFileName": "firevision-iptv-1.1.0.apk",
      "apkFileSize": 15962112,
      "releaseNotes": "...",
      "isActive": true,
      "isMandatory": false,
      "releasedAt": "2025-01-20T..."
    }
  ]
}
```

## Benefits

✅ **Simpler** - No complex upload handling
✅ **Faster** - Direct file access
✅ **Safer** - No accidental uploads or deletes
✅ **Version Controlled** - Track all changes in git
✅ **Clear Process** - Follow documented workflow
✅ **No Database** - No MongoDB needed for versions

## Workflow

### Before (Old MongoDB Approach)
1. Login to admin
2. Fill upload form
3. Select APK file
4. Wait for upload
5. Stored in MongoDB + filesystem

### Now (JSON Approach)
1. Build APK locally
2. Run `node add-version.js ...`
3. Restart server
4. View in admin UI

Much simpler! 🎉

## FAQ

**Q: Can I still upload APKs via the admin UI?**
A: No, use the helper script or manual method. It's simpler and more reliable.

**Q: Why remove the upload feature?**
A: The JSON approach is easier to manage, version control, and doesn't require MongoDB.

**Q: How do I modify a version?**
A: Edit `versions.json` directly and restart the server.

**Q: Can I delete old versions?**
A: Remove them from `versions.json` or set `isActive: false`.

**Q: Will the UI update automatically?**
A: Click the "🔄 Refresh" button or reload the page to see latest changes.

**Q: Can I see version history?**
A: Yes, all versions are visible in the table. Use git history to see changes over time.

## Troubleshooting

**Admin UI shows "No versions"**
- Check `versions.json` exists and has valid JSON
- Check at least one version has `isActive: true`
- Click "🔄 Refresh" button

**Can't download APK**
- Check APK file exists in `apks/` directory
- Check filename matches in `versions.json`
- Check file permissions (644)

**Statistics not updating**
- Click "🔄 Refresh" button
- Check browser console for errors
- Restart server

## Summary

The admin UI now provides a clean, read-only view of your APK versions with:
- Real-time statistics
- Version table with details
- Download functionality
- Clear instructions for adding new versions

For managing versions, use the documented workflow with the helper script or manual JSON editing.

---

📖 Related Docs:
- [QUICK_START_APK.md](QUICK_START_APK.md) - Quick guide
- [APK_MANAGEMENT.md](APK_MANAGEMENT.md) - Detailed documentation
- [EXAMPLE_WORKFLOW.md](EXAMPLE_WORKFLOW.md) - Real-world example
- [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) - Complete changes overview
