# FireVision IPTV Server

[![Build & Deploy](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/docker-publish.yml)
[![CI](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/ci.yml/badge.svg)](https://github.com/akshaynikhare/FireVisionIPTVServer/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/akshaynikhare/FireVisionIPTVServer)](https://github.com/akshaynikhare/FireVisionIPTVServer/releases/latest)
[![License](https://img.shields.io/github/license/akshaynikhare/FireVisionIPTVServer)](LICENSE)

Backend and admin dashboard for FireVision IPTV — manages channels, users, device pairing, M3U imports, and app updates.

## Architecture

```
┌──────────────┐     ┌──────────────┐
│  Android App │     │  Next.js     │
│  (Fire TV)   │     │  Frontend    │
└──────┬───────┘     └──────┬───────┘
       │                    │
       └────────┬───────────┘
                ▼
       ┌─────────────────┐
       │   Express API   │
       │  (TypeScript)   │
       └───┬─────────┬───┘
           │         │
           ▼         ▼
    ┌──────────┐ ┌────────┐
    │ MongoDB  │ │ Redis  │
    └──────────┘ └────────┘
```

## Tech Stack

|              |                                             |
| ------------ | ------------------------------------------- |
| **Backend**  | Express, TypeScript, Mongoose               |
| **Frontend** | Next.js 14, Tailwind CSS, Shadcn/ui         |
| **State**    | TanStack Query + Zustand                    |
| **Database** | MongoDB 7                                   |
| **Cache**    | Redis 7 (optional — graceful fallback)      |
| **Auth**     | Session-based + JWT, OAuth (Google, GitHub) |
| **Testing**  | Jest, Supertest, Playwright                 |
| **CI/CD**    | GitHub Actions → Docker → Portainer         |

## Deployment

Tag-based auto deploy: push a git tag → builds Docker image → publishes to GHCR → deploys via Portainer.

```
git tag v1.2.3 && git push origin v1.2.3
```

See [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) and [Portainer Guide](docs/PORTAINER_DEPLOYMENT.md) for full setup.

## Documentation

Detailed guides in [`docs/`](docs/):

- [API Documentation](docs/API_DOCUMENTATION.md) — Endpoints, request/response examples
- [Architecture](docs/ARCHITECTURE.md) — System design and data flow
- [Setup Guide](docs/SETUP_GUIDE.md) — Dev environment setup
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md) — CI/CD and production deploy
- [Portainer Deployment](docs/PORTAINER_DEPLOYMENT.md) — Container orchestration
- [Admin Dashboard](docs/ADMIN_DASHBOARD.md) — Admin panel usage
- [TV Pairing System](docs/TV_PAIRING_SYSTEM.md) — Device pairing flow
- [Channel List Codes](docs/CHANNEL_LIST_CODE_SYSTEM.md) — Channel management
- [OAuth Setup](docs/OAUTH_SETUP.md) — Google & GitHub OAuth config

## License

[MIT](LICENSE)
