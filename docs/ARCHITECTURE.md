# FireVision IPTV Server - Architecture

## Overview

This document describes the architecture of the FireVision IPTV monorepo, which includes
an Express API backend, a Next.js frontend, a legacy jQuery/AdminLTE admin dashboard, and
shared TypeScript packages. The system serves an Android TV (Fire TV) application with
channel management, TV pairing, and over-the-air app updates via GitHub Releases.

## System Architecture Diagram

```
                    ┌──────────────────────┐
                    │  Android App         │
                    │  (Fire TV)           │
                    └──────────┬───────────┘
                               │  REST API
                               │  (Bearer JWT)
                               │
                    ┌──────────▼───────────┐        ┌────────────────────────┐
                    │                      │        │  GitHub Releases API   │
                    │    Nginx             │        │                        │
                    │    (Reverse Proxy)   │        │  - APK hosting         │
                    │    Port 80 / 443     │        │  - Version metadata    │
                    │                      │        │  - CDN distribution    │
                    └──────────┬───────────┘        └────────────▲───────────┘
                               │                                 │
          ┌────────────────────▼─────────────────────────────────┼──────────┐
          │                                                      │          │
          │              Express API Server (Port 3000)          │          │
          │                                                      │          │
          │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┤──────┐  │
          │  │ API Routes   │  │ Auth         │  │ App Version  │      │  │
          │  │              │  │ Middleware   │  │ Service      │      │  │
          │  │ /api/v1/*    │  │              │  │              │      │  │
          │  │ /tv/*        │  │ Session +    │  │ Fetches from │      │  │
          │  │ /health      │  │ JWT Auth     │  │ GitHub API ──┘      │  │
          │  └──────┬───────┘  └──────────────┘  └─────────────────────┘  │
          │         │                                                      │
          │  ┌──────▼──────────────────────────────────────────────────┐  │
          │  │  Static File Serving                                     │  │
          │  │  public/admin/  (Legacy Admin Dashboard - jQuery/AdminLTE)│  │
          │  │  public/user/   (Legacy User Dashboard)                  │  │
          │  └─────────────────────────────────────────────────────────┘  │
          │                                                                │
          └────────┬───────────────────────────┬───────────────────────────┘
                   │                           │
          ┌────────▼──────────┐       ┌────────▼──────────┐
          │  MongoDB 7.0      │       │  Redis 7-alpine   │
          │  Port 27017       │       │  Port 6379        │
          │                   │       │  (Optional)       │
          │  7 collections    │       │                   │
          │  - users          │       │  Graceful         │
          │  - channels       │       │  fallback if      │
          │  - sessions       │       │  unavailable      │
          │  - pairingrequests│       │                   │
          │  - refreshtokens  │       └───────────────────┘
          │  - appversions    │
          │  - auditlogs      │
          └───────────────────┘

                    ┌──────────────────────┐
                    │  Next.js Frontend    │
                    │  (Port 3001 dev)     │
                    │                      │
                    │  Connects to         │
                    │  Express API         │
                    │  on Port 3000        │
                    └──────────────────────┘
```

## Project Structure

```
FireVisionIPTVServer/
├── backend/                 Express API (TypeScript)
│   └── src/
│       ├── models/              Mongoose models (.ts) - 7 models
│       ├── routes/              API routes (.js, migrating to .ts) - 15 route files
│       ├── middleware/          Auth & validation (.ts)
│       ├── services/            Redis, cache (.ts)
│       └── utils/               JWT, init scripts (.ts)
├── frontend/                Next.js 14 App Router
│   └── src/
│       ├── app/                 Pages & layouts
│       ├── components/          UI & layout components
│       ├── lib/                 API client, utilities
│       ├── store/               Zustand state
│       └── hooks/               Custom hooks
├── packages/shared/         Shared TypeScript types & Zod schemas
├── public/                  Legacy admin/user dashboards (jQuery/AdminLTE)
│   ├── admin/                   Admin dashboard
│   └── user/                    User dashboard
├── e2e/                     Playwright E2E tests
├── .github/workflows/       CI/CD pipelines
│   ├── ci.yml                   Lint, typecheck, test, docker-build
│   └── docker-publish.yml       Build, Publish & Deploy
├── docker-compose.yml              Dev environment
├── docker-compose.production.yml   Production environment
└── Makefile                 Docker & dev shortcuts
```

