# Plan: Smart Stream Grouping, Fallback & Auto-Selection (Issue #6)

## Problem

IPTV-org provides multiple stream URLs per logical channel (varying by quality, CDN, region). Currently each stream is stored as a separate `IptvOrgChannel` doc (compound unique: `channelId + streamUrl`) and imported as a separate `Channel` doc. This causes:

1. **Duplicate rows** in admin import UI — no grouping by logical channel
2. **Single URL per Channel** — no fallback when primary dies
3. **Static M3U playlists** — serve the stored URL even if dead
4. **No auto-recovery** — dead streams require manual admin intervention

## Solution Overview

Four phases, all server-side (Android app gets fallback data via existing API):

| Phase | What | Where |
|-------|------|-------|
| 1 | Grouped Import UI | Backend API + Frontend import page |
| 2 | `alternateStreams[]` on Channel model | Backend model + import logic |
| 3 | Fallback API for Android | Backend API endpoint |
| 4 | Auto-promotion scheduler | Backend scheduler task |

---

## Phase 1: Grouped Import UI (IPTV-org)

### 1a. Backend — Grouped streams endpoint

**File:** `backend/src/routes/iptv-org.js`

Add `GET /api/v1/iptv-org/api/grouped` endpoint:
- Query `IptvOrgChannel` collection
- Group by `channelId` using MongoDB `$group` aggregation
- For each group, collect all streams with their quality, liveness, responseTime
- Rank streams within each group: **alive > dead > unknown**, then **quality (1080p > 720p > 480p > SD)**, then **fastest responseTime**
- Return shape:
  ```json
  {
    "channels": [{
      "channelId": "IndiaToday.in",
      "channelName": "India Today",
      "tvgLogo": "...",
      "country": "IN",
      "categories": ["news"],
      "streamCount": 3,
      "bestStream": { "streamUrl": "...", "quality": "1080p", "liveness": {...} },
      "streams": [
        { "streamUrl": "...", "quality": "1080p", "liveness": {...}, "rank": 1 },
        { "streamUrl": "...", "quality": "720p", "liveness": {...}, "rank": 2 },
        { "streamUrl": "...", "quality": null, "liveness": {...}, "rank": 3 }
      ]
    }],
    "total": 1234
  }
  ```
- Support same filters as existing `/api/enriched`: country, language, category, status, search, limit, skip

**File:** `backend/src/services/iptv-org-cache.ts`

Add `getGroupedChannels(filters)` method:
- Use aggregation pipeline: `$match` (filters) → `$sort` (by ranking) → `$group` (by channelId) → `$project`
- Implement ranking logic as a computed score field in aggregation
- Return paginated results with total count

### 1b. Backend — Grouped import endpoint

**File:** `backend/src/routes/iptv-org.js`

Modify `POST /api/v1/iptv-org/import` (or add new `POST /api/v1/iptv-org/import-grouped`):
- Accept array of `{ channelId, selectedStreamUrl, alternateStreamUrls[] }` objects
- Create Channel docs with `channelUrl` = selected primary, `alternateStreams[]` = remaining
- Handle `replaceExisting` flag same as current

### 1c. Frontend — Grouped import page

**File:** `frontend/src/app/(dashboard)/admin/import/page.tsx`

Modify the IPTV-org import page:
- Switch data fetch from `/api/enriched` to `/api/grouped`
- Render one row per **logical channel** (not per stream)
- Show `streamCount` badge on each row
- **Expandable row** (click to expand): shows all streams for that channel, ranked, with liveness dots
- Best stream auto-selected (highlighted), admin can override by clicking a different stream
- Keep existing: checkbox selection, bulk liveness check, filters, pagination
- When importing, send the selected primary + all alternates

**New component:** `frontend/src/components/grouped-stream-row.tsx`
- Expandable/collapsible stream list within a table row
- Each stream shows: quality badge, liveness StatusDot, response time, radio button for primary selection
- Default selection = rank 1 (auto-selected best)

