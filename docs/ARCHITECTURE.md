# FireVision IPTV Server - Architecture

## Overview

This document describes the architecture of the FireVision IPTV backend server.

## Server Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SERVER LAYER                                   │
│                   Linux Cloud Server                                 │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Nginx (Reverse Proxy)                        │ │
│  │                       Port 80 / 443                             │ │
│  │                                                                  │ │
│  │  ┌─────────────┐  ┌────────────────┐  ┌──────────────────┐    │ │
│  │  │ SSL/TLS     │  │ Load Balancing │  │ Static File      │    │ │
│  │  │ Termination │  │ (if needed)    │  │ Serving (/apks/) │    │ │
│  │  └─────────────┘  └────────────────┘  └──────────────────┘    │ │
│  │                                                                  │ │
│  └────────────────────────┬─────────────────────────────────────────┘ │
│                           │                                           │
│  ┌────────────────────────▼─────────────────────────────────────────┐ │
│  │              Node.js API Server (Express)                         │ │
│  │                      Port 3000                                    │ │
│  │                                                                    │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │ │
│  │  │  Public Routes   │  │  Admin Routes    │  │  Middleware    │ │ │
│  │  │                  │  │                  │  │                │ │ │
│  │  │ /api/v1/channels │  │ /api/v1/admin/*  │  │ - CORS         │ │ │
│  │  │ /api/v1/app/*    │  │ - API Key Auth   │  │ - Rate Limit   │ │ │
│  │  │ /health          │  │ - Channel CRUD   │  │ - Compression  │ │ │
│  │  │                  │  │ - APK Upload     │  │ - Helmet       │ │ │
│  │  └──────────────────┘  └──────────────────┘  └────────────────┘ │ │
│  │                                                                    │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │                     Business Logic                            │ │ │
│  │  │                                                                │ │ │
│  │  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │ │ │
│  │  │  │ Channel Mgmt│  │ Version Mgmt │  │ M3U Import/Export    │ │ │ │
│  │  │  └─────────────┘  └──────────────┘  └──────────────────────┘ │ │ │
│  │  │                                                                │ │ │
│  │  └──────────────────────┬─────────────────────────────────────────┘ │ │
│  │                         │                                           │ │
│  └─────────────────────────┼───────────────────────────────────────────┘ │
│                            │                                             │
│  ┌─────────────────────────▼───────────────────────────────────────────┐ │
│  │                    Mongoose ODM Layer                                │ │
│  │                                                                       │ │
│  │  ┌────────────────┐          ┌────────────────────────────────┐    │ │
│  │  │ Channel Model  │          │ AppVersion Model               │    │ │
│  │  │                │          │                                │    │ │
│  │  │ - Schema       │          │ - Schema                       │    │ │
│  │  │ - Validation   │          │ - Validation                   │    │ │
│  │  │ - Methods      │          │ - Version Check Methods        │    │ │
│  │  └────────────────┘          └────────────────────────────────┘    │ │
│  │                                                                       │ │
│  └────────────────────────┬──────────────────────────────────────────────┘ │
│                           │                                              │
│  ┌────────────────────────▼──────────────────────────────────────────────┐ │
│  │                     MongoDB Database                                   │ │
│  │                        Port 27017                                      │ │
│  │                                                                         │ │
│  │  ┌─────────────────────┐          ┌──────────────────────────────┐   │ │
│  │  │ channels collection │          │ appversions collection       │   │ │
│  │  │                     │          │                              │   │ │
│  │  │ - channelId (idx)   │          │ - versionCode (idx)          │   │ │
│  │  │ - channelName       │          │ - versionName                │   │ │
│  │  │ - channelUrl        │          │ - downloadUrl                │   │ │
│  │  │ - channelGroup      │          │ - apkFileName                │   │ │
│  │  │ - isActive          │          │ - isMandatory                │   │ │
│  │  │ - ...               │          │ - ...                        │   │ │
│  │  └─────────────────────┘          └──────────────────────────────┘   │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                       File Storage Layer                                 │ │
│  │                                                                          │ │
│  │  ┌──────────────────────┐          ┌───────────────────────────────┐  │ │
│  │  │ /apks/               │          │ /uploads/                     │  │ │
│  │  │                      │          │                               │  │ │
│  │  │ - APK files          │          │ - Temporary uploads           │  │ │
│  │  │ - Version history    │          │ - Processing files            │  │ │
│  │  │ - Public access      │          │ - Private                     │  │ │
│  │  └──────────────────────┘          └───────────────────────────────┘  │ │
│  │                                                                          │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB 7.0
- **ODM**: Mongoose
- **Security**: Helmet.js, CORS, Rate Limiting
- **Reverse Proxy**: Nginx
- **Container**: Docker + Docker Compose

### Infrastructure
- **Cloud**: Linux VPS (Ubuntu 22.04)
- **Domain**: tv.cadnative.com
- **SSL**: Let's Encrypt (Certbot)
- **Deployment**: Docker Compose
- **Monitoring**: Health checks, logs

## Data Flow

### 1. Channel Management Flow

```
┌──────────────────┐
│  Admin User      │
└────────┬─────────┘
         │
         ▼
┌───────────────────────────┐
│ POST /api/v1/admin/       │
│      channels             │
│ Header: X-API-Key         │
│ Body: Channel Data        │
└───────┬───────────────────┘
        │
        ▼
┌───────────────────────────┐
│ Nginx Reverse Proxy       │
│ - SSL Termination         │
│ - Forward to Node.js      │
└───────┬───────────────────┘
        │
        ▼
┌───────────────────────────┐
│ Express Middleware        │
│ - Rate Limiting           │
│ - CORS Check              │
│ - API Key Validation      │
└───────┬───────────────────┘
        │
        ├─── Valid Key ──────┐
        │                    │
        │                    ▼
        │           ┌────────────────────┐
        │           │ Admin Route        │
        │           │ Handle Request     │
        │           └────────┬───────────┘
        │                    │
        │                    ▼
        │           ┌────────────────────┐
        │           │ Mongoose Model     │
        │           │ Validate & Save    │
        │           └────────┬───────────┘
        │                    │
        │                    ▼
        │           ┌────────────────────┐
        │           │ MongoDB            │
        │           │ Insert/Update Doc  │
        │           └────────┬───────────┘
        │                    │
        │                    ▼
        │           ┌────────────────────┐
        │           │ Return Success     │
        │           │ {success: true}    │
        │           └────────────────────┘
        │
        └─── Invalid Key ───┐
                            │
                            ▼
                   ┌────────────────────┐
                   │ Return 401         │
                   │ Unauthorized       │
                   └────────────────────┘
```

### 2. Version Check Flow

```
┌──────────────┐
│ Android App  │
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
│ Server Response:           │
│ {                          │
│   updateAvailable: true,   │
│   latestVersion: {         │
│     versionCode: 2,        │
│     downloadUrl: "...",    │
│     isMandatory: false     │
│   }                        │
│ }                          │
└────────────────────────────┘
```

## Database Schema

### channels Collection
```javascript
{
  _id: ObjectId,
  channelId: String (indexed, unique),
  channelName: String (text indexed),
  channelUrl: String,
  channelImg: String,
  channelGroup: String (indexed),
  channelDrmKey: String,
  channelDrmType: String,
  tvgName: String,
  tvgLogo: String,
  isActive: Boolean (indexed),
  order: Number,
  metadata: {
    country: String,
    language: String,
    resolution: String,
    tags: [String]
  },
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- channelId: 1 (unique)
- channelGroup: 1, order: 1
- channelName: text
- isActive: 1
```

### appversions Collection
```javascript
{
  _id: ObjectId,
  versionName: String (unique),
  versionCode: Number (indexed, unique),
  apkFileName: String,
  apkFileSize: Number,
  downloadUrl: String,
  releaseNotes: String,
  isActive: Boolean,
  isMandatory: Boolean,
  minCompatibleVersion: Number,
  releasedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- versionCode: -1 (descending)
- versionCode: -1, isActive: 1
```

## Security Architecture

```
┌────────────────────────────────────────┐
│         Security Layers                 │
├────────────────────────────────────────┤
│ 1. Network Layer                       │
│    - Firewall (UFW)                    │
│    - Only ports 80, 443 exposed        │
│    - DDoS protection (CloudFlare opt.) │
├────────────────────────────────────────┤
│ 2. Transport Layer                     │
│    - TLS 1.2/1.3 encryption            │
│    - SSL certificates (Let's Encrypt)  │
│    - HTTPS enforcement                 │
├────────────────────────────────────────┤
│ 3. Application Layer                   │
│    - API Key authentication            │
│    - Rate limiting (100 req/15min)     │
│    - CORS policy                       │
│    - Helmet.js security headers        │
│    - Input validation                  │
├────────────────────────────────────────┤
│ 4. Data Layer                          │
│    - MongoDB authentication            │
│    - No direct external access         │
│    - Mongoose schema validation        │
│    - Sanitized queries                 │
└────────────────────────────────────────┘
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

### Caching Layer (Future)
```
┌──────┐     ┌───────┐     ┌─────────┐     ┌──────────┐
│Client│────▶│ Redis │────▶│ Node.js │────▶│ MongoDB  │
└──────┘     │ Cache │     │   API   │     │          │
             └───────┘     └─────────┘     └──────────┘
                 │
                 └─── Hot data (channels, versions)
```

### CDN Integration (Future)
```
┌──────┐     ┌─────────┐     ┌──────────┐
│Client│────▶│   CDN   │────▶│ APK Files│
└──────┘     │CloudFlare│     │  Origin  │
             └─────────┘     └──────────┘
                 │
                 └─── Cached APKs for fast download
```

## Deployment Architecture

### Development
```
Developer Machine
├── VS Code (Server development)
├── Local MongoDB
└── Docker Desktop (Testing)
```

### Production
```
Cloud Server (Linux)
├── Docker Engine
│   ├── API Container (Node.js)
│   ├── MongoDB Container
│   └── Nginx Container
├── Volumes
│   ├── mongodb_data
│   ├── apk_storage
│   └── uploads
└── Systemd Service (auto-restart)
```

---

**Last Updated**: 2025-01-01
**Version**: 1.0.0
