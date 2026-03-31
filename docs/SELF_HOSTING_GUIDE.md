# Self-Hosting Guide

This guide walks you through setting up your own FireVision IPTV server. No programming experience required -- just follow the steps in order.

## Table of Contents

1. [What You Need](#what-you-need)
2. [Install Docker](#install-docker)
3. [Download the Server Files](#download-the-server-files)
4. [Configure Your Server](#configure-your-server)
5. [Start the Server](#start-the-server)
6. [First-Time Setup](#first-time-setup)
7. [Connect Your TV or Phone](#connect-your-tv-or-phone)
8. [Configuration Reference](#configuration-reference)
9. [Updating to a New Version](#updating-to-a-new-version)
10. [Troubleshooting](#troubleshooting)

---

## What You Need

Before you begin, make sure you have:

- **A computer** that will run the server. This can be a Windows PC, Mac, or Linux machine. It needs at least 2 GB of RAM and should stay powered on while you want to watch TV.
- **A stable internet connection** on the server machine.
- **Docker Desktop** (we will install this in the next step). Docker runs your server inside lightweight containers so you do not need to install databases or other software manually.

That is it. You do not need to know how to code.

---

## Install Docker

Docker packages everything the server needs (the app, the database, the cache) into containers that run on your machine.

### Windows

1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) and click **Download for Windows**.
2. Run the installer and follow the prompts. Accept the defaults.
3. When installation finishes, Docker Desktop will ask you to restart your computer. Do so.
4. After restarting, open **Docker Desktop** from your Start menu. Wait until the bottom-left icon turns green (this means Docker is running).

### Mac

1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/) and click **Download for Mac**.
   - Choose **Apple Silicon** if you have an M1/M2/M3/M4 Mac.
   - Choose **Intel** if you have an older Mac.
2. Open the downloaded `.dmg` file and drag Docker into your Applications folder.
3. Open **Docker** from Applications. You may need to approve a system permission.
4. Wait until the Docker icon in your menu bar shows a steady state (not animating).

### Linux (Ubuntu/Debian)

Open a terminal and run these commands one at a time:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

Log out and log back in, then verify Docker is working:

```bash
docker --version
```

You should see something like `Docker version 24.x.x` or newer.

---

## Download the Server Files

You only need two files from the project to get started: the self-hosting Docker Compose file and the environment template.

### Option A: Download the files directly

1. Create a folder on your computer where you want to keep the server files. For example:
   - **Windows**: `C:\firevision-iptv`
   - **Mac/Linux**: `~/firevision-iptv`

2. Download these two files from the GitHub repository and save them into that folder:
   - `docker-compose.selfhost.yml` -- [direct link](https://raw.githubusercontent.com/akshaynikhare/FireVisionIPTVServer/main/docker-compose.selfhost.yml)
   - `.env.example` -- [direct link](https://raw.githubusercontent.com/akshaynikhare/FireVisionIPTVServer/main/.env.example)

3. Rename `.env.example` to `.env` (remove the `.example` part).

### Option B: Clone the full repository

If you are comfortable with Git, you can clone the entire repository:

```bash
git clone https://github.com/akshaynikhare/FireVisionIPTVServer.git
cd FireVisionIPTVServer
cp .env.example .env
```

---

## Configure Your Server

Open the `.env` file in any text editor (Notepad on Windows, TextEdit on Mac, or any editor you prefer). You need to change a few settings.

### Required Settings

#### 1. Admin Account

These are the credentials you will use to log in for the first time. **Change them from the defaults.**

```env
SUPER_ADMIN_USERNAME=myadmin
SUPER_ADMIN_PASSWORD=MySecurePassword123!
SUPER_ADMIN_EMAIL=you@example.com
```

Pick a strong password -- at least 8 characters with a mix of uppercase, lowercase, numbers, and symbols.

#### 2. Security Secrets

JWT secrets are used to keep login sessions secure. You need to replace the placeholder values with random strings.

**The easy way** -- open a terminal (Command Prompt on Windows, Terminal on Mac/Linux) and run:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run it twice and paste each result into the corresponding line:

```env
JWT_ACCESS_SECRET=paste-first-random-string-here
JWT_REFRESH_SECRET=paste-second-random-string-here
```

If you do not have Node.js installed, you can use any password generator to create two random strings of 32+ characters each.

#### 3. Docker Images

The `.env` file already includes default image names. Verify they are set:

```env
DOCKER_IMAGE=ghcr.io/akshaynikhare/firevisioniptvserver:latest
DOCKER_FRONTEND_IMAGE=ghcr.io/akshaynikhare/firevisioniptvserver-frontend:latest
```

> **Note**: Check the project's GitHub releases page for the latest image tags.

### Optional Settings

These are fine to leave at their defaults for most setups:

| Setting | Default | What it does |
|---------|---------|-------------|
| `PORT` | `3000` | The port the API server listens on inside Docker. You usually do not need to change this. |
| `REDIS_URL` | `redis://localhost:6379` | Connection to the Redis cache. The Docker Compose file overrides this internally to use the container hostname, so you do not need to change it. |
| `MONGODB_URI` | `mongodb://mongodb:27017/firevision-iptv` | Connection to the database. The default works with Docker Compose. |
| `ALLOWED_ORIGINS` | `*` | Which websites can talk to your server. `*` means any. The Docker Compose file sets this to `*` by default. |

> **Note about REDIS_URL**: The `.env.example` file defaults to `redis://localhost:6379`, which is correct for running outside Docker. When using Docker Compose, the compose file passes `redis://redis:6379` directly to the containers, so you do not need to change this value.

Leave the OAuth (Google/GitHub login), email, and scheduler settings alone for now. You can configure them later once the basics are working.

---

## Start the Server

Open a terminal and navigate to the folder where your files are:

```bash
cd /path/to/your/firevision-iptv
```

On Windows, this might look like:

```bash
cd C:\firevision-iptv
```

Then start the server:

```bash
docker compose -f docker-compose.selfhost.yml up -d
```

> If that command does not work, try `docker-compose` (with a hyphen) instead of `docker compose` (with a space). Older Docker versions use the hyphenated form.

This will:
- Download the server images (this may take a few minutes the first time)
- Start the database (MongoDB)
- Start the cache (Redis)
- Start the API server
- Start the frontend dashboard
- Start the background scheduler

### Verify It Is Running

After a minute or two, check that the containers are running:

```bash
docker compose -f docker-compose.selfhost.yml ps
```

You should see output like:

```
NAME                   STATUS
firevision-api         Up
firevision-frontend    Up
firevision-mongodb     Up
firevision-redis       Up
firevision-scheduler   Up
```

All containers should show `Up`. If any show `Restarting` or `Exit`, see the [Troubleshooting](#troubleshooting) section below.

### View Logs

To see what the server is doing (useful for checking startup or debugging):

```bash
docker compose -f docker-compose.selfhost.yml logs -f api
```

Press `Ctrl+C` to stop watching logs.

---

## First-Time Setup

### 1. Open the Dashboard

Open your web browser and go to:

```
http://localhost:3001
```

> **Note**: The frontend runs on port 3001. The backend API runs on port 3000. If you set up the server using the full repository with the dev compose file, the API is on port 8009 instead.

### 2. Log In

Enter the admin username and password you set in the `.env` file (`SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD`).

### 3. Add Channels

Once logged in, you can add TV channels in two ways:

**Import from an M3U playlist file:**
1. Go to the Channels section in the dashboard.
2. Click "Import" or "Bulk Import".
3. Paste your M3U playlist content or upload the file.
4. Click Import.

**Add channels one at a time:**
1. Go to the Channels section.
2. Click "Add Channel".
3. Enter the channel name, stream URL (must be an HLS `.m3u8` link), logo URL, and group.
4. Save.

### 4. Get Your Playlist Code

Every user account has a unique 6-character playlist code (like `5T6FEP`). This code is how your TV app or media player connects to your channel list.

Find your playlist code in the dashboard under your user profile or the Users section.

Your personal playlist URL is:

```
http://YOUR_SERVER_ADDRESS:3000/api/v1/tv/playlist/YOUR_CODE
```

Replace `YOUR_SERVER_ADDRESS` with your machine's IP address and `YOUR_CODE` with your 6-character code.

---

## Connect Your TV or Phone

### Find Your Server's IP Address

Your TV or phone needs to know where the server is on your network.

**Windows:**
1. Open Command Prompt.
2. Type `ipconfig` and press Enter.
3. Look for `IPv4 Address` under your active network adapter (usually Wi-Fi or Ethernet). It will look like `192.168.1.100`.

**Mac:**
1. Open Terminal.
2. Type `ipconfig getifaddr en0` (for Wi-Fi) or `ipconfig getifaddr en1` (for Ethernet).

**Linux:**
1. Open Terminal.
2. Type `hostname -I`.

### Connect the FireVision TV App

1. Install the FireVision IPTV app on your Android TV or Fire TV Stick.
2. Open the app. It will display a pairing PIN.
3. In the web dashboard, go to the TV pairing section.
4. Enter the PIN shown on your TV screen.
5. Once paired, the TV app will load your channel list automatically.

### Connect Any IPTV Player (VLC, TiviMate, etc.)

Use your playlist URL in any IPTV player that supports M3U playlists:

```
http://YOUR_SERVER_IP:3000/api/v1/tv/playlist/YOUR_CODE
```

For example, if your IP is `192.168.1.100` and your code is `5T6FEP`:

```
http://192.168.1.100:3000/api/v1/tv/playlist/5T6FEP
```

### Accessing From Outside Your Home Network

By default, the server is only reachable from devices on the same network (e.g., the same Wi-Fi). To access it remotely:

1. **Port forwarding**: Log in to your router's admin page (usually `192.168.1.1`) and forward port `3000` from the internet to your server's local IP address. Then use your public IP address instead.
2. **VPN/Tailscale**: Install Tailscale (free) on both the server and your device for a secure private connection without port forwarding.
3. **Reverse proxy**: For more advanced setups, put the server behind a reverse proxy (Nginx, Caddy) with a domain name and SSL certificate.

> **Security warning**: If you open port 3000 to the internet, change the default passwords and consider setting `ALLOWED_ORIGINS` in your `.env` to your specific domain instead of `*`.

---

## Configuration Reference

Below is every setting available in the `.env` file. Required settings are marked with (**required**).

### Core

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `3000` | No | Port the API listens on inside Docker. |
| `NODE_ENV` | `production` | No | Set to `production` for self-hosting. |
| `APP_VERSION` | `0.0.0` | No | Application version string. |

### Database and Cache

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MONGODB_URI` | `mongodb://mongodb:27017/firevision-iptv` | No | MongoDB connection string. The default works with Docker Compose. |
| `REDIS_URL` | `redis://redis:6379` | No | Redis connection string. The app works without Redis, but it improves performance. |

### Admin Account

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `SUPER_ADMIN_USERNAME` | `admin` | **Yes** | Username for the initial admin account. Change this. |
| `SUPER_ADMIN_PASSWORD` | `admin123` | **Yes** | Password for the initial admin account. Change this to a strong password. |
| `SUPER_ADMIN_EMAIL` | `admin@yourdomain.com` | **Yes** | Email for the admin account. |
| `SUPER_ADMIN_CHANNEL_LIST_CODE` | `5T6FEP` | No | 6-character playlist code for the admin. Auto-generated if not set. |
| `FORCE_UPDATE_ADMIN_PASSWORD` | `false` | No | Set to `true` to reset the admin password on next restart. Remove after use. |

### Security

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `JWT_ACCESS_SECRET` | `your-access-secret` | **Yes** | Random string used to sign login tokens. Generate a unique value. |
| `JWT_REFRESH_SECRET` | `your-refresh-secret` | **Yes** | Random string used to sign refresh tokens. Generate a unique value. |
| `ALLOWED_ORIGINS` | `*` | No | Comma-separated list of allowed web origins. `*` allows all. |

### OAuth (Optional)

These enable "Sign in with Google" and "Sign in with GitHub" on the dashboard. You can skip these for a basic setup.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `GOOGLE_CLIENT_ID` | — | No | Google OAuth client ID. |
| `GOOGLE_CLIENT_SECRET` | — | No | Google OAuth client secret. |
| `GOOGLE_REDIRECT_URI` | — | No | Google OAuth callback URL. |
| `GH_OAUTH_CLIENT_ID` | — | No | GitHub OAuth client ID. |
| `GH_OAUTH_CLIENT_SECRET` | — | No | GitHub OAuth client secret. |
| `GH_OAUTH_REDIRECT_URI` | — | No | GitHub OAuth callback URL. |

### Email (Optional)

Email is used for password resets and verification. You can skip this for a basic setup -- the admin can manage users directly.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MAIL_PROVIDER` | `mailhog` | No | Email provider. Use `brevo` for real email delivery. |
| `BREVO_HOST` | `smtp-relay.brevo.com` | No | SMTP server hostname (for Brevo). |
| `BREVO_PORT` | `587` | No | SMTP server port. |
| `BREVO_USER` | — | No | SMTP username. |
| `BREVO_PASSWORD` | — | No | SMTP password. |
| `MAIL_FROM` | `noreply@firevision.local` | No | Sender address for outgoing emails. |
| `APP_URL` | `http://localhost:3001` | No | Public URL of the frontend. Used in email links. |

### Background Scheduler

The scheduler runs automated tasks like checking if streams are still online.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DISABLE_SCHEDULER` | `true` (on the API container) | No | Set to `true` on the API container when the scheduler runs as a separate service (default in Docker Compose). |
| `LIVENESS_CHECK_INTERVAL_MS` | `86400000` (24 hours) | No | How often to check if channels are still working. |
| `EPG_REFRESH_INTERVAL_MS` | `21600000` (6 hours) | No | How often to refresh the TV program guide. |
| `CACHE_REFRESH_INTERVAL_MS` | `3600000` (1 hour) | No | How often to refresh external source caches. |
| `STREAM_HEALTH_CHECK_INTERVAL_MS` | `14400000` (4 hours) | No | How often to check stream health and promote backups. |
| `YOUTUBE_REFRESH_INTERVAL_MS` | `14400000` (4 hours) | No | How often to refresh YouTube live stream URLs. |

### App Updates (Optional)

These settings let the server serve APK updates to the Android/Fire TV app.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `GH_APP_OWNER` | `akshaynikhare` | No | GitHub username that owns the app repository. |
| `GH_APP_REPO` | `FireVisionIPTV` | No | GitHub repository name for the app. |
| `GH_APP_APK_PATTERN` | `.apk` | No | File pattern to match APK assets in releases. |
| `GH_APP_TOKEN` | — | No | GitHub token for higher API rate limits (no scopes required). |

### Error Tracking (Optional)

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `SENTRY_DSN` | — | No | Sentry DSN for error tracking. |

### YouTube / Free Sources

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `YT_DLP_CONCURRENCY` | `3` | No | Max concurrent yt-dlp processes for resolving YouTube live stream URLs. Increase if you have many YouTube sources. |

### Docker Images

These are used in `docker-compose.selfhost.yml` and must be set in your `.env` file.

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DOCKER_IMAGE` | `ghcr.io/akshaynikhare/firevisioniptvserver:latest` | **Yes** | Docker image for the API server and scheduler. |
| `DOCKER_FRONTEND_IMAGE` | `ghcr.io/akshaynikhare/firevisioniptvserver-frontend:latest` | **Yes** | Docker image for the frontend dashboard. |
| `APP_VERSION` | — | No | Version tag passed to the API container. |

---

## Updating to a New Version

When a new version of the server is released:

1. Open a terminal and navigate to your server folder.

2. Pull the latest images:
   ```bash
   docker compose -f docker-compose.selfhost.yml pull
   ```

3. Restart the server with the new images:
   ```bash
   docker compose -f docker-compose.selfhost.yml up -d
   ```

4. Verify everything is running:
   ```bash
   docker compose -f docker-compose.selfhost.yml ps
   ```

Your data (channels, users, settings) is stored in Docker volumes and will not be lost during an update.

---

## Troubleshooting

### Docker Is Not Starting

**Symptoms**: `docker` command not found, or Docker Desktop shows an error.

**Fixes**:
- **Windows**: Make sure "Virtualization" is enabled in your BIOS. Docker Desktop also requires WSL 2 -- the installer should set this up, but if it fails, follow [Microsoft's WSL install guide](https://learn.microsoft.com/en-us/windows/wsl/install).
- **Mac**: Make sure you downloaded the correct version (Apple Silicon vs Intel). Try restarting Docker Desktop from the menu bar icon.
- **Linux**: Make sure you logged out and back in after running `sudo usermod -aG docker $USER`.

### Port 3000 Already in Use

**Symptoms**: The API container keeps restarting. Logs show `EADDRINUSE` or `port 3000 already in use`.

**Fix**: Another application is using port 3000. Either stop that application, or change the port mapping in your compose file. If you cloned the full repo and are using the dev compose file, the API is mapped to port 8009 instead.

### MongoDB Connection Refused

**Symptoms**: Logs show `MongoServerSelectionError` or `ECONNREFUSED 127.0.0.1:27017`.

**Fixes**:
1. Check that the MongoDB container is running:
   ```bash
   docker compose -f docker-compose.selfhost.yml ps
   ```
2. If it shows `Exit` or `Restarting`, check its logs:
   ```bash
   docker compose -f docker-compose.selfhost.yml logs mongodb
   ```
3. Make sure `MONGODB_URI` in your `.env` starts with `mongodb://mongodb:27017/` (not `localhost`) when using Docker Compose. The hostname `mongodb` refers to the Docker container name.
4. Try restarting all services:
   ```bash
   docker compose -f docker-compose.selfhost.yml down
   docker compose -f docker-compose.selfhost.yml up -d
   ```

### Redis Connection Issues

**Symptoms**: Logs show `Redis connection error` or `ECONNREFUSED`.

**Fixes**:
1. Redis is optional -- the server works without it. If Redis keeps failing, you can remove the `redis` service from the compose file and remove the `REDIS_URL` line from your `.env`.
2. If you want Redis running, check its container:
   ```bash
   docker compose -f docker-compose.selfhost.yml logs redis
   ```

### Cannot Log In

**Symptoms**: The login page says "Invalid credentials" even with the correct username and password.

**Fixes**:
1. Double-check that `SUPER_ADMIN_USERNAME` and `SUPER_ADMIN_PASSWORD` in your `.env` match what you are typing.
2. The admin account is only created on first startup. If you changed the password in `.env` after the first run, set `FORCE_UPDATE_ADMIN_PASSWORD=true` and restart:
   ```bash
   docker compose -f docker-compose.selfhost.yml restart api
   ```
   Then remove `FORCE_UPDATE_ADMIN_PASSWORD` from `.env` afterward.
3. Check that MongoDB is running and connected (see above).

### Streams Work in Browser but Not on TV App

**Symptoms**: You can open a stream URL in your browser and it plays, but the TV app shows a black screen or loading spinner.

**Fixes**:
1. Make sure the TV app and the server are on the same network.
2. Use the server's local IP address (like `192.168.1.100`), not `localhost`, in the playlist URL.
3. Check that port 3000 is not blocked by a firewall on the server machine.
4. Some streams require the server to proxy them. Make sure the stream URL is accessible from the server machine (not just from your browser).

### Containers Use Too Much Disk Space

Over time, Docker images and volumes can accumulate.

```bash
# See how much space Docker is using
docker system df

# Remove unused images and stopped containers (safe to run)
docker system prune
```

> Do not run `docker system prune --volumes` unless you want to delete your database. Your channels, users, and settings are stored in Docker volumes.

### Viewing Detailed Logs

To see full logs for a specific service:

```bash
# API server logs
docker compose -f docker-compose.selfhost.yml logs -f api

# Frontend logs
docker compose -f docker-compose.selfhost.yml logs -f frontend

# Database logs
docker compose -f docker-compose.selfhost.yml logs -f mongodb

# All services
docker compose -f docker-compose.selfhost.yml logs -f
```

### Starting Fresh

If you want to reset everything and start over:

```bash
# Stop all services and delete all data (channels, users, everything)
docker compose -f docker-compose.selfhost.yml down -v

# Start fresh
docker compose -f docker-compose.selfhost.yml up -d
```

> **Warning**: The `-v` flag deletes all data volumes. Only do this if you truly want a clean slate.
