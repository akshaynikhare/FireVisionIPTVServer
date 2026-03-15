# Design Document: FireVision IPTV Server Modernization

## Overview

This design document outlines the modernization of the FireVision IPTV Server from a legacy jQuery/AdminLTE-based system to a modern, type-safe, performant application. The modernization follows a phased approach to minimize risk while delivering incremental value.

The system will be rebuilt using Next.js 14 with TypeScript for the frontend, maintaining Express.js with TypeScript for the backend API, and introducing Redis for caching and real-time features. The architecture emphasizes separation of concerns, testability, and developer experience while maintaining backward compatibility during the transition.

### Key Design Principles

1. **Incremental Migration**: Maintain backward compatibility while introducing new features
2. **Type Safety**: Use TypeScript throughout the stack to catch errors at compile time
3. **Performance First**: Implement caching, code splitting, and optimization from the start
4. **Security by Default**: Apply security best practices at every layer
5. **Developer Experience**: Provide excellent tooling, documentation, and testing infrastructure
6. **Accessibility**: Build WCAG 2.1 AA compliant interfaces from the ground up

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
├─────────────────────────────────────────────────────────────┤
│  Next.js 14 App (TypeScript)                                │
│  ├─ Marketing Landing Page (SSG)                            │
│  ├─ Admin Dashboard (CSR with auth)                         │
│  ├─ User Portal (CSR with auth)                             │
│  └─ Public API Docs (SSG)                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS / WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Nginx Reverse Proxy                                        │
│  ├─ SSL/TLS Termination                                     │
│  ├─ Rate Limiting (IP-based)                                │
│  ├─ Static Asset Serving (CDN)                              │
│  └─ WebSocket Upgrade Handling                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  Express.js API Server (TypeScript)                         │
│  ├─ /api/v1/* (Legacy endpoints - maintained)               │
│  ├─ /api/v2/* (New endpoints - modern patterns)             │
│  ├─ Authentication Middleware (JWT)                         │
│  ├─ Authorization Middleware (RBAC)                         │
│  ├─ Validation Middleware (Zod)                             │
│  ├─ Error Handling Middleware                               │
│  └─ Logging Middleware (Winston)                            │
│                                                              │
│  Socket.IO Server (Real-time)                               │
│  ├─ Channel Updates                                         │
│  ├─ User Presence                                            │
│  └─ System Notifications                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│    Caching Layer         │  │    Data Layer            │
├──────────────────────────┤  ├──────────────────────────┤
│  Redis 7.x               │  │  MongoDB 7.x             │
│  ├─ Session Store        │  │  ├─ Channels Collection  │
│  ├─ Cache Store          │  │  ├─ Users Collection     │
│  ├─ Rate Limit Store     │  │  ├─ Sessions Collection  │
│  └─ WebSocket Pub/Sub    │  │  ├─ AppVersions Coll.    │
└──────────────────────────┘  │  └─ Audit Logs Coll.     │
                              └──────────────────────────┘
```

### Technology Stack

**Frontend:**

- Next.js 14 (App Router)
- TypeScript 5.x (strict mode)
- Shadcn/ui (Radix UI + Tailwind CSS)
- TanStack Query (data fetching & caching)
- Zustand (global state management)
- Socket.IO Client (real-time updates)
- React Hook Form + Zod (form validation)
- Recharts (analytics visualization)

**Backend:**

- Node.js 20 LTS
- Express.js 4.x (TypeScript)
- Socket.IO 4.x (WebSocket server)
- Mongoose 8.x (MongoDB ODM)
- Redis 7.x (caching & sessions)
- Zod (runtime validation)
- Winston (structured logging)
- JWT (jsonwebtoken + refresh tokens)

**Development & Testing:**

- Vite (build tool for frontend)
- Jest (unit testing)
- Playwright (E2E testing)
- ESLint + Prettier (code quality)
- Husky (git hooks)
- GitHub Actions (CI/CD)

**Infrastructure:**

- Docker & Docker Compose
- Nginx (reverse proxy)
- Let's Encrypt (SSL certificates)
- MongoDB Atlas (optional cloud database)
- Redis Cloud (optional cloud cache)
- Portainer (container management & deployment)

## Components and Interfaces

### Frontend Components

#### 1. Layout Components

**AppShell**

```typescript
interface AppShellProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  theme: 'light' | 'dark';
}
```

Provides the main application layout with responsive sidebar, header, and content area.

**Sidebar**

```typescript
interface SidebarProps {
  items: NavigationItem[];
  collapsed: boolean;
  onToggle: () => void;
  userRole: 'super_admin' | 'admin' | 'user';
}

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType;
  href: string;
  badge?: number;
  requiredRole?: string[];
}
```

Collapsible navigation sidebar with role-based menu items.

**Header**

```typescript
interface HeaderProps {
  user: User;
  notifications: Notification[];
  onLogout: () => void;
  onThemeToggle: () => void;
}
```

Application header with user menu, notifications, and theme toggle.

#### 2. Channel Management Components

**ChannelList**

```typescript
interface ChannelListProps {
  channels: Channel[];
  loading: boolean;
  onEdit: (channel: Channel) => void;
  onDelete: (channelId: string) => void;
  onBulkAction: (action: BulkAction, channelIds: string[]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}
```

Virtualized list with infinite scroll, bulk selection, and actions.

**ChannelForm**

```typescript
interface ChannelFormProps {
  channel?: Channel;
  onSubmit: (data: ChannelFormData) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

interface ChannelFormData {
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelImg?: string;
  channelGroup: string;
  channelDrmKey?: string;
  channelDrmType?: 'widevine' | 'playready' | 'fairplay';
  isActive: boolean;
  tags?: string[];
}
```

Form with validation, image upload preview, and URL health check.

**ChannelFilters**

```typescript
interface ChannelFiltersProps {
  filters: ChannelFilters;
  onFilterChange: (filters: ChannelFilters) => void;
  groups: string[];
  tags: string[];
}

interface ChannelFilters {
  search: string;
  groups: string[];
  status: 'all' | 'active' | 'inactive';
  drmType: string[];
  tags: string[];
}
```

Advanced filtering panel with multi-select and search.

#### 3. Analytics Components

**DashboardStats**

```typescript
interface DashboardStatsProps {
  stats: SystemStats;
  loading: boolean;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

interface SystemStats {
  totalChannels: number;
  activeUsers: number;
  totalDownloads: number;
  apiRequests: number;
  trends: {
    channels: number;
    users: number;
    downloads: number;
  };
}
```

Dashboard overview with key metrics and trend indicators.

**ChannelViewsChart**

```typescript
interface ChannelViewsChartProps {
  data: ChartDataPoint[];
  loading: boolean;
  timeframe: 'day' | 'week' | 'month';
  onTimeframeChange: (timeframe: string) => void;
}

interface ChartDataPoint {
  timestamp: Date;
  views: number;
  uniqueUsers: number;
}
```

Interactive line chart showing channel views over time.

#### 4. User Management Components

**UserTable**

```typescript
interface UserTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  onRoleChange: (userId: string, role: UserRole) => void;
  onStatusChange: (userId: string, status: 'active' | 'suspended') => void;
}
```

Sortable, filterable table with inline actions.

**UserForm**

```typescript
interface UserFormProps {
  user?: User;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  mode: 'create' | 'edit';
}

interface UserFormData {
  username: string;
  email: string;
  password?: string;
  role: UserRole;
  isActive: boolean;
  profile?: {
    firstName: string;
    lastName: string;
    avatar?: string;
  };
}
```

User creation and editing form with role selection.

### Backend API Interfaces

#### 1. Authentication Service

```typescript
interface AuthService {
  register(data: RegisterDTO): Promise<AuthResponse>;
  login(credentials: LoginDTO): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<TokenPair>;
  logout(userId: string, refreshToken: string): Promise<void>;
  verifyToken(token: string): Promise<TokenPayload>;
  resetPassword(email: string): Promise<void>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
}

interface RegisterDTO {
  username: string;
  email: string;
  password: string;
  role?: 'user' | 'admin';
}

interface LoginDTO {
  username: string;
  password: string;
}

interface AuthResponse {
  user: UserDTO;
  tokens: TokenPair;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
}
```

#### 2. Channel Service

```typescript
interface ChannelService {
  findAll(filters: ChannelFilters, pagination: Pagination): Promise<PaginatedResponse<Channel>>;
  findById(id: string): Promise<Channel | null>;
  create(data: CreateChannelDTO): Promise<Channel>;
  update(id: string, data: UpdateChannelDTO): Promise<Channel>;
  delete(id: string): Promise<void>;
  bulkUpdate(ids: string[], data: Partial<UpdateChannelDTO>): Promise<number>;
  bulkDelete(ids: string[]): Promise<number>;
  importM3U(content: string, options: ImportOptions): Promise<ImportResult>;
  exportM3U(filters?: ChannelFilters): Promise<string>;
  checkHealth(channelId: string): Promise<HealthStatus>;
}

interface CreateChannelDTO {
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelImg?: string;
  channelGroup: string;
  channelDrmKey?: string;
  channelDrmType?: DRMType;
  isActive: boolean;
  tags?: string[];
}

interface UpdateChannelDTO extends Partial<CreateChannelDTO> {}

interface ImportOptions {
  clearExisting: boolean;
  skipDuplicates: boolean;
  defaultGroup?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
}

interface HealthStatus {
  channelId: string;
  status: 'online' | 'offline' | 'error';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}
```

#### 3. User Service

```typescript
interface UserService {
  findAll(filters: UserFilters, pagination: Pagination): Promise<PaginatedResponse<User>>;
  findById(id: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: CreateUserDTO): Promise<User>;
  update(id: string, data: UpdateUserDTO): Promise<User>;
  delete(id: string): Promise<void>;
  changeRole(id: string, role: UserRole): Promise<User>;
  suspend(id: string): Promise<User>;
  activate(id: string): Promise<User>;
  getActivityLog(id: string, pagination: Pagination): Promise<PaginatedResponse<ActivityLog>>;
}

interface CreateUserDTO {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  profile?: UserProfile;
}

interface UpdateUserDTO {
  email?: string;
  password?: string;
  role?: UserRole;
  profile?: Partial<UserProfile>;
  isActive?: boolean;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  avatar?: string;
  phone?: string;
}
```

#### 4. Cache Service

```typescript
interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<number>;
  exists(key: string): Promise<boolean>;
  increment(key: string, amount?: number): Promise<number>;
  decrement(key: string, amount?: number): Promise<number>;
  setExpiry(key: string, ttl: number): Promise<void>;
}

// Cache key patterns
const CACHE_KEYS = {
  CHANNELS_LIST: (filters: string) => `channels:list:${filters}`,
  CHANNEL_DETAIL: (id: string) => `channel:${id}`,
  USER_PROFILE: (id: string) => `user:${id}`,
  STATS_DASHBOARD: (range: string) => `stats:dashboard:${range}`,
  RATE_LIMIT: (ip: string, endpoint: string) => `ratelimit:${ip}:${endpoint}`,
} as const;
```

#### 6. APK Management Service

```typescript
interface APKManagementService {
  fetchReleases(): Promise<GitHubRelease[]>;
  getLatestRelease(): Promise<GitHubRelease | null>;
  getReleaseByVersion(version: string): Promise<GitHubRelease | null>;
  trackDownload(version: string): Promise<void>;
  getDownloadStats(version: string): Promise<DownloadStats>;
}

interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  body: string; // Release notes (markdown)
  publishedAt: Date;
  assets: GitHubAsset[];
  isMandatory: boolean; // Parsed from release notes
  minCompatibleVersion: number; // Parsed from release notes
}

interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  downloadUrl: string;
  contentType: string;
  downloadCount: number; // From GitHub API
}

interface DownloadStats {
  version: string;
  totalDownloads: number;
  githubDownloads: number;
  trackedDownloads: number;
  lastDownloadAt?: Date;
}

// APK Management via GitHub Releases
// Instead of uploading APKs to the server, we use GitHub Releases from FireVisionIPTV repo
// The server fetches release information via GitHub API and provides it to clients
// This eliminates the need for APK storage and upload functionality on the server
```

```typescript
interface WebSocketService {
  broadcastChannelUpdate(event: ChannelEvent): void;
  broadcastUserPresence(event: PresenceEvent): void;
  sendNotification(userId: string, notification: Notification): void;
  joinRoom(socketId: string, room: string): void;
  leaveRoom(socketId: string, room: string): void;
  getConnectedUsers(): Promise<string[]>;
}

interface ChannelEvent {
  type: 'created' | 'updated' | 'deleted';
  channel: Channel;
  timestamp: Date;
}

interface PresenceEvent {
  type: 'connected' | 'disconnected';
  userId: string;
  username: string;
  timestamp: Date;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}
```

#### 6. APK Management Service

```typescript
interface APKManagementService {
  fetchReleases(): Promise<GitHubRelease[]>;
  getLatestRelease(): Promise<GitHubRelease | null>;
  getReleaseByVersion(version: string): Promise<GitHubRelease | null>;
  checkForUpdates(currentVersion: number): Promise<UpdateCheckResult>;
  trackDownload(version: string, deviceId?: string): Promise<void>;
  getDownloadStats(version?: string): Promise<DownloadStats>;
}

interface GitHubRelease {
  id: number;
  tagName: string;
  name: string;
  body: string; // Release notes (markdown)
  publishedAt: Date;
  assets: GitHubAsset[];
  metadata: ReleaseMetadata;
}

interface GitHubAsset {
  id: number;
  name: string;
  size: number;
  downloadUrl: string;
  contentType: string;
  downloadCount: number; // From GitHub API
}

interface ReleaseMetadata {
  versionCode: number; // Extracted from tag (e.g., v1.2.3 -> 123)
  versionName: string; // Tag name without 'v' prefix
  isMandatory: boolean; // Parsed from release notes
  minCompatibleVersion: number; // Parsed from release notes
}

interface UpdateCheckResult {
  updateAvailable: boolean;
  isMandatory: boolean;
  latestVersion: {
    versionCode: number;
    versionName: string;
    downloadUrl: string;
    fileSize: number;
    releaseNotes: string;
  };
}

interface DownloadStats {
  version: string;
  githubDownloads: number; // From GitHub API
  trackedDownloads: number; // From our database
  totalDownloads: number; // Sum of both
  lastDownloadAt?: Date;
  downloadsByDate: { date: string; count: number }[];
}

// GitHub API Configuration
const GITHUB_CONFIG = {
  REPO_OWNER: process.env.GITHUB_REPO_OWNER || 'akshaynikhare',
  REPO_NAME: process.env.GITHUB_REPO_NAME || 'FireVisionIPTV',
  API_TOKEN: process.env.GITHUB_TOKEN,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
} as const;
```

## Data Models

### MongoDB Schemas

#### User Schema

```typescript
interface User {
  _id: ObjectId;
  username: string;
  email: string;
  passwordHash: string;
  role: 'super_admin' | 'admin' | 'user';
  isActive: boolean;
  profile: {
    firstName?: string;
    lastName?: string;
    avatar?: string;
    phone?: string;
  };
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
    twoFactorEnabled: boolean;
  };
  loginAttempts: number;
  lockedUntil?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
// - username: unique
// - email: unique
// - role: non-unique
// - isActive: non-unique
```

#### Channel Schema

```typescript
interface Channel {
  _id: ObjectId;
  channelId: string;
  channelName: string;
  channelUrl: string;
  channelImg?: string;
  channelGroup: string;
  channelDrmKey?: string;
  channelDrmType?: 'widevine' | 'playready' | 'fairplay';
  isActive: boolean;
  tags: string[];
  metadata: {
    viewCount: number;
    lastHealthCheck?: Date;
    healthStatus?: 'online' | 'offline' | 'error';
    responseTime?: number;
  };
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
// - channelId: unique
// - channelGroup: non-unique
// - isActive: non-unique
// - tags: array index
// - channelName: text index (for search)
```

#### Session Schema

```typescript
interface Session {
  _id: ObjectId;
  userId: ObjectId;
  refreshToken: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    platform?: string;
    browser?: string;
  };
  isValid: boolean;
  expiresAt: Date;
  createdAt: Date;
  lastUsed: Date;
}

// Indexes
// - userId: non-unique
// - refreshToken: unique
// - expiresAt: TTL index (auto-delete expired sessions)
```

#### AppVersion Schema

```typescript
interface AppVersion {
  _id: ObjectId;
  versionName: string;
  versionCode: number;
  apkFileName: string;
  apkFileSize: number;
  downloadUrl: string;
  releaseNotes: string;
  isMandatory: boolean;
  minCompatibleVersion: number;
  downloadCount: number;
  isActive: boolean;
  rolloutPercentage: number; // 0-100 for staged rollout
  uploadedBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Indexes
// - versionCode: unique
// - isActive: non-unique
// - createdAt: descending (for latest version queries)
```

#### AuditLog Schema

```typescript
interface AuditLog {
  _id: ObjectId;
  userId: ObjectId;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  ip: string;
  userAgent: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  timestamp: Date;
}

// Indexes
// - userId: non-unique
// - action: non-unique
// - resource: non-unique
// - timestamp: descending
// - compound: (userId, timestamp)
```

#### APKDownload Schema

```typescript
interface APKDownload {
  _id: ObjectId;
  version: string;
  versionCode: number;
  deviceId?: string;
  userId?: ObjectId;
  ip: string;
  userAgent: string;
  downloadedAt: Date;
}

// Indexes
// - version: non-unique
// - versionCode: non-unique
// - downloadedAt: descending
// - compound: (version, downloadedAt)
// - compound: (userId, downloadedAt) for user-specific stats
```

### Redis Data Structures

#### Cache Keys

```typescript
// Channel list cache (5 minutes TTL)
Key: `channels:list:${filterHash}`
Type: String (JSON)
Value: { channels: Channel[], total: number, timestamp: number }

// Individual channel cache (10 minutes TTL)
Key: `channel:${channelId}`
Type: String (JSON)
Value: Channel

// User profile cache (15 minutes TTL)
Key: `user:${userId}`
Type: String (JSON)
Value: User

// Dashboard stats cache (5 minutes TTL)
Key: `stats:dashboard:${dateRange}`
Type: String (JSON)
Value: SystemStats

// GitHub releases cache (5 minutes TTL)
Key: `github:releases:${repoOwner}:${repoName}`
Type: String (JSON)
Value: GitHubRelease[]

// Latest GitHub release cache (5 minutes TTL)
Key: `github:release:latest:${repoOwner}:${repoName}`
Type: String (JSON)
Value: GitHubRelease
```

#### Rate Limiting

```typescript
// IP-based rate limiting
Key: `ratelimit:${ip}:${endpoint}`
Type: String (counter)
Value: number of requests
TTL: 15 minutes

// User-based rate limiting
Key: `ratelimit:user:${userId}:${endpoint}`
Type: String (counter)
Value: number of requests
TTL: 15 minutes
```

#### Session Storage

```typescript
// Active sessions
Key: `session:${sessionId}`
Type: String (JSON)
Value: { userId, role, expiresAt }
TTL: matches JWT expiry
```

#### WebSocket Pub/Sub

```typescript
// Channel updates
Channel: `channel:updates`;
Message: {
  (type, channel, timestamp);
}

// User presence
Channel: `user:presence`;
Message: {
  (type, userId, username, timestamp);
}

// Notifications
Channel: `notifications:${userId}`;
Message: Notification;
```

## Deployment Architecture

### CI/CD Pipeline

The deployment process follows a two-stage approach: Build & Release, then Deploy.

```
┌─────────────────────────────────────────────────────────────────┐
│                     CI/CD Pipeline Flow                          │
└─────────────────────────────────────────────────────────────────┘

Stage 1: Build & Release (Automated on Git Tag)
┌──────────────┐
│ Git Tag Push │ (e.g., v1.2.3)
│  v*.*.*      │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│           GitHub Actions: docker-publish.yml                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Checkout code                                               │
│  2. Extract version from versions.json or git SHA              │
│  3. Build Docker image                                          │
│  4. Push to Docker Hub:                                         │
│     - username/firevision-iptv-server:version                   │
│     - username/firevision-iptv-server:latest                    │
│  5. Create GitHub Release with image tags                       │
└─────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Docker Hub Registry                                 │
│  - firevision-iptv-server:1.2.3                                 │
│  - firevision-iptv-server:latest                                │
└─────────────────────────────────────────────────────────────────┘


Stage 2: Deploy to Portainer (Manual Trigger)
┌──────────────────┐
│ Manual Trigger   │ (GitHub Actions UI)
│ workflow_dispatch│
└────────┬─────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│        GitHub Actions: deploy-portainer.yml                      │
├─────────────────────────────────────────────────────────────────┤
│  1. Fetch latest GitHub release                                 │
│  2. Extract Docker image tag from release                       │
│  3. Prepare production docker-compose file                      │
│  4. Authenticate with Portainer API                             │
│  5. Update Portainer stack "firevision-iptv-production"         │
│  6. Wait for deployment to complete                             │
│  7. Run health check against deployed service                   │
│  8. Report deployment status                                    │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Portainer Instance                              │
│  Stack: firevision-iptv-production                              │
│  ├─ API Container (Node.js)                                     │
│  ├─ MongoDB Container                                           │
│  ├─ Redis Container                                             │
│  └─ Nginx Container                                             │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│              Health Check Verification                           │
│  GET https://tv.cadnative.com/health                            │
│  Expected: { status: "ok", mongodb: "connected" }               │
└─────────────────────────────────────────────────────────────────┘
```

### GitHub Secrets Configuration

The following secrets must be configured in the GitHub repository:

**Docker Hub Secrets** (existing):

- `DOCKERHUB_USERNAME` - Docker Hub username
- `DOCKERHUB_TOKEN` - Docker Hub access token

**Portainer Deployment Secrets** (new):

- `PORTAINER_URL` - Portainer instance URL (e.g., https://portainer.example.com)
- `PORTAINER_API_TOKEN` - Portainer API authentication token
- `PORTAINER_STACK_ID` - Stack ID for firevision-iptv-production
- `PORTAINER_ENDPOINT_ID` - Portainer endpoint ID (usually 1 or 2)

**Application Secrets** (injected during deployment):

- `MONGODB_URI` - Production MongoDB connection string
- `REDIS_URL` - Production Redis connection string
- `JWT_SECRET` - Secret key for JWT token signing
- `JWT_REFRESH_SECRET` - Secret key for refresh token signing
- `API_KEY` - Admin API key for protected endpoints
- `OAUTH_GOOGLE_CLIENT_ID` - Google OAuth client ID
- `OAUTH_GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `OAUTH_GITHUB_CLIENT_ID` - GitHub OAuth client ID
- `OAUTH_GITHUB_CLIENT_SECRET` - GitHub OAuth client secret
- `GITHUB_TOKEN` - GitHub personal access token for accessing akshaynikhare/FireVisionIPTV releases
- `GITHUB_REPO_OWNER` - GitHub repository owner (default: "akshaynikhare")
- `GITHUB_REPO_NAME` - GitHub repository name (default: "FireVisionIPTV")
- `SMTP_HOST` - Email server host for notifications
- `SMTP_PORT` - Email server port
- `SMTP_USER` - Email server username
- `SMTP_PASSWORD` - Email server password

### APK Management via GitHub Releases

Instead of implementing a custom APK upload and storage system, the modernized server integrates with GitHub Releases from the FireVisionIPTV repository. This approach provides several benefits:

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│                  APK Management Flow                         │
└─────────────────────────────────────────────────────────────┘

Developer Workflow:
┌──────────────┐
│ Build APK    │ (FireVisionIPTV project)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Create       │
│ GitHub       │ (Tag: v1.2.3, attach APK file)
│ Release      │
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Releases (FireVisionIPTV)                │
│  Repository: akshaynikhare/FireVisionIPTV                   │
│  - v1.2.3: app-release.apk (15 MB)                          │
│  - v1.2.2: app-release.apk (14.8 MB)                        │
│  - v1.2.1: app-release.apk (14.5 MB)                        │
└─────────────────────────────────────────────────────────────┘
       │
       │ GitHub API
       ▼
┌─────────────────────────────────────────────────────────────┐
│         FireVisionIPTVServer (Backend API)                   │
├─────────────────────────────────────────────────────────────┤
│  APK Management Service:                                     │
│  1. Fetch releases via GitHub API                           │
│  2. Cache release data (5 min TTL)                          │
│  3. Parse version info and release notes                    │
│  4. Track download statistics                               │
│  5. Provide update check API                                │
└─────────────────────────────────────────────────────────────┘
       │
       │ REST API
       ▼
┌─────────────────────────────────────────────────────────────┐
│              Admin Panel / User Portal                       │
│  - View available releases                                   │
│  - See download statistics                                   │
│  - Open GitHub release page                                  │
│  - Check for updates                                         │
└─────────────────────────────────────────────────────────────┘
       │
       │ Direct download
       ▼
┌─────────────────────────────────────────────────────────────┐
│              Android App (Fire TV)                           │
│  - Check for updates via API                                 │
│  - Download APK from GitHub                                  │
│  - Install update                                            │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**

- No server storage required for APK files
- Leverage GitHub's CDN for fast downloads
- Built-in version control and release management
- Automatic download statistics from GitHub
- Easy rollback to previous versions
- Release notes and changelog management
- Reduced server maintenance and costs

**API Endpoints:**

```typescript
// Get all releases
GET /api/v2/app/releases
Response: GitHubRelease[]

// Get latest release
GET /api/v2/app/latest
Response: GitHubRelease

// Get specific version
GET /api/v2/app/version/:version
Response: GitHubRelease

// Check for updates (legacy endpoint)
GET /api/v1/app/version?currentVersion=1
Response: {
  updateAvailable: boolean,
  latestVersion: {
    versionCode: number,
    versionName: string,
    downloadUrl: string,
    releaseNotes: string,
    isMandatory: boolean
  }
}

// Track download
POST /api/v2/app/download/:version
Response: { success: boolean }
```

**Release Notes Format:**
To enable automatic parsing of mandatory updates and compatibility, release notes should follow this format:

```markdown
## What's New

- Feature 1
- Feature 2
- Bug fixes

## Metadata

- Mandatory: false
- Min Compatible Version: 1
```

The server parses the metadata section to determine update requirements.

### Production Docker Compose File

A separate `docker-compose.production.yml` file will be created with production-specific configurations:

```yaml
version: '3.8'

services:
  api:
    image: ${DOCKER_IMAGE}
    container_name: firevision-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      MONGODB_URI: ${MONGODB_URI}
      REDIS_URL: ${REDIS_URL}
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      API_KEY: ${API_KEY}
      OAUTH_GOOGLE_CLIENT_ID: ${OAUTH_GOOGLE_CLIENT_ID}
      OAUTH_GOOGLE_CLIENT_SECRET: ${OAUTH_GOOGLE_CLIENT_SECRET}
      OAUTH_GITHUB_CLIENT_ID: ${OAUTH_GITHUB_CLIENT_ID}
      OAUTH_GITHUB_CLIENT_SECRET: ${OAUTH_GITHUB_CLIENT_SECRET}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
    networks:
      - firevision-network
    depends_on:
      - mongodb
      - redis
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  mongodb:
    image: mongo:7
    container_name: firevision-mongodb
    restart: unless-stopped
    volumes:
      - mongodb_data:/data/db
    networks:
      - firevision-network
    healthcheck:
      test: ['CMD', 'mongosh', '--eval', "db.adminCommand('ping')"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: firevision-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    networks:
      - firevision-network
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    container_name: firevision-nginx
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./apks:/usr/share/nginx/html/apks:ro
    networks:
      - firevision-network
    depends_on:
      - api

networks:
  firevision-network:
    driver: bridge

volumes:
  mongodb_data:
  redis_data:
```

### Deployment Workflow Details

**Workflow File**: `.github/workflows/deploy-portainer.yml`

**Trigger**: Manual via `workflow_dispatch` with optional inputs:

- `version` (optional): Specific version to deploy (defaults to latest release)
- `environment` (optional): Target environment (defaults to production)

**Steps**:

1. **Fetch Release**: Get latest GitHub release or specified version
2. **Extract Image Tag**: Parse Docker image tag from release notes
3. **Prepare Stack File**: Substitute environment variables in docker-compose.production.yml
4. **Authenticate**: Login to Portainer API using token
5. **Update Stack**: Call Portainer API to update stack with new image
6. **Wait for Deployment**: Poll stack status until deployment completes
7. **Health Check**: Verify service health at https://tv.cadnative.com/health
8. **Report Status**: Comment on release with deployment status

**Error Handling**:

- Rollback to previous version if health check fails
- Notify via GitHub Actions annotations
- Preserve logs for debugging

**Deployment Verification**:

```bash
# Health check endpoint
GET https://tv.cadnative.com/health

# Expected response
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 10.5,
  "mongodb": "connected",
  "redis": "connected",
  "version": "1.2.3"
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

Before defining the correctness properties, I need to analyze the acceptance criteria from the requirements document to determine which are testable as properties, examples, or edge cases.
