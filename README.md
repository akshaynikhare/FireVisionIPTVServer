# FireVision IPTV Server

[![Build & Deploy](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/docker-publish.yml)
[![Release](https://img.shields.io/github/v/release/akshaynikhare/FireVisionIPTVServer)](https://github.com/akshaynikhare/FireVisionIPTVServer/releases/latest)

Server for FireVision IPTV — manages channel lists, user accounts, device pairing, and Android app updates.

## Live Deployment

- **Website**: [http://tv.cadnative.com/](http://tv.cadnative.com/)
- **Admin**: [http://tv.cadnative.com/admin/](http://tv.cadnative.com/admin/)
- **API**: [http://tv.cadnative.com/api/v1/](http://tv.cadnative.com/api/v1/)

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  Android App │     │  Next.js     │ (port 3001 dev)
│  (Fire TV)   │     │  Frontend    │
└──────┬───────┘     └──────┬───────┘
       │ HTTPS              │
       └────────┬───────────┘
                ▼
       ┌─────────────────┐
       │   Express API   │ (port 3000)
       │   (TypeScript)  │
       └───┬─────────┬───┘
           │         │
           ▼         ▼
    ┌──────────┐ ┌────────┐
    │ MongoDB  │ │ Redis  │
    │  (7.0)   │ │(7 alp.)│
    └──────────┘ └────────┘
```

## Project Structure

```
├── backend/             Express API (TypeScript)
│   └── src/
│       ├── models/          Mongoose models (.ts)
│       ├── routes/          API routes (migrating to .ts)
│       ├── middleware/      Auth & validation
│       ├── services/        Redis, cache
│       └── utils/           JWT, init scripts
├── frontend/            Next.js 14 App Router
│   └── src/
│       ├── app/             Pages & layouts
│       ├── components/      UI & layout components
│       ├── lib/             API client, utilities
│       ├── store/           Zustand state
│       └── hooks/           Custom hooks
├── packages/shared/     Shared TypeScript types & Zod schemas
├── public/              Legacy admin/user dashboards (jQuery)
├── e2e/                 Playwright E2E tests
├── docker-compose.yml   Dev environment
└── Makefile             Docker & dev shortcuts
```

## Prerequisites

- Node.js 18+
- npm 9+
- Docker & Docker Compose (for MongoDB + Redis)

## Quick Start

```bash
# 1. Install dependencies
npm install --ignore-scripts

# 2. Copy environment config
cp .env.example .env

# 3a. Start with Docker (recommended — runs MongoDB + Redis + API)
make up-build

# 3b. Or start locally (requires local MongoDB running)
npm run dev      # Starts backend (3000) + frontend (3001)
```

Verify: `curl http://localhost:3000/health`

### Default Accounts

| Role  | Username   | Password       | URL                                            |
| ----- | ---------- | -------------- | ---------------------------------------------- |
| Admin | `admin`    | `admin123`     | http://localhost:3000/admin (legacy dashboard) |
| User  | `testuser` | `TestUser123!` | —                                              |

- **Admin** is created automatically on startup from `SUPER_ADMIN_*` env vars.
- **Test user** is opt-in — only created if `TEST_USER_USERNAME` is set in `.env`. Remove it to skip.
- **Change these in production** — set strong passwords via environment variables.

## Make Commands

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `make up`         | Start all Docker services        |
| `make up-build`   | Build and start                  |
| `make down`       | Stop all services                |
| `make logs`       | Tail all logs                    |
| `make logs-api`   | Tail API logs only               |
| `make shell`      | Shell into API container         |
| `make status`     | Show running containers          |
| `make build-prod` | Build production Docker image    |
| `make clean`      | Stop services and remove volumes |
| `make test`       | Run all tests                    |

## Development

```bash
npm run dev              # Backend + frontend concurrently
npm run dev:backend      # Backend only (port 3000)
npm run dev:frontend     # Frontend only (port 3001)
npm run typecheck        # TypeScript type checking
npm run test             # All tests (backend + frontend)
npm run test:backend     # Backend tests only
npm run test:frontend    # Frontend tests only
npm run test:e2e         # Playwright E2E tests
```

## Tech Stack

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Backend  | Express 4, TypeScript, Mongoose 8         |
| Frontend | Next.js 14, Tailwind CSS, Shadcn/ui       |
| State    | TanStack Query (server), Zustand (client) |
| Database | MongoDB 7.0                               |
| Cache    | Redis 7 (optional — graceful fallback)    |
| Auth     | Session-based + JWT                       |
| Testing  | Jest, Supertest, Playwright               |
| CI/CD    | GitHub Actions, Docker, Portainer         |

## API Endpoints

### Public

| Method | Path                                  | Description           |
| ------ | ------------------------------------- | --------------------- |
| GET    | `/health`                             | Server health check   |
| GET    | `/api/v1/channels`                    | List all channels     |
| GET    | `/api/v1/channels/playlist.m3u`       | M3U playlist          |
| GET    | `/api/v1/channels/search?q=`          | Search channels       |
| GET    | `/api/v1/app/version?currentVersion=` | Check for app updates |
| GET    | `/api/v1/app/download`                | Download latest APK   |

### Auth

| Method | Path                    | Description           |
| ------ | ----------------------- | --------------------- |
| POST   | `/api/v1/auth/register` | Register user         |
| POST   | `/api/v1/auth/login`    | Login (session-based) |
| POST   | `/api/v1/auth/logout`   | Logout                |
| POST   | `/api/v1/jwt/login`     | JWT login             |
| POST   | `/api/v1/jwt/refresh`   | Refresh JWT token     |

### Admin (requires auth + Admin role)

| Method | Path                                | Description         |
| ------ | ----------------------------------- | ------------------- |
| POST   | `/api/v1/admin/channels`            | Create channel      |
| PUT    | `/api/v1/admin/channels/:id`        | Update channel      |
| DELETE | `/api/v1/admin/channels/:id`        | Delete channel      |
| POST   | `/api/v1/admin/channels/import-m3u` | Import M3U playlist |
| GET    | `/api/v1/admin/stats`               | Server statistics   |

See [docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) for full request/response examples.

## Deployment

### Automated (Tag Push → GHCR → Portainer)

Push a git tag to auto build, publish to GHCR, and deploy to Portainer:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The version tag becomes the app version — no version is stored in the codebase.

### Required GitHub Secrets

| Category   | Secrets                                            |
| ---------- | -------------------------------------------------- |
| Portainer  | `PORTAINER_API_TOKEN`                              |
| Auth       | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`          |
| OAuth      | `GOOGLE_CLIENT_SECRET`, `GH_OAUTH_CLIENT_SECRET`   |
| Admin      | `SUPER_ADMIN_PASSWORD`                             |
| Email      | `BREVO_PASSWORD`                                   |
| App Update | `GH_APP_TOKEN` (optional — higher API rate limits) |

### Required GitHub Variables

| Variable                        | Description               | Default                                                |
| ------------------------------- | ------------------------- | ------------------------------------------------------ |
| `PORTAINER_URL`                 | Portainer instance URL    |                                                        |
| `GOOGLE_CLIENT_ID`              | Google OAuth client ID    |                                                        |
| `GH_OAUTH_CLIENT_ID`            | GitHub OAuth client ID    |                                                        |
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
| `BREVO_USER`                    | Brevo SMTP login          |                                                        |
| `MAIL_FROM`                     | Sender email address      | `noreply@firevision.local`                             |
| `APP_URL`                       | Frontend URL for emails   | `https://tv.cadnative.com`                             |
| `LIVENESS_CHECK_INTERVAL_MS`    | Liveness check interval   | `86400000` (24h)                                       |
| `EPG_REFRESH_INTERVAL_MS`       | EPG refresh interval      | `21600000` (6h)                                        |
| `CACHE_REFRESH_INTERVAL_MS`     | Cache refresh interval    | `3600000` (1h)                                         |

MongoDB and Redis URIs are hardcoded in the compose file (same stack).

### Manual CI

Run the **CI** workflow manually from the GitHub Actions tab (lint, typecheck, tests, Docker build).

### Manual Local Deploy

```bash
make build-prod
docker compose -f docker-compose.production.yml up -d
```

See [docs/PORTAINER_DEPLOYMENT.md](docs/PORTAINER_DEPLOYMENT.md) for the full deployment guide.

## Monitoring

```bash
make logs          # All service logs
make logs-api      # API logs only
make status        # Container status

# Database shell
docker compose exec mongodb mongosh firevision-iptv
```

## Backup & Restore

```bash
# Backup
docker compose exec mongodb mongodump --db=firevision-iptv --out=/tmp/backup
docker cp firevision-mongodb:/tmp/backup ./backup-$(date +%Y%m%d)

# Restore
docker cp ./backup firevision-mongodb:/tmp/
docker compose exec mongodb mongorestore --db=firevision-iptv /tmp/backup/firevision-iptv
```

## Documentation

Detailed guides in [`docs/`](docs/):

- [API Documentation](docs/API_DOCUMENTATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup Guide](docs/SETUP_GUIDE.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Portainer Deployment](docs/PORTAINER_DEPLOYMENT.md)
- [Admin Dashboard](docs/ADMIN_DASHBOARD.md)
- [TV Pairing System](docs/TV_PAIRING_SYSTEM.md)
- [Channel List Codes](docs/CHANNEL_LIST_CODE_SYSTEM.md)
- [OAuth Setup](docs/OAUTH_SETUP.md)

## License

MIT
