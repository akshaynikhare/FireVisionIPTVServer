# Portainer Deployment Guide

This guide explains how FireVision IPTV Server is deployed to production using GitHub Actions, GHCR, and Portainer.

## Overview

Deployment is fully automated via a single CI/CD pipeline:

1. Push a Git tag (`v*.*.*`) → triggers the workflow
2. Workflow builds backend + frontend Docker images → pushes to GHCR
3. Workflow creates/updates the Portainer stack via API
4. Health checks verify the deployment

```
git tag v1.2.0 && git push origin v1.2.0
    │
    ▼
┌─────────────────────────────────────────────┐
│  GitHub Actions: Build, Publish & Deploy    │
│                                             │
│  1. Build backend image  ──► GHCR           │
│  2. Build frontend image ──► GHCR           │
│  3. Create GitHub Release                   │
│  4. envsubst docker-compose.production.yml  │
│  5. Create or update Portainer stack        │
│  6. Health check tv.cadnative.com/health    │
└─────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────┐
│  Production Server (Portainer)              │
│                                             │
│  firevision-api       ◄── backend image     │
│  firevision-frontend  ◄── frontend image    │
│  firevision-scheduler ◄── backend image     │
│  firevision-mongodb   ◄── mongo:7           │
│  firevision-redis     ◄── redis:7-alpine    │
│                                             │
│  Nginx Proxy Manager (external)             │
│    tv.cadnative.com → frontend / api        │
└─────────────────────────────────────────────┘
```

## Prerequisites

- Portainer instance running and accessible
- Nginx Proxy Manager on the same Docker network (`base_network_cadnative`)
- GitHub repository with Actions enabled

## Setup Instructions

### 1. Configure Portainer

#### Create API Token

1. Log in to Portainer
2. Go to **User settings** → **Access tokens**
3. Click **Add access token**, name it `github-actions-deploy`
4. Copy the token

#### GHCR Registry Access

If your images are private, add GHCR as a registry in Portainer:

1. Go to **Registries** → **Add registry**
2. Select **Custom registry**
3. URL: `ghcr.io`
4. Username: your GitHub username
5. Password: a GitHub PAT with `read:packages` scope

> **Note:** The stack is created automatically by the CI workflow on first deploy. You do not need to create it manually.

### 2. Configure Nginx Proxy Manager

Create a proxy host for `tv.cadnative.com`:

**Details tab:**

- Domain: `tv.cadnative.com`
- Scheme: `http`
- Forward Hostname: `firevision-frontend`
- Forward Port: `3000`
- Enable **Cache Assets**

**Custom Locations tab — add two locations:**

| Location  | Scheme | Forward Hostname | Forward Port |
| --------- | ------ | ---------------- | ------------ |
| `/api`    | http   | `firevision-api` | 3000         |
| `/health` | http   | `firevision-api` | 3000         |

**SSL tab:**

- Request a new Let's Encrypt certificate
- Enable **Force SSL** and **HTTP/2 Support**

This works because `firevision-api` and `firevision-frontend` are on the `base_network_cadnative` external network, which NPM is also on.

### 3. Configure GitHub Secrets & Variables

Go to **Settings** → **Secrets and variables** → **Actions**.

#### Secrets

| Secret Name              | Description                 | Example / How to Generate  |
| ------------------------ | --------------------------- | -------------------------- |
| `PORTAINER_API_TOKEN`    | Portainer API token         | `ptr_xxxxx` (from step 1)  |
| `JWT_ACCESS_SECRET`      | JWT signing secret          | `openssl rand -base64 32`  |
| `JWT_REFRESH_SECRET`     | Refresh token secret        | `openssl rand -base64 32`  |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth secret         | Google Cloud Console       |
| `GH_OAUTH_CLIENT_SECRET` | GitHub OAuth secret         | GitHub OAuth Apps          |
| `SUPER_ADMIN_PASSWORD`   | Super admin password        | Strong random password     |
| `BREVO_PASSWORD`         | Brevo SMTP password         | Brevo dashboard            |
| `GH_APP_TOKEN`           | GitHub API token (optional) | GitHub PAT with repo scope |

#### Variables

| Variable Name                   | Description               | Example / Default                                      |
| ------------------------------- | ------------------------- | ------------------------------------------------------ |
| `PORTAINER_URL`                 | Portainer instance URL    | `http://YOUR_SERVER_IP:8000`                           |
| `GOOGLE_CLIENT_ID`              | Google OAuth client ID    | From Google Cloud Console                              |
| `GH_OAUTH_CLIENT_ID`            | GitHub OAuth client ID    | From GitHub OAuth Apps                                 |
| `GOOGLE_REDIRECT_URI`           | Google OAuth callback URL | `https://tv.cadnative.com/api/v1/auth/google/callback` |
| `GH_OAUTH_REDIRECT_URI`         | GitHub OAuth callback URL | `https://tv.cadnative.com/api/v1/auth/github/callback` |
| `SUPER_ADMIN_USERNAME`          | Super admin username      | `admin`                                                |
| `SUPER_ADMIN_EMAIL`             | Super admin email         | `admin@firevision.local`                               |
| `SUPER_ADMIN_CHANNEL_LIST_CODE` | Super admin channel code  |                                                        |
| `GH_APP_OWNER`                  | GitHub repo owner for APK | `akshaynikhare`                                        |
| `GH_APP_REPO`                   | GitHub repo name for APK  | `FireVisionIPTV`                                       |
| `GH_APP_APK_PATTERN`            | APK asset pattern         | `.apk`                                                 |
| `BREVO_HOST`                    | Brevo SMTP host           | `smtp-relay.brevo.com`                                 |
| `BREVO_PORT`                    | Brevo SMTP port           | `587`                                                  |
| `BREVO_USER`                    | Brevo SMTP key            | From Brevo dashboard                                   |
| `MAIL_FROM`                     | Sender email address      | `noreply@mail.cadnative.com`                           |
| `APP_URL`                       | Public app URL            | `https://tv.cadnative.com`                             |
| `LIVENESS_CHECK_INTERVAL_MS`    | Liveness check interval   | `86400000` (24h)                                       |
| `EPG_REFRESH_INTERVAL_MS`       | EPG refresh interval      | `21600000` (6h)                                        |
| `CACHE_REFRESH_INTERVAL_MS`     | Cache refresh interval    | `3600000` (1h)                                         |