---

## Phase 2: Backend Storage — `alternateStreams[]`

### 2a. Channel model update

**File:** `backend/src/models/Channel.ts`

Add `alternateStreams` field to schema:
```typescript
alternateStreams: [{
  streamUrl: { type: String, required: true },
  quality: { type: String, default: null },       // '1080p', '720p', '480p', null
  liveness: {
    status: { type: String, enum: ['alive', 'dead', 'unknown'], default: 'unknown' },
    lastCheckedAt: { type: Date, default: null },
    responseTimeMs: { type: Number, default: null },
    error: { type: String, default: null }
  },
  userAgent: { type: String, default: null },
  referrer: { type: String, default: null },
  source: { type: String, default: null },         // 'iptv-org', 'manual', etc.
  promotedAt: { type: Date, default: null },       // when it was last promoted to primary
  demotedAt: { type: Date, default: null }         // when it was demoted from primary
}]
```

### 2b. Shared types update

**File:** `packages/shared/src/types/channel.types.ts`

Add `AlternateStream` interface and add `alternateStreams?: AlternateStream[]` to `IChannel`.

### 2c. Import logic update

**File:** `backend/src/routes/iptv-org.js`

Update the import handler to:
- Accept `alternateStreams` in the channel payload
- Store them on the Channel doc
- When importing from grouped view, the best stream → `channelUrl`, rest → `alternateStreams[]`

### 2d. Channel CRUD update

**File:** `backend/src/routes/channels.js`

- Allow `alternateStreams` in the field whitelist for POST/PUT
- Include `alternateStreams` in GET responses

### 2e. Admin channel detail UI

**File:** `frontend/src/components/channel-detail-modal.tsx`

- Show alternateStreams section in the detail modal
- Display each alternate with quality, liveness status, response time
- Allow admin to manually promote an alternate to primary (swap URLs)

---

## Phase 3: Android Fallback API

### 3a. Fallback-aware channel endpoint

**File:** `backend/src/routes/channels.js`

Add `GET /api/v1/channels/:id/with-fallbacks`:
- Returns channel with `alternateStreams` sorted by rank (alive first, then quality, then speed)
- The Android app can use this to get ordered fallback URLs

### 3b. User playlist with fallbacks

**File:** `backend/src/routes/user-playlist.js`

Add `GET /api/v1/user-playlist/me/channels-with-fallbacks`:
- Same as `GET /me/channels` but includes `alternateStreams` on each channel
- Android app fetches this on startup, caches locally
- When primary fails after retries, app tries alternates in order

### 3c. M3U playlist enhancement

**File:** `backend/src/models/Channel.ts`

Update `toM3U()` method:
- Add `#EXTVLCOPT:network-caching=1000` for better buffering
- No change to URL output — M3U format doesn't support fallbacks natively
- The `generateM3UPlaylist()` static method should prefer alive channels' URLs

Update `generateM3UPlaylist()`:
- Before generating, check if primary `channelUrl` has `metadata.isWorking === false` AND an alive alternate exists
- If so, use the best alive alternate's URL in the M3U output (runtime substitution, not stored)

---

## Phase 4: Playlist Health & Auto-Promotion

### 4a. Alternate stream liveness checking

**File:** `backend/src/services/stream-health-service.ts` (NEW)

Create `StreamHealthService` class:
- `async checkChannelHealth(channelId)`:
  - Probe primary `channelUrl`
  - If dead, probe all `alternateStreams` in parallel (concurrency-limited)
  - If an alive alternate found, promote it (swap with primary)
  - Update liveness on all streams
- `async runHealthCheck()`:
  - Query channels that have `alternateStreams.length > 0`
  - For each, check primary liveness
  - Only probe alternates if primary is dead (save resources)
  - Batch size: 200, concurrency: 10
  - Return stats: `{ checked, promoted, allDead }`
