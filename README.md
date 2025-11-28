# FireVision IPTV Server

A Node.js server for managing IPTV channel lists and Android app updates for FireVision IPTV application.

## Features

- **Channel Management**: Full CRUD API for managing IPTV channels
- **M3U Playlist**: Import/export M3U playlists
- **App Updates**: Automatic app version checking and APK distribution
- **RESTful API**: Clean REST API with JSON responses
- **Docker Support**: Fully containerized with Docker and docker-compose
- **MongoDB**: Persistent storage for channels and app versions
- **Nginx Reverse Proxy**: Production-ready with SSL/TLS support

## Architecture

```
┌─────────────────┐
│  Android App    │
│  (Fire TV)      │
└────────┬────────┘
         │ HTTPS
         ▼
┌─────────────────┐
│     Nginx       │ (Reverse Proxy, SSL)
│   Port 80/443   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Node.js API   │ (Express Server)
│   Port 3000     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    MongoDB      │ (Database)
│   Port 27017    │
└─────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Domain name (tv.cadnative.com)
- SSL certificates (optional, recommended for production)

## Quick Start

### 1. Clone and Setup

```bash
cd FireVisionIPTVServer
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` file:

```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/firevision-iptv
API_KEY=your-secure-api-key-here-change-this
ALLOWED_ORIGINS=*
```

**Important**: Change the `API_KEY` to a secure random string!

### 3. Add Your APK (Optional but Recommended)

For APK distribution, use the simplified JSON-based approach:

```bash
# Quick method: Use the helper script
node add-version.js ../FireVisionIPTV/app/build/outputs/apk/debug/app-debug.apk 1.0.0 1 "Initial release"

# Or manually: Copy APK and edit versions.json
cp your-app.apk apks/firevision-iptv-1.0.0.apk
# Then edit versions.json (see QUICK_START_APK.md)
```

📖 **See [QUICK_START_APK.md](QUICK_START_APK.md) for detailed APK management guide**

### 4. Start the Server

```bash
docker-compose up -d
```

This will start:
- MongoDB database
- Node.js API server
- Nginx reverse proxy

### 5. Verify Installation

```bash
# Check server health
curl http://localhost/health

# Check APK endpoint
curl -I http://localhost/api/v1/app/apk
```

You should see:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 10.5,
  "mongodb": "connected"
}
```

## API Documentation

### Base URL

```
https://tv.cadnative.com/api/v1
```

### Public Endpoints (No Authentication Required)

#### Get All Channels

```http
GET /api/v1/channels
```

**Response:**
```json
{
  "success": true,
  "count": 200,
  "data": [
    {
      "channelId": "channel_001",
      "channelName": "Example TV",
      "channelUrl": "https://example.com/stream.m3u8",
      "channelImg": "https://example.com/logo.png",
      "channelGroup": "News",
      "channelDrmKey": "",
      "channelDrmType": "",
      "isActive": true
    }
  ]
}
```

#### Get M3U Playlist

```http
GET /api/v1/channels/playlist.m3u

u
```

Returns a standard M3U playlist file.

#### Search Channels

```http
GET /api/v1/channels/search?q=news
```

#### Check for App Updates

```http
GET /api/v1/app/version?currentVersion=1
```

**Response:**
```json
{
  "success": true,
  "updateAvailable": true,
  "isMandatory": false,
  "latestVersion": {
    "versionName": "1.4",
    "versionCode": 2,
    "downloadUrl": "https://tv.cadnative.com/apks/firevision-iptv-123456.apk",
    "apkFileSize": 15728640,
    "releaseNotes": "Bug fixes and performance improvements"
  }
}
```

#### Download Latest APK

```http
GET /api/v1/app/download
```

Downloads the latest APK file.

### Admin Endpoints (Require API Key)

All admin endpoints require the `x-api-key` header:

```http
X-API-Key: your-secure-api-key-here
```

#### Create Channel

