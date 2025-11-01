# APKs Directory

This directory stores APK files for the FireVision IPTV app.

## Quick Start

### Add a new APK version:

```bash
# From the FireVisionIPTVServer directory
node add-version.js path/to/your.apk 1.0.0 1 "Initial release"
```

This will:
1. Copy the APK to this directory
2. Update versions.json
3. Make it available for download

### Manual method:

1. Copy your APK here with naming: `firevision-iptv-{version}.apk`
2. Edit `../versions.json` to add the version
3. Restart the server

## Naming Convention

Use this naming pattern:
- `firevision-iptv-1.0.0.apk`
- `firevision-iptv-1.1.0.apk`
- `firevision-iptv-2.0.0.apk`

## File Structure

```
apks/
├── .gitignore                    # APKs are ignored by default
├── README.md                     # This file
├── firevision-iptv-1.0.0.apk    # Your APK files
└── firevision-iptv-1.1.0.apk
```

## Download URL

APKs in this directory are served at:
```
http://yourdomain.com/api/v1/app/apk  (latest version)
http://yourdomain.com/apks/firevision-iptv-1.0.0.apk  (specific version)
```

## Git

By default, APK files are **NOT** committed to git (they're large).

To commit a specific APK:
```bash
git add -f apks/firevision-iptv-1.0.0.apk
```

## Storage Considerations

APK files can be large (10-50 MB). Consider:
- **Git LFS** for version control
- **Cloud Storage** (S3, Google Cloud Storage)
- **CDN** for faster downloads

## Troubleshooting

**APK not found error?**
- Check file exists: `ls -la`
- Check filename matches versions.json
- Check permissions: `chmod 644 *.apk`

**Can't download APK?**
- Restart server to reload
- Check server logs
- Verify URL is correct

---

📖 For more help, see:
- [QUICK_START_APK.md](../QUICK_START_APK.md)
- [APK_MANAGEMENT.md](../APK_MANAGEMENT.md)
- [EXAMPLE_WORKFLOW.md](../EXAMPLE_WORKFLOW.md)
