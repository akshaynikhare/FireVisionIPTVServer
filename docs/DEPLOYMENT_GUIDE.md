# FireVision IPTV Server - Deployment Guide

This guide covers the complete deployment process for the FireVision IPTV server.

## Table of Contents

1. [Server Provisioning](#server-provisioning)
2. [Initial Server Setup](#initial-server-setup)
3. [Domain Configuration](#domain-configuration)
4. [SSL Certificate Setup](#ssl-certificate-setup)
5. [Deployment](#deployment)
6. [Testing](#testing)
7. [Production Configuration](#production-configuration)
8. [Maintenance](#maintenance)

---

## Server Provisioning

### Step 1: Provision a Linux Cloud Server

**Recommended Specs:**
- **OS**: Ubuntu 22.04 LTS
- **RAM**: 2GB minimum, 4GB recommended
- **Storage**: 20GB minimum, 50GB+ for APK storage
- **CPU**: 2 vCPUs minimum

**Popular Cloud Providers:**
- DigitalOcean: $12/month (2GB RAM, 2 vCPUs)
- AWS EC2: t3.small instance
- Google Cloud: e2-small instance
- Hetzner Cloud: CX21 instance

---

## Initial Server Setup

### Step 2: Basic System Configuration

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Create a non-root user
adduser firevision
usermod -aG sudo firevision
su - firevision

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version

# Log out and log back in for group changes to take effect
exit
```

### Step 3: Upload Server Files

**Option A: Using Git**
```bash
cd /opt
sudo mkdir firevision-iptv
sudo chown firevision:firevision firevision-iptv
cd firevision-iptv
git clone <your-repository-url> .
cd FireVisionIPTVServer
```

**Option B: Using SCP**
```bash
# From your local machine
cd /path/to/FireVision__IPTV
scp -r FireVisionIPTVServer firevision@YOUR_SERVER_IP:/opt/firevision-iptv/
```

---

## Domain Configuration

### Step 4: Configure Domain (tv.cadnative.com)

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Go to DNS Management
3. Add an A record:
   ```
   Type: A
   Host: tv
   Value: YOUR_SERVER_IP
   TTL: 3600 (or Auto)
   ```
4. Wait 5-15 minutes for DNS propagation

Verify:
```bash
dig tv.cadnative.com
# or
nslookup tv.cadnative.com
```

---

## SSL Certificate Setup

### Step 5: Setup SSL Certificates (HTTPS)

```bash
# Install Certbot
sudo apt install certbot -y

# Stop Docker services temporarily (if running)
docker-compose down

# Get SSL certificates
sudo certbot certonly --standalone -d tv.cadnative.com

# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates
sudo cp /etc/letsencrypt/live/tv.cadnative.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/tv.cadnative.com/privkey.pem nginx/ssl/
sudo chown -R firevision:firevision nginx/ssl
```

### Step 6: Update Nginx Configuration

```bash
nano nginx/nginx.conf
```

Uncomment the SSL section (around line 30-40):
```nginx
# Uncomment this block:
server {
    listen 80;
    server_name tv.cadnative.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tv.cadnative.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of configuration
}
```

---

## Deployment

### Step 7: Configure Environment

```bash
cd /opt/firevision-iptv/FireVisionIPTVServer

# Create environment file
cp .env.example .env

# Generate a secure API key
openssl rand -hex 32

# Edit .env file
nano .env
```

Configure the following:
```env
PORT=3000
NODE_ENV=production
MONGODB_URI=mongodb://mongodb:27017/firevision-iptv

# IMPORTANT: Use the generated secure key
API_KEY=<paste-your-generated-secure-key-here>

ALLOWED_ORIGINS=*
APK_STORAGE_PATH=./apks
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
```

Save with `Ctrl+X`, then `Y`, then `Enter`.

### Step 8: Setup Firewall

```bash
# Install UFW
sudo apt install ufw -y

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 9: Start Services

```bash
cd /opt/firevision-iptv/FireVisionIPTVServer

# Create necessary directories
mkdir -p apks uploads

# Start services
docker-compose up -d

# Check if services are running
docker-compose ps

# View logs
docker-compose logs -f
```

Wait 30 seconds, then press `Ctrl+C` to exit logs.

---

## Testing

### Step 10: Verify Installation

```bash
# Test health endpoint
curl https://tv.cadnative.com/health

# Expected response:
# {"status":"ok","timestamp":"...","uptime":...,"mongodb":"connected"}

# Test API
curl https://tv.cadnative.com/api/v1/channels

# Expected response:
# {"success":true,"count":0,"data":[]}
```

---

## Production Configuration

### Step 11: Setup Auto-restart

```bash
# Create systemd service
sudo nano /etc/systemd/system/firevision-iptv.service
```

Paste:
```ini
[Unit]
Description=FireVision IPTV Server
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/firevision-iptv/FireVisionIPTVServer
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0
User=firevision
Group=firevision

[Install]
WantedBy=multi-user.target
```

Enable service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable firevision-iptv
sudo systemctl start firevision-iptv
sudo systemctl status firevision-iptv
```

### Step 12: Setup SSL Auto-renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Add cron job for auto-renewal
sudo crontab -e

# Add this line (runs daily at 3 AM):
0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/firevision-iptv/FireVisionIPTVServer && cp /etc/letsencrypt/live/tv.cadnative.com/*.pem nginx/ssl/ && docker-compose restart nginx"
```

---

## Initial Channel Setup

### Option 1: Import Existing M3U Playlist

If you have an existing `playlist.m3u` file:

```bash
# Read the M3U file content
M3U_CONTENT=$(cat /path/to/playlist.m3u)

# Send to server
curl -X POST https://tv.cadnative.com/api/v1/admin/channels/import-m3u \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d "{\"m3uContent\": $(jq -Rs . /path/to/playlist.m3u), \"clearExisting\": false}"
```

### Option 2: Add Channels Manually

```bash
# Add a single channel
curl -X POST https://tv.cadnative.com/api/v1/admin/channels \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "channelId": "cnn_news",
    "channelName": "CNN International",
    "channelUrl": "https://cnn-cnninternational-1-eu.rakuten.wurl.tv/playlist.m3u8",
    "channelImg": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/CNN.svg/200px-CNN.svg.png",
    "channelGroup": "News",
    "isActive": true
  }'
```

### Verify Channels

```bash
# Get channel count
curl https://tv.cadnative.com/api/v1/channels | jq '.count'

# Get first 5 channels
curl https://tv.cadnative.com/api/v1/channels | jq '.data[0:5]'
```

---

## Maintenance

### Managing Channels

**Add New Channel:**
```bash
curl -X POST https://tv.cadnative.com/api/v1/admin/channels \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "channelId": "new_channel",
    "channelName": "New Channel",
    "channelUrl": "https://...",
    "channelGroup": "Entertainment"
  }'
```

**Update Channel:**
```bash
curl -X PUT https://tv.cadnative.com/api/v1/admin/channels/CHANNEL_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "channelName": "Updated Name",
    "channelUrl": "https://new-url..."
  }'
```

**Delete Channel:**
```bash
curl -X DELETE https://tv.cadnative.com/api/v1/admin/channels/CHANNEL_ID \
  -H "X-API-Key: YOUR_API_KEY"
```

### Uploading App Updates

```bash
curl -X POST https://tv.cadnative.com/api/v1/admin/app/upload \
  -H "X-API-Key: YOUR_API_KEY" \
  -F "apk=@app-release.apk" \
  -F "versionName=1.4" \
  -F "versionCode=2" \
  -F "releaseNotes=What's new in this version"
```

### Monitoring

**Set up basic monitoring:**

```bash
# Create a monitoring script
sudo nano /usr/local/bin/firevision-health-check.sh
```

Add:
```bash
#!/bin/bash
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://tv.cadnative.com/health)

if [ "$STATUS" != "200" ]; then
    echo "Server down! Status: $STATUS" | mail -s "FireVision Server Alert" your-email@example.com
    # Restart services
    cd /opt/firevision-iptv/FireVisionIPTVServer
    docker-compose restart
fi
```

Make executable and add to cron:
```bash
sudo chmod +x /usr/local/bin/firevision-health-check.sh
sudo crontab -e

# Add: Check every 5 minutes
*/5 * * * * /usr/local/bin/firevision-health-check.sh
```

### Backup Strategy

```bash
# Create backup script
nano /home/firevision/backup-firevision.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/home/firevision/backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
docker-compose -f /opt/firevision-iptv/FireVisionIPTVServer/docker-compose.yml \
    exec -T mongodb mongodump --db=firevision-iptv --archive > $BACKUP_DIR/mongodb-$DATE.archive

# Backup APKs
tar -czf $BACKUP_DIR/apks-$DATE.tar.gz -C /opt/firevision-iptv/FireVisionIPTVServer apks/

# Delete old backups (keep 7 days)
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: $DATE"
```

Make executable and schedule:
```bash
chmod +x /home/firevision/backup-firevision.sh
crontab -e

# Add: Daily backup at 2 AM
0 2 * * * /home/firevision/backup-firevision.sh >> /home/firevision/backup.log 2>&1
```

---

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

### APK Download Failing

1. Check APK file exists: `ls -lh apks/`
2. Verify file permissions: `chmod 644 apks/*.apk`
3. Check nginx configuration for `/apks/` route
4. Verify disk space: `df -h`

---

## Pre-Launch Checklist

- [ ] Server is running on tv.cadnative.com
- [ ] SSL certificates are installed and working
- [ ] Firewall is configured
- [ ] Auto-restart service is enabled
- [ ] SSL auto-renewal is configured
- [ ] Channels are imported and visible via API
- [ ] APK is uploaded and download works
- [ ] Health endpoint responds correctly
- [ ] Monitoring is set up
- [ ] Backups are configured

---

## Support

For issues:
- Check logs: `docker-compose logs -f`
- Restart services: `docker-compose restart`
- Contact: support@cadnative.com