```http
POST /api/v1/admin/channels
Content-Type: application/json
X-API-Key: your-api-key

{
  "channelId": "cnn",
  "channelName": "CNN News",
  "channelUrl": "https://example.com/cnn.m3u8",
  "channelImg": "https://example.com/cnn.png",
  "channelGroup": "News",
  "isActive": true
}
```

#### Update Channel

```http
PUT /api/v1/admin/channels/{id}
Content-Type: application/json
X-API-Key: your-api-key

{
  "channelName": "CNN International",
  "channelUrl": "https://example.com/cnn-intl.m3u8"
}
```

#### Delete Channel

```http
DELETE /api/v1/admin/channels/{id}
X-API-Key: your-api-key
```

#### Import M3U Playlist

```http
POST /api/v1/admin/channels/import-m3u
Content-Type: application/json
X-API-Key: your-api-key

{
  "m3uContent": "#EXTM3U\n#EXTINF:-1 tvg-id=\"cnn\" tvg-name=\"CNN\" ...",
  "clearExisting": false
}
```

#### Upload New APK Version

```http
POST /api/v1/admin/app/upload
Content-Type: multipart/form-data
X-API-Key: your-api-key

Form Data:
- apk: [APK file]
- versionName: "1.4"
- versionCode: 2
- releaseNotes: "Bug fixes and improvements"
- isMandatory: false
- minCompatibleVersion: 1
```

#### Get Statistics

```http
GET /api/v1/admin/stats
X-API-Key: your-api-key
```

## Deployment to Production

### 1. Server Setup (Linux Cloud)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone or upload your server files
cd /opt
git clone <your-repo> firevision-iptv-server
cd firevision-iptv-server/FireVisionIPTVServer
```

### 2. Configure Domain (tv.cadnative.com)

Point your domain to your server's IP address:

```
Type: A Record
Host: tv
Value: YOUR_SERVER_IP
TTL: 3600
```

### 3. Setup SSL Certificates (Recommended)

Using Let's Encrypt with Certbot:

```bash
# Install certbot
sudo apt install certbot

# Get certificates
sudo certbot certonly --standalone -d tv.cadnative.com

# Copy certificates to nginx directory
sudo cp /etc/letsencrypt/live/tv.cadnative.com/fullchain.pem ./nginx/ssl/
sudo cp /etc/letsencrypt/live/tv.cadnative.com/privkey.pem ./nginx/ssl/
```

### 4. Update nginx.conf

Uncomment the SSL section in `nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    server_name tv.cadnative.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    # ... rest of config
}
```

### 5. Start Services

```bash
# Create .env file
cp .env.example .env
nano .env  # Edit configuration

# Start services
docker-compose up -d

# View logs
docker-compose logs -f
```

### 6. Setup Auto-restart on System Boot

```bash
# Create systemd service
sudo nano /etc/systemd/system/firevision-iptv.service
```

Add:
```ini
[Unit]
Description=FireVision IPTV Server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/firevision-iptv-server/FireVisionIPTVServer
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable firevision-iptv
sudo systemctl start firevision-iptv
```

## Managing Channels

### Import Existing M3U Playlist

```bash
# Using curl
curl -X POST https://tv.cadnative.com/api/v1/admin/channels/import-m3u \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d @playlist.json

## Releases and Docker Image

Docker images for the server are built and pushed via GitHub Actions.

- Pushing to the `main` branch (with changes in `FireVisionIPTVServer`) triggers a Docker build and publish.
- Creating/pushing a Git tag like `v1.0.0` also triggers a Docker build and publish.

The workflow builds `FireVisionIPTVServer/Dockerfile` and pushes to Docker Hub as:

- `${DOCKERHUB_USERNAME}/firevision-iptv-server:<version>`
- `${DOCKERHUB_USERNAME}/firevision-iptv-server:latest`

Where `<version>` is read from `versions.json` (field `current`) when present, otherwise it falls back to the short git SHA.

To pull and run the image directly:

```bash
docker pull your-dockerhub-username/firevision-iptv-server:latest
docker run -d --name firevision-iptv-server -p 80:80 \
  -e MONGODB_URI=mongodb://mongodb:27017/firevision-iptv \
  your-dockerhub-username/firevision-iptv-server:latest
```

Make sure the following GitHub Actions secrets are configured in the repository:

- `DOCKERHUB_USERNAME` – your Docker Hub username
- `DOCKERHUB_TOKEN` – a Docker Hub access token with permission to push images
```

Where `playlist.json` contains:
```json
{
  "m3uContent": "<your-m3u-content>",
  "clearExisting": false
}
```

### Add Single Channel

```bash
curl -X POST https://tv.cadnative.com/api/v1/admin/channels \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "channelId": "bbc_news",
    "channelName": "BBC News",
    "channelUrl": "https://example.com/bbc.m3u8",
    "channelImg": "https://example.com/bbc-logo.png",
    "channelGroup": "News"
  }'
```

## Uploading App Updates

### 1. Build Android APK

```bash
cd FireVisionIPTV
./gradlew assembleRelease
```

### 2. Upload to Server

```bash
curl -X POST https://tv.cadnative.com/api/v1/admin/app/upload \
  -H "X-API-Key: your-api-key" \
  -F "apk=@app/build/outputs/apk/release/app-release.apk" \
  -F "versionName=1.4" \
  -F "versionCode=2" \
  -F "releaseNotes=Bug fixes and performance improvements" \
  -F "isMandatory=false" \
  -F "minCompatibleVersion=1"
```

### 3. Verify Upload

```bash
curl https://tv.cadnative.com/api/v1/app/latest
```

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f mongodb
docker-compose logs -f nginx
```

### Check Service Status

```bash
docker-compose ps
```

### Database Access

```bash
# Connect to MongoDB shell
docker-compose exec mongodb mongosh firevision-iptv

# List channels
db.channels.find().pretty()

# Count channels
db.channels.countDocuments()

# List app versions
db.appversions.find().pretty()
```

## Backup and Restore

### Backup Database

```bash
# Create backup
docker-compose exec mongodb mongodump --db=firevision-iptv --out=/tmp/backup

# Copy backup to host
docker cp firevision-mongodb:/tmp/backup ./backup-$(date +%Y%m%d)

# Backup APK files
tar -czf apks-backup-$(date +%Y%m%d).tar.gz apks/
```

### Restore Database

```bash
# Copy backup to container
docker cp ./backup firevision-mongodb:/tmp/

# Restore
docker-compose exec mongodb mongorestore --db=firevision-iptv /tmp/backup/firevision-iptv
```

## Troubleshooting

### Server Not Responding

```bash
# Check if containers are running
docker-compose ps

# Restart services
docker-compose restart

# View logs for errors
docker-compose logs -f api
```

### MongoDB Connection Issues

```bash
# Check MongoDB health
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Verify environment variables
docker-compose exec api env | grep MONGODB
```

### Channel List Not Updating in App

1. Verify API is accessible: `curl https://tv.cadnative.com/api/v1/channels`
2. Check Android app logs for network errors
3. Ensure device has internet connection
4. Verify server URL in Android app code

### APK Download Failing

1. Check APK file exists: `ls -lh apks/`
2. Verify file permissions: `chmod 644 apks/*.apk`
3. Check nginx configuration for `/apks/` route
4. Verify disk space: `df -h`

## Security Recommendations

1. **Change API Key**: Use a strong random string
2. **Enable HTTPS**: Install SSL certificates
3. **Firewall**: Only open ports 80 and 443
4. **Regular Updates**: Keep Docker images updated
5. **Backup**: Regular automated backups
6. **Monitor Logs**: Watch for suspicious activity
7. **Rate Limiting**: Already configured in Express

## Support

For issues and questions:
- GitHub Issues: [your-repo-url]
- Email: support@cadnative.com

## License

MIT License - See LICENSE file for details
