# Docker Volume Fix - APK Files

## Problem

When accessing `http://localhost:8009/api/v1/app/apk`, you got:
```
APK file not found: firevision-iptv-1.0.0.apk.
Please add the APK file to the apks/ directory.
```

Even though the file existed in your local `apks/` directory.

## Root Cause

The Docker configuration was using **named volumes** (`apk_storage`) which created a separate storage location inside Docker, isolated from your local `apks/` directory.

When you added APK files to your local `apks/` folder, they weren't visible inside the Docker container.

## Solution Applied

Changed from **named volumes** to **bind mounts** in `docker-compose.yml`:

### Before:
```yaml
volumes:
  - apk_storage:/app/apks      # Named volume (isolated)
  - uploads:/app/uploads
```

### After:
```yaml
volumes:
  - ./apks:/app/apks           # Bind mount (local folder)
  - ./uploads:/app/uploads
  - ./versions.json:/app/versions.json:ro
```

This makes your local directories directly accessible inside Docker.

## Changes Made

**File: [docker-compose.yml](docker-compose.yml)**

1. **Line 40-42**: Changed API service volumes to bind mounts
2. **Line 66**: Changed nginx APK volume to bind mount
3. **Line 77-81**: Removed unused `apk_storage` and `uploads` named volumes

## How It Works Now

```
┌─────────────────────────────────────┐
│  Your Computer                       │
│  FireVisionIPTVServer/              │
│  ├── apks/                          │
│  │   └── firevision-iptv-1.0.0.apk│ ◄──┐
│  ├── versions.json                  │    │ Bind Mount
│  └── uploads/                       │    │ (Shared)
└─────────────────────────────────────┘    │
                                            │
┌─────────────────────────────────────┐    │
│  Docker Container                    │    │
│  /app/                              │    │
│  ├── apks/                          │ ───┘
│  │   └── firevision-iptv-1.0.0.apk│
│  ├── versions.json                  │
│  └── uploads/                       │
└─────────────────────────────────────┘
```

Now when you add an APK file to your local `apks/` folder, it's immediately available inside Docker!

## Testing

After the fix, the endpoint works correctly:

```bash
# Test APK download
curl -I http://localhost:8009/api/v1/app/apk

# Output:
HTTP/1.1 200 OK
Content-Type: application/vnd.android.package-archive
Content-Disposition: attachment; filename="firevision-iptv-1.0.0.apk"
Content-Length: 55275706
```

```bash
# Test latest version
curl http://localhost:8009/api/v1/app/latest

# Output:
{
  "success": true,
  "data": {
    "versionName": "1.0.0",
    "versionCode": 1,
    "apkFileName": "firevision-iptv-1.0.0.apk",
    "downloadUrl": "http://localhost:8009/api/v1/app/apk"
  }
}
```

## Workflow Now

### Adding New APK Version (Docker):

1. **Add the version** (creates APK in local folder):
   ```bash
   node add-version.js path/to/app.apk 1.1.0 2 "Release notes"
   ```

2. **Restart Docker** (to reload versions.json):
   ```bash
   docker-compose restart api
   ```

3. **Test**:
   ```bash
   curl -I http://localhost:8009/api/v1/app/apk
   ```

That's it! No need to rebuild the Docker image or copy files into containers.

## Benefits

✅ **Immediate Updates** - APKs are instantly available
✅ **Easy Management** - Add/remove files locally
✅ **No Rebuilds** - No need to rebuild Docker images
✅ **Version Control** - Track versions.json in git
✅ **Development Friendly** - Perfect for local development

## Production Considerations

For production, you might want to:

1. **Use named volumes** for persistence across deployments
2. **Copy APKs into image** during build process
3. **Use external storage** (S3, CDN) for large files
4. **Separate server** for static file serving

But for development, bind mounts are perfect! 🎉

## Restart After Making Changes

Whenever you:
- Add new APK files
- Update versions.json
- Change docker-compose.yml

Run:
```bash
docker-compose restart api
# or
docker-compose down && docker-compose up -d
```

## Verification

Check if volumes are mounted correctly:

```bash
# List volumes in use
docker-compose ps

# Inspect the API container
docker exec firevision-api ls -la /app/apks

# Should show your APK file:
# -rw-r--r-- 1 nodejs nodejs 55275706 Oct 31 12:19 firevision-iptv-1.0.0.apk
```

## Troubleshooting

**APK still not found after restart?**
- Check file exists: `ls -la apks/`
- Check versions.json: `cat versions.json`
- Check inside container: `docker exec firevision-api ls -la /app/apks`
- Check logs: `docker-compose logs api`

**Permission errors?**
```bash
chmod 644 apks/*.apk
chmod 755 apks
```

**Volumes not updating?**
- Use `docker-compose down -v` to remove all volumes
- Then `docker-compose up -d` to recreate

---

✅ **Issue Resolved!** Your APK files are now accessible via Docker.