## Technology Stack

### Backend

| Component     | Technology                                        |
| ------------- | ------------------------------------------------- |
| Runtime       | Node.js 18+                                       |
| Framework     | Express.js 4                                      |
| Language      | TypeScript                                        |
| Database      | MongoDB 7.0                                       |
| ODM           | Mongoose 8                                        |
| Cache         | Redis 7 (optional -- graceful fallback)           |
| Security      | Helmet.js, CORS, Rate Limiting, bcrypt            |
| Auth          | Session-based (X-Session-Id) + JWT (Bearer token) |
| Reverse Proxy | Nginx (production)                                |

### Frontend (New)

| Component    | Technology              |
| ------------ | ----------------------- |
| Framework    | Next.js 14 (App Router) |
| Styling      | Tailwind CSS            |
| Components   | Shadcn/ui               |
| Server State | TanStack Query          |
| Client State | Zustand                 |

### Infrastructure

| Component  | Technology                            |
| ---------- | ------------------------------------- |
| Container  | Docker + Docker Compose               |
| CI/CD      | GitHub Actions                        |
| Deployment | Portainer (automated via webhook)     |
| Testing    | Jest, Supertest, Playwright           |
| Linting    | ESLint, Prettier, Husky + lint-staged |
| Domain     | tv.cadnative.com                      |
| SSL        | Let's Encrypt                         |

## Database Schema

### 1. users Collection

```javascript
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String,                   // bcrypt hashed
  role: String,                       // "Admin" | "User"
  channelListCode: String,            // unique 6-char code
  isActive: Boolean,
  channels: [ObjectId],               // refs to Channel
  metadata: {
    deviceName: String,
    deviceModel: String,
    lastPairedDevice: String,
    pairedAt: Date
  },
  googleId: String,
  githubId: String,
  createdAt: Date,
  updatedAt: Date
}
```

### 2. channels Collection

```javascript
{
  _id: ObjectId,
  channelId: String,                  // indexed, unique
  channelName: String,                // text indexed
  channelUrl: String,
  channelImg: String,
  channelGroup: String,               // indexed
  channelDrmKey: String,
  channelDrmType: String,
  tvgName: String,
  tvgLogo: String,
  order: Number,
  metadata: {
    country: String,
    language: String,
    resolution: String,
    tags: [String],
    lastTested: Date,
    isWorking: Boolean,
    responseTime: Number
  },
  createdAt: Date,
  updatedAt: Date
}
```

### 3. sessions Collection

```javascript
{
  _id: ObjectId,
  sessionId: String,                  // unique
  userId: ObjectId,
  username: String,
  email: String,
  role: String,
  expiresAt: Date,                    // TTL index
  ipAddress: String,
  userAgent: String,
  lastActivity: Date
}
```

### 4. pairingrequests Collection

```javascript
{
  _id: ObjectId,
  pin: String,                        // 6-digit code
  deviceName: String,
  deviceModel: String,
  status: String,                     // "pending" | "completed" | "expired"
  userId: ObjectId,
  expiresAt: Date                     // TTL: auto-delete after 1hr
}
```

### 5. refreshtokens Collection

```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: String,
  expiresAt: Date,
  revokedAt: Date,
  userAgent: String,
  ipAddress: String
}
```

### 6. appversions Collection