- Promotion logic:
  - Move current `channelUrl` to `alternateStreams[0]` with `demotedAt: new Date()`
  - Move best alive alternate to `channelUrl` with metadata update
  - Set `promotedAt` on the promoted stream
  - Log the swap for audit

### 4b. Register scheduler task

**File:** `backend/src/services/task-registry.ts`

Add `'stream-health-check'` task:
- Interval: `STREAM_HEALTH_CHECK_INTERVAL_MS` env var (default: 4 hours)
- Handler: calls `streamHealthService.runHealthCheck()`
- Runs AFTER the main liveness check (so liveness data is fresh)

### 4c. Scheduler entrypoint update

**File:** `backend/src/scheduler-entrypoint.ts`

Import and wire up the new stream health service.

### 4d. Environment variable

**File:** `.env.example`

Add `STREAM_HEALTH_CHECK_INTERVAL_MS=14400000` (4 hours default).

---

## Phase 5: Documentation & Cleanup

### 5a. Feature list update

**File:** `docs/FEATURE_LIST.md`

Add "Smart Stream Grouping & Auto-Fallback" section with behavioral bullets.

### 5b. API documentation update

**File:** `docs/API_DOCUMENTATION.md`

Document new/modified endpoints:
- `GET /api/v1/iptv-org/api/grouped`
- `POST /api/v1/iptv-org/import-grouped`
- `GET /api/v1/channels/:id/with-fallbacks`
- `GET /api/v1/user-playlist/me/channels-with-fallbacks`

---

## Implementation Order

1. **Phase 2a-2b** — Channel model + shared types (foundation)
2. **Phase 1a** — Grouped streams backend endpoint
3. **Phase 1b** — Grouped import backend endpoint
4. **Phase 2c-2d** — Import & CRUD logic updates
5. **Phase 1c** — Frontend grouped import UI
6. **Phase 2e** — Frontend channel detail with alternates
7. **Phase 3a-3c** — Fallback API + M3U enhancement
8. **Phase 4a-4d** — Stream health service + scheduler
9. **Phase 5** — Documentation

## Files Changed (Summary)

| File | Change |
|------|--------|
| `backend/src/models/Channel.ts` | Add `alternateStreams[]` field, update `toM3U()`, update `generateM3UPlaylist()` |
| `packages/shared/src/types/channel.types.ts` | Add `AlternateStream` interface |
| `backend/src/services/iptv-org-cache.ts` | Add `getGroupedChannels()` method |
| `backend/src/routes/iptv-org.js` | Add grouped endpoint, update import |
| `backend/src/routes/channels.js` | Add fallback endpoint, update CRUD whitelist |
| `backend/src/routes/user-playlist.js` | Add channels-with-fallbacks endpoint |
| `backend/src/services/stream-health-service.ts` | **NEW** — Health check + auto-promotion |
| `backend/src/services/task-registry.ts` | Register stream-health-check task |
| `backend/src/scheduler-entrypoint.ts` | Wire up health service |
| `frontend/src/app/(dashboard)/admin/import/page.tsx` | Grouped import UI |
| `frontend/src/components/grouped-stream-row.tsx` | **NEW** — Expandable stream list component |
| `frontend/src/components/channel-detail-modal.tsx` | Show alternateStreams |
| `frontend/src/types/index.ts` | Add AlternateStream type |
| `.env.example` | Add STREAM_HEALTH_CHECK_INTERVAL_MS |
| `docs/FEATURE_LIST.md` | Document feature |
| `docs/API_DOCUMENTATION.md` | Document endpoints |

## Ranking Algorithm

Score = `(livenessScore * 10000) + (qualityScore * 100) + speedScore`

- **livenessScore**: alive=2, unknown=1, dead=0
- **qualityScore**: 1080p=4, 720p=3, 480p=2, SD/null=1
- **speedScore**: `max(0, 100 - responseTimeMs/100)` (faster = higher, capped at 100)

Highest score wins. Ties broken by stream URL alphabetically (deterministic).
