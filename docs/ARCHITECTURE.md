# Architecture

Monorepo: Express API backend + Next.js frontend + shared packages. Serves an Android TV/Fire TV app with channel management, TV pairing, and OTA updates via GitHub Releases.

## System Overview

```mermaid
graph TB
    FireTV["Android TV / Fire TV"] -->|"REST API (JWT)"| Nginx
    Browser -->|"HTTPS"| Nginx

    Nginx["Nginx :80/:443"] --> API["Express API :3000"]
    Nginx --> Frontend["Next.js Frontend :3001"]

    API --> MongoDB[("MongoDB 7")]
    API --> Redis[("Redis 7 (optional)")]
    API -->|"fetch releases"| GitHub["GitHub Releases API"]

    Scheduler["Scheduler Service"] --> MongoDB
    Scheduler --> Redis

    subgraph "Legacy (being replaced)"
        API --> Static["public/admin/ & public/user/"]
    end
```

## Project Structure

```
FireVisionIPTVServer/
├── backend/                 Express API (TypeScript)
│   └── src/
│       ├── models/              Mongoose models (7 models)
│       ├── routes/              API routes (15 route files)
│       ├── middleware/          Auth & validation
│       ├── services/            Scheduler, EPG, cache, email, stream prober
│       └── utils/               JWT, init scripts
├── frontend/                Next.js 14 App Router
│   └── src/
│       ├── app/                 Pages & layouts
│       ├── components/          UI & layout components
│       ├── lib/                 API client, utilities
│       ├── store/               Zustand state
│       └── hooks/               Custom hooks
├── packages/shared/         Shared TypeScript types & Zod schemas
├── public/                  Legacy dashboards (jQuery/AdminLTE)
├── e2e/                     Playwright E2E tests
├── .github/workflows/       CI/CD pipelines
├── docker-compose.yml              Dev environment
├── docker-compose.production.yml   Production
└── Makefile                 Docker & dev shortcuts
```

## Tech Stack

| Layer    | Technology                                                      |
| -------- | --------------------------------------------------------------- |
| Backend  | Node.js 18, Express.js 4, TypeScript                            |
| Database | MongoDB 7 (Mongoose 8)                                          |
| Cache    | Redis 7 (optional, graceful fallback)                           |
| Auth     | Session (X-Session-Id) + JWT (Bearer) + OAuth2 (Google, GitHub) |
| Frontend | Next.js 14, Tailwind CSS, Shadcn/ui, TanStack Query, Zustand    |
| CI/CD    | GitHub Actions → GHCR → Portainer                               |
| Testing  | Jest, Supertest, Playwright                                     |
| Domain   | tv.cadnative.com (Let's Encrypt SSL)                            |

## Database Schema

### Collections

```mermaid
erDiagram
    users ||--o{ channels : "has assigned"
    users ||--o{ sessions : "has"
    users ||--o{ pairingrequests : "linked to"
    users ||--o{ refreshtokens : "has"

    users {
        string username UK
        string email UK
        string password "bcrypt (10 rounds)"
        string role "Admin | User"
        string channelListCode UK "6-char code"
        boolean isActive
        object metadata "lastPairedDevice, deviceModel, pairedAt"
        string googleId
        string githubId
    }

    channels {
        string channelId UK
        string channelName "text indexed"
        string channelUrl
        string channelImg
        string channelGroup "indexed"
        number order
        object metadata "country, language, lastTested, isWorking, responseTime"
        array alternateStreams "streamUrl, quality, liveness"
    }

    sessions {
        string sessionId UK
        ObjectId userId
        date expiresAt "TTL index"
        string ipAddress
        date lastActivity
    }

    pairingrequests {
        string pin UK "6-digit"
        string status "pending | completed | expired"
        ObjectId userId
        date expiresAt "TTL: auto-delete after 1hr"
    }

    refreshtokens {
        ObjectId userId
        string tokenHash
        date expiresAt
        date revokedAt
    }
```

Also: `appversions` (managed via GitHub Releases API), `auditlogs` (action, userId, targetId, details, ipAddress).

## Data Flows

### Channel Management (Admin)

```mermaid
sequenceDiagram
    participant Admin
    participant API as Express API
    participant MW as Middleware
    participant DB as MongoDB

    Admin->>API: POST /admin/channels (X-Session-Id)
    API->>MW: Rate limit → CORS → Session validation
    MW-->>API: Session valid (Admin role)
    API->>DB: Mongoose validate & save
    DB-->>API: Document saved
    API-->>Admin: {success: true, data: {...}}
```

### App Update Check (Android)

```mermaid
sequenceDiagram
    participant App as Fire TV App
    participant API as Express API
    participant GH as GitHub Releases API

    App->>API: GET /app/version?currentVersion=1
    API->>GH: Fetch latest release
    GH-->>API: Release metadata + APK URL
    API-->>App: {updateAvailable, downloadUrl, isMandatory}
    App->>GH: Download APK directly from GitHub CDN
```

### TV Pairing (PIN-based)

See [TV_PAIRING_SYSTEM.md](./TV_PAIRING_SYSTEM.md) for full flow.

## Security

| Layer       | Measures                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------- |
| Network     | Firewall (UFW), ports 80/443 only                                                                                   |
| Transport   | TLS 1.2/1.3 (Let's Encrypt), HTTPS enforced                                                                         |
| Application | Session + JWT auth, rate limiting (1000/15min API, 20/15min auth), CORS, Helmet.js, SSRF protection in proxy routes |
| Data        | bcrypt password hashing (10 rounds), Mongoose schema validation, no direct external DB access                       |

## Deployment

```mermaid
graph LR
    Dev["Developer"] -->|"git push"| GHA["GitHub Actions"]
    GHA -->|"build & push"| GHCR["GHCR Images"]
    GHCR -->|"webhook"| Portainer
    Portainer -->|"deploy"| Server["Production Server"]

    subgraph Server
        Nginx2["Nginx (SSL)"] --> API2["API Container"]
        Nginx2 --> FE["Frontend Container"]
        API2 --> Mongo2[("MongoDB")]
        API2 --> Redis2[("Redis")]
        Sched["Scheduler Container"] --> Mongo2
    end
```

- **Dev:** `npm run dev` or `make up` — runs API (:3000), Frontend (:3001), MongoDB, Redis, MailHog
- **Prod:** Docker Compose with Nginx SSL termination
