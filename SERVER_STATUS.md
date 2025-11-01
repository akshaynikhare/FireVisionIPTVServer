# FireVision IPTV Server - Current Status

## ✅ Server Successfully Running!

**Date**: October 30, 2024
**Server URL**: http://localhost:8009
**Status**: Operational

## Service Status

| Service | Status | Port | Notes |
|---------|--------|------|-------|
| **API Server** | ✅ Running | 3000 | Healthy |
| **MongoDB** | ✅ Running | 27017 | Connected |
| **Nginx** | ⚠️ Not Running | 80 | Port 80 already in use (not critical for local dev) |

## Database Status

- **Total Channels**: 607
- **Active Channels**: 607
- **Database**: firevision-iptv
- **Connection**: Healthy

## API Configuration

- **API Key**: `75c460eec61d697e105ed636dcd891b2fcece782a1275e005c915eac338bf69e`
- **Request Size Limit**: 50MB
- **Rate Limit**: 100 requests per 15 minutes
- **CORS**: Allow all origins (*)

## Test Results

### Health Check ✅
```bash
curl http://localhost:8009/health
```
Response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-30T05:34:38.854Z",
  "uptime": 28.083257804,
  "mongodb": "connected"
}
```

### Channels API ✅
```bash
curl http://localhost:8009/api/v1/channels
```
- Total channels: 607
- All channels active and ready
- Sample channels: Channel Divya, ABP News, etc.

### Channel Import ✅
- Successfully imported 607 channels from M3U playlist
- Source: `FireVisionIPTV/app/src/main/assets/playlist.m3u`
- Import time: ~5 seconds

## Available API Endpoints

### Public Endpoints (No Auth)
- `GET /health` - Health check
- `GET /api/v1/channels` - Get all channels
- `GET /api/v1/channels/playlist.m3u` - Download M3U
- `GET /api/v1/channels/search?q=term` - Search channels
- `GET /api/v1/app/version?currentVersion=1` - Check for updates
- `GET /api/v1/app/download` - Download latest APK

### Admin Endpoints (Require X-API-Key)
- `POST /api/v1/admin/channels` - Create channel
- `PUT /api/v1/admin/channels/:id` - Update channel
- `DELETE /api/v1/admin/channels/:id` - Delete channel
- `POST /api/v1/admin/channels/import-m3u` - Import M3U
- `POST /api/v1/admin/app/upload` - Upload APK
- `GET /api/v1/admin/stats` - Get statistics

## Quick Commands

### Start/Stop Server
```bash
cd /Users/akshay/Documents/WorkDock/_CADnative/fieretv/FireVisionIPTVServer

# Start
./scripts/manage.sh start

# Stop
./scripts/manage.sh stop

# Restart
./scripts/manage.sh restart

# View logs
./scripts/manage.sh logs

# Check status
./scripts/manage.sh status
```

### Test API
```bash
# Health check
curl http://localhost:8009/health

# Get channels
curl http://localhost:8009/api/v1/channels | jq '.count'

# Search channels
curl "http://localhost:8009/api/v1/channels/search?q=news" | jq '.'

# Get stats (with API key)
curl -H "X-API-Key: 75c460eec61d697e105ed636dcd891b2fcece782a1275e005c915eac338bf69e" \
  http://localhost:8009/api/v1/admin/stats | jq '.'
```

### Add a Channel
```bash
curl -X POST http://localhost:8009/api/v1/admin/channels \
  -H "Content-Type: application/json" \
  -H "X-API-Key: 75c460eec61d697e105ed636dcd891b2fcece782a1275e005c915eac338bf69e" \
  -d '{
    "channelId": "test_channel",
    "channelName": "Test Channel",
    "channelUrl": "https://example.com/stream.m3u8",
    "channelGroup": "Test",
    "channelImg": "https://example.com/logo.png"
  }'
```

## Next Steps

### For Local Development
1. ✅ Server is running and ready
2. ✅ 607 channels imported
3. ⏳ Android app needs to be updated to point to `http://localhost:8009`
4. ⏳ Build Android app (requires Java 11+ - see BUILD_FIX.md)
5. ⏳ Test app with local server

### For Production Deployment
1. Deploy server to Linux cloud server
2. Configure domain (tv.cadnative.com)
3. Setup SSL certificates
4. Update Android app to point to `https://tv.cadnative.com`
5. Build release APK
6. Upload APK to server
7. Distribute to users

## Known Issues

### ⚠️ Nginx Port 80 Conflict
**Issue**: Nginx container fails to start because port 80 is already in use on your Mac.

**Impact**: Low - API server is accessible on port 3000, which is sufficient for development.

**Solutions**:
1. **For local dev**: Use API directly on port 3000 (current setup)
2. **Find conflicting process**:
   ```bash
   sudo lsof -i :80
   ```
3. **Use different port**: Edit `docker-compose.yml` to use port 8080:
   ```yaml
   nginx:
     ports:
       - "8080:80"
   ```

### ⏳ Android Build Requires Java 11+
**Issue**: Your system has Java 8, but Gradle requires Java 11+.

**Status**: See [BUILD_FIX.md](../FireVisionIPTV/BUILD_FIX.md) for solutions.

**Quick Fix**:
```bash
brew install openjdk@17
```

## Monitoring

### View Real-time Logs
```bash
docker-compose logs -f api
```

### Database Access
```bash
# MongoDB shell
docker-compose exec mongodb mongosh firevision-iptv

# Count channels
db.channels.countDocuments()

# List sample channels
db.channels.find().limit(5).pretty()
```

### Health Monitoring
```bash
# Continuous health check (every 5 seconds)
watch -n 5 'curl -s http://localhost:8009/health | jq .'
```

## Backup

### Manual Backup
```bash
./scripts/manage.sh backup
```

Backups are stored in `./backups/` directory:
- `mongodb-YYYYMMDD-HHMMSS.archive` - Database backup
- `apks-YYYYMMDD-HHMMSS.tar.gz` - APK files backup

## Support

- **Documentation**: See [README.md](README.md)
- **API Docs**: See [README.md#api-documentation](README.md#api-documentation)
- **Deployment**: See [../DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- **Architecture**: See [../ARCHITECTURE.md](../ARCHITECTURE.md)

## Server Specifications

- **Node.js**: 18-alpine (Docker)
- **MongoDB**: 7.0
- **Memory Limit**: 2GB (Docker default)
- **Storage**:
  - Database: ~5MB (607 channels)
  - APKs: 0MB (no APKs uploaded yet)

---

**Server Ready for Development! 🚀**

The server is fully operational and loaded with 607 channels. You can now:
1. Test the API endpoints
2. Update the Android app to connect to the server
3. Build and test the Android app
4. Deploy to production when ready

For any issues, check the logs:
```bash
./scripts/manage.sh logs
```