```javascript
// Note: Versions now managed via GitHub Releases API, not stored locally
{
  _id: ObjectId,
  versionName: String,
  versionCode: Number,
  apkFileName: String,
  downloadUrl: String,
  releaseNotes: String,
  isActive: Boolean,
  isMandatory: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### 7. auditlogs Collection

```javascript
{
  _id: ObjectId,
  action: String,
  userId: ObjectId,
  targetId: ObjectId,
  targetType: String,
  details: Mixed,
  ipAddress: String,
  createdAt: Date
}
```

## Data Flow

### 1. Channel Management Flow (Admin)

```
┌──────────────────┐
│  Admin User      │
└────────┬─────────┘
         │
         ▼
┌───────────────────────────┐
│ POST /api/v1/admin/       │
│      channels             │
│ Header: X-Session-Id      │
│ Body: Channel Data        │
└───────┬───────────────────┘
        │
        ▼
┌───────────────────────────┐
│ Express Middleware         │
│ - Rate Limiting            │
│ - CORS Check               │
│ - Session Auth Validation  │
│   (X-Session-Id header)    │
└───────┬───────────────────┘
        │
        ├─── Valid Session ────┐
        │                      │
        │                      ▼
        │             ┌────────────────────┐
        │             │ Admin Route        │
        │             │ Handle Request     │
        │             └────────┬───────────┘
        │                      │
        │                      ▼
        │             ┌────────────────────┐
        │             │ Mongoose Model     │
        │             │ Validate & Save    │
        │             └────────┬───────────┘
        │                      │
        │                      ▼
        │             ┌────────────────────┐
        │             │ MongoDB            │
        │             │ Insert/Update Doc  │
        │             └────────┬───────────┘
        │                      │
        │                      ▼
        │             ┌────────────────────┐
        │             │ Return Success     │
        │             │ {success: true}    │
        │             └────────────────────┘
        │
        └─── Invalid/Expired ──┐
                               │
                               ▼
                      ┌────────────────────┐
                      │ Return 401         │
                      │ Unauthorized       │
                      └────────────────────┘
```

### 2. App Update Check Flow (Android App)

```
┌──────────────┐
│ Android App  │
│ (Fire TV)    │
└──────┬───────┘
       │
       ▼
┌────────────────────────────┐
│ GET /api/v1/app/version    │
│ ?currentVersion=1          │
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ Express API Server         │
│ - Receives request         │
│ - Calls GitHub Releases API│
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ GitHub Releases API        │
│ - Fetch latest release     │
│ - Get APK download URL     │
│ - Get version metadata     │
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────┐
│ Server Response:           │
│ {                          │
│   updateAvailable: true,   │
│   latestVersion: {         │
│     versionCode: 2,        │
│     downloadUrl: "https:   │
│       //github.com/...",   │
│     isMandatory: false     │
│   }                        │
│ }                          │
└────────────────────────────┘
```

### 3. TV Pairing Flow (PIN-based)

```
┌──────────────┐                                  ┌──────────────┐
│  Fire TV     │                                  │  User on Web │
│  Device      │                                  │  Dashboard   │
└──────┬───────┘                                  └──────┬───────┘
       │                                                  │
       │  1. POST /tv/pairing/request                     │
       │     {deviceName, deviceModel}                    │
       ▼                                                  │
┌────────────────────────────┐                            │
│ Server generates 6-digit   │                            │
│ PIN, stores PairingRequest │                            │
│ (expires in 1hr)           │                            │
└──────┬─────────────────────┘                            │
       │                                                  │
       ▼                                                  │
  TV displays PIN                                         │
  on screen           ───── User reads PIN ────>          │
                                                          │
                              2. POST /tv/pairing/confirm │
                                 {pin, channelListCode}   │
                                 Header: X-Session-Id     │
                                                          ▼
                                              ┌───────────────────────┐
                                              │ Server validates      │
                                              │ session + links user  │
                                              │ to pairing request    │
                                              └───────────┬───────────┘
                                                          │
       │                                                  │
       │  3. GET /tv/pairing/status/:pin                  │
       │     (TV polls periodically)                      │
       ▼                                                  │