MongoDB and Redis URIs are hardcoded in the compose file (internal Docker networking).

## Deploying

### Trigger a Deploy

```bash
# Tag and push — this triggers the full pipeline
git tag v1.2.0
git push origin v1.2.0
```

The workflow will:

1. Build and push `ghcr.io/akshaynikhare/firevisioniptvserver:1.2.0` (backend)
2. Build and push `ghcr.io/akshaynikhare/firevisioniptvserver-frontend:1.2.0` (frontend)
3. Create a GitHub Release with auto-generated notes
4. Substitute secrets/variables into `docker-compose.production.yml`
5. Create the Portainer stack (first deploy) or update it (subsequent deploys)
6. Wait 30s for containers to start
7. Run health checks (10 retries, 10s apart)
8. Report deployment summary

### Monitor Deployment

**GitHub Actions:** Watch the workflow in the Actions tab.

**Portainer:** Go to **Stacks** → `FireVisionTV_Prod` → check container status and logs.

**Health endpoint:**

```bash
curl https://tv.cadnative.com/health
# {"status":"ok","timestamp":"...","uptime":...,"mongodb":"connected","redis":"connected","version":"1.2.0"}
```

## Docker Images

Two images are built per release:

| Image                                                           | Dockerfile            | Contains                |
| --------------------------------------------------------------- | --------------------- | ----------------------- |
| `ghcr.io/akshaynikhare/firevisioniptvserver:<version>`          | `Dockerfile`          | Express API + scheduler |
| `ghcr.io/akshaynikhare/firevisioniptvserver-frontend:<version>` | `Dockerfile.frontend` | Next.js standalone      |

Both use GHA cache (`cache-from: type=gha`) for faster rebuilds.

## Production Compose Services

| Service   | Image            | Network                              | Notes                         |
| --------- | ---------------- | ------------------------------------ | ----------------------------- |
| api       | backend image    | `firevision-network` + `gkz-network` | Exposed to NPM                |
| frontend  | frontend image   | `firevision-network` + `gkz-network` | Exposed to NPM                |
| scheduler | backend image    | `firevision-network`                 | Internal only                 |
| mongodb   | `mongo:7`        | `firevision-network`                 | Internal only, persistent vol |
| redis     | `redis:7-alpine` | `firevision-network`                 | Internal only, persistent vol |

Image tags are **not** defaulted to `:latest` — they are set explicitly by the CI workflow via `envsubst`. If a variable is missing, the deploy fails fast rather than pulling a stale image.

## Rollback

### Option 1: Redeploy Previous Version (recommended)

```bash
# Re-tag from a previous version — the images already exist in GHCR
git tag v1.1.9-hotfix <previous-commit-sha>
git push origin v1.1.9-hotfix
```

Or update the stack manually in Portainer:

1. Go to **Stacks** → `FireVisionTV_Prod` → **Editor**
2. Change the image tags to the previous version
3. Click **Update the stack** with **Pull image** enabled

### Option 2: Portainer Redeploy

1. Go to **Stacks** → `FireVisionTV_Prod`
2. Click **Redeploy** with **Pull latest image** unchecked (uses the current tag)

## Troubleshooting

### Stack Creation Fails

The workflow auto-creates the stack on first deploy. If it fails:

```bash
# Check Portainer API is reachable
curl -H "X-API-Key: YOUR_TOKEN" http://YOUR_SERVER:8000/api/status

# List endpoints (need at least one)
curl -H "X-API-Key: YOUR_TOKEN" http://YOUR_SERVER:8000/api/endpoints
```

### Image Pull Denied

If Portainer can't pull from GHCR:

1. Check GHCR package visibility (Settings → Packages → make public, or add registry creds to Portainer)
2. Verify the image was actually pushed — check the GitHub Actions build logs

### Health Check Fails

```bash
# Check container status
docker ps --filter name=firevision

# Check API logs
docker logs firevision-api

# Check MongoDB
docker exec firevision-mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis
docker exec firevision-redis redis-cli ping
```

### NPM Can't Reach Containers

Ensure both `firevision-api` and `firevision-frontend` are on the `base_network_cadnative` external network. Check with:

```bash
docker network inspect base_network_cadnative | grep -A2 firevision
```

## Version Tagging

Use semantic versioning:

- `v1.0.0` — Major release (breaking changes)
- `v1.1.0` — Minor release (new features)
- `v1.1.1` — Patch release (bug fixes)

## Security

- Secrets are injected at deploy time via `envsubst` — never stored in the compose file or image
- GHCR images are authenticated via `GITHUB_TOKEN`
- Portainer API uses API key authentication
- SSL is terminated at Nginx Proxy Manager (Let's Encrypt)
- Both API and frontend containers run as non-root users