┌────────────────────────────┐                            │
│ Server returns status:     │ <────────────────────────  │
│ completed + channelListCode│
└──────┬─────────────────────┘
       │
       ▼
  TV loads channels
  using channelListCode
```

## Security Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Security Layers                         │
├──────────────────────────────────────────────────────────┤
│ 1. Network Layer                                          │
│    - Firewall (UFW)                                       │
│    - Only ports 80, 443 exposed                           │
├──────────────────────────────────────────────────────────┤
│ 2. Transport Layer                                        │
│    - TLS 1.2/1.3 encryption (Let's Encrypt)               │
│    - HTTPS enforcement                                    │
├──────────────────────────────────────────────────────────┤
│ 3. Application Layer                                      │
│    - Session-based auth (X-Session-Id header)             │
│    - JWT auth (Bearer token for mobile clients)           │
│    - Rate limiting                                        │
│        API routes:  1000 req / 15 min                     │
│        Auth routes:   20 req / 15 min                     │
│    - CORS policy                                          │
│    - Helmet.js security headers                           │
│    - SSRF protection in proxy routes (blocks private IPs) │
│    - Input validation (Mongoose + Zod)                    │
├──────────────────────────────────────────────────────────┤
│ 4. Data Layer                                             │
│    - MongoDB authentication                               │
│    - Mongoose schema validation                           │
│    - bcrypt password hashing (10 salt rounds)             │
│    - No direct external DB access                         │
└──────────────────────────────────────────────────────────┘
```

## Deployment Architecture

### Development

```
Developer Machine
├── npm run dev               # Backend (port 3000) + Frontend (port 3001)
├── Docker Compose            # MongoDB + Redis containers
│   ├── MongoDB 7.0
│   └── Redis 7-alpine
└── Makefile shortcuts        # make dev, make test, make build, etc.
```

### Production

```
Cloud Server (Linux)
├── Docker Engine
│   ├── API Container (Node.js)
│   ├── MongoDB Container
│   └── Redis Container (optional)
├── Portainer (container management)
├── GitHub Actions (CI/CD)
│   ├── ci.yml                # lint, typecheck, test, docker-build
│   └── docker-publish.yml    # build, publish & deploy
└── Nginx (reverse proxy, SSL termination)
    ├── TLS via Let's Encrypt
    ├── Proxy pass to API container
    └── Domain: tv.cadnative.com
```

## Scaling Considerations

### Horizontal Scaling

```
┌─────────────┐
│ Load        │
│ Balancer    │
└──────┬──────┘
       │
       ├──────┬──────┬──────┐
       │      │      │      │
       ▼      ▼      ▼      ▼
    ┌───┐  ┌───┐  ┌───┐  ┌───┐
    │API│  │API│  │API│  │API│
    │ 1 │  │ 2 │  │ 3 │  │ 4 │
    └─┬─┘  └─┬─┘  └─┬─┘  └─┬─┘
      │      │      │      │
      └──────┴──────┴──────┘
             │
             ▼
      ┌──────────────┐
      │   MongoDB    │
      │ Replica Set  │
      └──────────────┘
```

### Caching Layer (Redis -- Implemented)

```
┌──────┐     ┌───────┐     ┌─────────┐     ┌──────────┐
│Client│────>│ Redis │────>│ Node.js │────>│ MongoDB  │
└──────┘     │ Cache │     │   API   │     │          │
             └───────┘     └─────────┘     └──────────┘
                 │
                 └─── Hot data (channels, sessions)
                      Graceful fallback if Redis unavailable
```

### CDN for APK Distribution (GitHub Releases)

```
┌──────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Android  │────>│ GitHub Releases  │────>│ GitHub CDN       │
│ App      │     │ API              │     │ (global edge)    │
└──────────┘     └──────────────────┘     └──────────────────┘
                     │
                     └─── APK downloads served via GitHub's
                          built-in CDN infrastructure
```

---

**Last Updated**: 2026-03-16
**Version**: 2.0.0
