# FireVision IPTV Server — Feature List

Complete inventory of every feature in the application.

---

## Authentication

- Login with username or email and password
- 24-hour session expiry with automatic cleanup
- Session tracks IP address, user agent, and last activity timestamp
- Users can have multiple active sessions across devices
- View all active sessions with device/location info
- Revoke individual sessions remotely
- Force logout on all other devices when password is changed
- Cleanup expired sessions manually or via cron

## JWT Authentication

- Access token with 15-minute expiry
- Refresh token with 30-day expiry
- Token refresh without re-entering credentials
- Token revocation on logout
- Bearer token validation on protected routes

## OAuth2 Social Login

- Sign in with Google (OpenID, profile, email scopes)
- Sign in with GitHub (user profile and email scopes)
- Automatic account creation on first OAuth sign-in with random password
- Link OAuth provider to existing account if email matches
- Redirect back to app with session after OAuth completion

## User Registration

- Self-service registration with username, email, and password
- Username must be 3–50 characters, alphanumeric and underscore only
- Password minimum 6 characters (session auth) or 8 characters (JWT signup)
- Email format validation
- Username and email uniqueness enforcement
- Prevents registration with reserved super admin username
- Rate limiting on public signup: 10 per IP per hour (configurable)
- Automatic 6-character alphanumeric channel list code generated on signup

## User Profile

- Update username and email with uniqueness checks
- Change password with current password verification
- Upload profile picture (JPEG, PNG, GIF up to 5 MB)
- Delete profile picture
- Old profile picture automatically deleted when uploading new one
- Profile pictures stored on disk with user-specific filenames
- Regenerate channel list code on demand

## User Roles & Access Control

- Two roles: Admin and User
- Role-based middleware protecting admin-only routes
- Non-admin users can only view and edit their own profile
- Admin users have full access to all management features
- Account active/inactive status controlling login ability

## Admin User Management

- View all registered users with role and status info
- Create new users with specified role and credentials
- Update any user's username, email, password, role, or active status
- Deactivate user accounts (prevents login without deleting data)
- Reactivate previously deactivated accounts
- Delete users along with all their sessions
- Regenerate any user's channel list code

## Super Admin Initialization

- Automatic super admin creation on first server startup
- Configurable super admin username, password, email, and channel code via environment variables
- Default credentials provided if not configured
- Option to force-update admin password on startup
- Updates channel list code if environment variable changes

## Channel Management

- Create channels with name, URL, logo, group/category, and sort order
- Update and delete individual channels
- DRM support fields for protected streams (key and type)
- TVG metadata fields for M3U compatibility (tvg-name, tvg-logo)
- Channel metadata including country, language, resolution, and tags
- Duplicate channel ID prevention on creation
- Channels automatically sorted by group then order

## Channel Search & Filtering

- Search channels by name, group, or ID with case-insensitive matching
- Filter channels by group/category
- View all channels grouped by category
- Full-text search on channel names

## Channel Bulk Operations

- Import channels from M3U playlist content
- M3U parser extracts tvg-id, tvg-name, tvg-logo, group-title, channel name, and stream URL
- Option to clear all existing channels before import
- Bulk delete all channels at once

## Channel Details Preview

- Channel details modal showing metadata before deciding to play
- Displays channel logo, name, group/category, language, country, and stream URL
- Available on admin channels page (triggered by clicking a channel row)
- Available on IPTV-org page (triggered by info button)
- "Preview Stream" button in the details modal launches the channel player
- Direct play button also available on each row to skip the details modal
- User channels page has direct play button only (no details modal)

## Channel Player

- In-browser HLS video player using HLS.js library
- Plays channels directly from the admin and IPTV-org pages via modal popup
- Extra-large responsive modal with centered layout and black background
- Native HTML5 video controls: play/pause, seekbar, volume, fullscreen
- HLS.js with Web Worker support and low-latency mode enabled
- Adaptive bitrate streaming with automatic quality switching
- Buffering configuration: 30-second max buffer, 90-second back buffer
- Manifest loading with 10-second timeout and 3 retries
- Fragment loading with 20-second timeout and 3 retries
- Safari native HLS fallback when HLS.js is not supported
- Unsupported browser detection with user-friendly message
- Automatic stream proxying for external URLs to bypass CORS restrictions
- VLC user-agent spoofing on proxied requests to maximize source compatibility
- M3U8 playlist rewriting: relative URLs converted to absolute and routed through proxy
- Session-based authentication passed to proxy via header
- Live status indicators in player footer: loading, buffering, playing, paused, error
- Stream URL display with truncation and hover tooltip
- Loading spinner overlay with dark background during stream initialization
- Error overlay with descriptive messages for network, media, and decode errors
- Automatic error recovery: restarts loading on network errors, recovers on media errors
- Detailed error messages: aborted, network error, decode error, format not supported
- Full resource cleanup on player close: HLS instance destroyed, listeners removed, video buffer cleared
- DRM metadata fields available on channels (key and type) but not yet wired into playback
- No manual quality selector, subtitle support, or casting integration

## Channel Stream Testing

- Test individual channel stream availability
- Batch test multiple selected channels sequentially
- Test all channels with pagination (configurable batch size and offset)
- Session-based lock prevents concurrent test operations (5-minute auto-expiry)
- HTTP status validation (200–399 considered working)
- M3U8 manifest validation checking for proper HLS tags
- Extracts manifest info: live vs VOD, video presence, segment count
- Records test results: last tested timestamp, working status, response time
- Descriptive error messages for timeout, DNS failure, connection refused, and HTTP errors
- VLC user agent used for stream requests to maximize compatibility

## Stream Metrics

- Cumulative health counters per channel: deadCount, aliveCount, unresponsiveCount, playCount
- Timestamps for last occurrence of each status: lastDeadAt, lastAliveAt, lastPlayedAt, lastUnresponsiveAt
- Client-reported stream status via `POST /api/v1/channels/:id/report-status` (dead, alive, unresponsive)
- Client-reported playback confirmation via `POST /api/v1/channels/:id/report-play`
- Bulk health sync from scanner/client via `POST /api/v1/channels/health-sync` (up to 100 reports per call)
- In-memory rate limiting: 1 status report per channel per device per 5 minutes, 1 play report per channel per device per 1 minute, 1 health sync per device per 5 minutes
- Server-side probe results (channel test) automatically increment alive/dead counters
- Enhanced admin stream health analytics: most failing streams, most popular streams, removal candidates (high failures + zero plays), unresponsive streams
- Aggregate metrics in admin stats: total dead/alive/unresponsive/play counts across all channels
- Admin dashboard Stream Health summary card with alive/dead/unresponsive/play totals and proportional health bar
- Admin stats page shows detailed stream metric tables: Most Failing, Most Popular, Removal Candidates, Unresponsive streams
- Play count column in admin and user channel tables
- Channel detail modal shows full metrics (admin: all counts + timestamps, user: counts)
- User dashboard "My Channels" card shows working/failing breakdown with colored status dots
- Web player reports play events via `POST /channels/:id/report-play` on first playback per channel per session
- Proxy play tracking: `proxyPlayCount` metric records how many plays used the server proxy instead of direct stream
- Web player sends `proxyPlay: true` when stream fell back to proxy playback
- Android TV app sends `proxyPlay: true` when ExoPlayer switched to proxy after direct failures
- Admin dashboard and stats page show "Proxy Plays" alongside "Total Plays"
- Channel detail modal shows proxy play count for admin users

## Global M3U Playlist

- Generate M3U playlist of all channels in the system
- Protected by playlist code (query parameter or header)
- Accepted codes configured via environment variables
- Standard M3U format with EXTINF metadata tags

## TV/Device Pairing (PIN-Based)

- TV device requests a 6-digit numeric PIN
- PIN is unique among all active pending requests
- PIN expires after configurable duration (default 10 minutes)
- Expired PINs automatically cleaned up via database TTL index
- TV displays PIN and polls server for pairing status
- Authenticated web user confirms pairing by entering the PIN
- On confirmation, user's channel list code is linked to the device
- Device metadata (name, model) recorded on the user profile
- Pairing status endpoint returns pending, completed, or expired state
- Completed status includes the channel list code for playlist retrieval

## TV/Device Pairing (Legacy Code-Based)

- TV device pairs using the user's 6-character channel list code directly
- Code verification endpoint to check validity without pairing
- Device metadata updated on the user profile on legacy pairing
- No authentication required for TV-side endpoints

## TV Playlist Access

- Retrieve user's playlist in M3U format using channel list code
- Retrieve user's playlist in JSON format using channel list code
- Code must be exactly 6 uppercase alphanumeric characters
- User must be active for playlist retrieval to succeed
- Admin users get all channels; regular users get only their assigned channels
- Channels sorted by group then order in generated playlists
- Last login timestamp updated on each playlist retrieval

## User Playlist Management

- View list of personally assigned channels
- Replace entire channel assignment list at once
- Add channels to personal list (deduplicates automatically)
- Remove channels from personal list
- Download personal channel list as M3U file
- M3U file named with username for easy identification
- Admin users automatically have access to all channels regardless of assignment

## M3U Playlist Generation

- Standard M3U format with `#EXTM3U` header
- Playlist name tag with username
- Each channel includes tvg-id, tvg-name, tvg-logo, and group-title attributes
- Channel name as display title in EXTINF line
- Stream URL on the following line

## App Version Checking (GitHub-Based)

- Fetch latest release information from a configurable GitHub repository
- Match APK asset by configurable filename pattern
- Extract version code from release tag name
- Compare client version against latest available version
- Return whether an update is available
- Include release notes/changelog from GitHub release body
- Provide direct download URL to APK asset
- Support for mandatory update flag
- Minimum compatible version support
- Direct redirect to APK download URL

## App Version Management (Database-Based)

- Upload APK files to server storage
- Store version metadata: name, code, filename, file size, release notes
- Mark versions as active or inactive
- Set mandatory update flag per version
- Set minimum compatible version per version
- List all stored versions
- Update version metadata
- Delete versions with automatic file cleanup from disk

## Statistics — Channels

- Total channel count
- Active channel count (streams that passed last test)
- Inactive channel count (streams that failed last test)
- Channel count grouped by category

## Statistics — Users

- Total registered user count
- Active user count
- 10 most recently registered users

## Statistics — Sessions

- Total session count in database
- Active (non-expired) session count
- 20 most recent active sessions with IP and user agent
- Session count grouped by IP address/location

## Statistics — Device Pairing

- Total pairing request count
- Pending pairing count
- Completed pairing count
- Today's pairing count
- 10 most recent pairing requests

## Statistics — Activity Timeline

- Combined feed of recent logins, registrations, and device pairings
- Each entry has type, title, description, and timestamp
- 15 most recent events across all activity types
- Sorted by timestamp descending

## Statistics — Charts & Visualizations

- Donut/pie chart showing channel distribution by group
- Horizontal bar chart showing active sessions by location
- Activity timeline component with relative timestamps
- Trend line/area charts for user signups, sessions, and device pairings over time
- Selectable time ranges for trend charts (7 days, 30 days, 90 days)
- Backend aggregation endpoints (`GET /api/v1/admin/stats/trends/:type`) for daily time-series data
- Responsive layout working across desktop and tablet
- Light and dark theme support via CSS variable-based chart colors

## IPTV-Org Integration

- Fetch channel database from iptv-org public API
- Fetch stream URLs from iptv-org
- Fetch language reference data from iptv-org
- Fetch EPG guide data from iptv-org
- Fetch feed data from iptv-org
- In-memory cache with 1-hour TTL for all fetched data
- Cache status reporting per data type
- Manual cache clearing
- Enriched channel view merging streams with channel metadata and language names
- Comprehensive fetch endpoint with cross-referencing across all data sources
- Filter by country, category, language, and result limit
- Language code conversion between 2-letter and 3-letter formats
- Language priority resolution: feeds > guides > channel metadata
- Predefined playlist filters (India all, kids Hindi, news India, movies Hindi, sports India)
- Import iptv-org channels to system database with deduplication
- Import iptv-org channels directly to user's personal playlist
- Reuses existing channels if stream URL already exists in system

## Stream Proxy

- Proxy HLS/DASH streams through the server to avoid client CORS issues
- VLC user agent for upstream requests to maximize compatibility
- M3U8 manifest rewriting: converts all relative URLs to absolute
- M3U8 manifest rewriting: rewrites all URLs to route through proxy
- Binary media segments (.ts files) piped directly without rewriting
- 30-second timeout with up to 5 redirects
- CORS headers added to all proxied responses
- Upstream timeout returns 504, other errors return 502
- SSRF protection: validates URLs before fetching, blocks redirects to private/internal addresses

## TV Stream Proxy

- TV-code-authenticated stream proxy at `GET /api/v1/tv/stream/:code?url=<stream_url>`
- Mirrors full stream proxy behavior (HLS manifest rewriting, VLC user agent, SSRF protection) but authenticated via channel list code in URL path instead of session
- HLS manifest URLs rewritten to route through the TV proxy endpoint
- Android TV app uses this as fallback when direct stream playback fails
- Proxy fallback strategy: 3 direct retries with exponential backoff, then 2 proxy retries
- ErrorRecoveryManager switches ExoPlayer media source to proxy URL after exhausting direct attempts
- Proxy URL constructed from server URL + TV code + encoded stream URL

## Image Proxy

- Proxy channel logos and images through the server
- In-memory cache with 24-hour TTL per image
- Cache key based on MD5 hash of source URL
- Automatic cache cleanup every hour
- Returns 1x1 transparent PNG placeholder on fetch errors
- Error responses cached for 5 minutes to prevent repeated failed fetches
- Cache hit/miss indicated via X-Cache response header
- Cache statistics endpoint showing size, entries, and age
- Manual cache clearing

## Security — Headers & CORS

- Helmet.js security headers on all responses
- Content Security Policy restricting script, style, image, media, and frame sources
- CORS with configurable allowed origins (default: all)
- Credentials support in CORS
- Frame embedding blocked via CSP

## Security — Request Handling

- Gzip compression on responses
- JSON body parser with 50 MB limit
- URL-encoded body parser with 50 MB limit
- HTTP request logging via Morgan

## Security — Passwords

- Bcrypt hashing with 10 salt rounds
- Minimum password length enforcement
- Secure comparison via bcrypt.compare

## Health Check

- Server status (ok/error)
- Server uptime in seconds
- MongoDB connection status (connected/disconnected)
- Response timestamp
- Docker health check configured: every 30 seconds, 10-second timeout, 3 retries

## Email Verification & Welcome Emails

- Verification email sent to new users after signup with a unique token
- Verification token expires after 24 hours
- HTML email templates with personalization (username, verification link)
- Separate welcome email sent after successful verification
- Dedicated `/verify-email` page handles token validation and confirmation
- MailHog integration in development for email testing

## Scheduler System

- Dedicated scheduler microservice running as a separate process
- Three built-in scheduled tasks:
  - Channel Liveness Check: probes all cached streams for alive/dead status (default 24h interval)
  - EPG Guide Refresh: fetches electronic program guide data (default 6h interval)
  - IPTV-org Cache Refresh: updates channel cache from upstream (default 1h interval)
- Database-backed task tracking with full audit trail (status, trigger type, triggered by, start/end times, duration, results)
- Subtask tracking within each run for granular progress reporting
- Atomic concurrency guard via MongoDB unique partial index prevents duplicate running tasks
- Stale run recovery: tasks stuck in "running" for 4+ hours automatically marked as failed
- Manual trigger support from admin UI
- Admin scheduler page showing task list, next run times, last run status
- Run history page with pagination, filtering by task, and detailed run inspection

## External Sources (Pluto TV & Samsung TV Plus)

- Two free external streaming sources: Pluto TV (ad-supported) and Samsung TV Plus
- Region/country-based channel browsing with 2-letter country codes
- Pluto TV JWT session management with automatic token caching per region
- Channel liveness checking: individual stream probing with alive/dead/unknown status and response times
- Bulk liveness checks per source/region running in background
- Import selected channels to system database (admin only, up to 10k per import)
- Import selected channels to personal playlist (any user, up to 500, with deduplication)
- User and admin source browsing pages with filtering
- 1-hour cache TTL on external source channels with automatic background refresh
- Liveness stats display showing alive/dead/unknown counts per source/region

## EPG (Electronic Program Guide)

- Centralized EPG management fetching XMLTV format data from iptv-epg.org
- Multi-source EPG discovery automatically mapped to system channels
- Concurrent fetching of up to 5 EPG sources in parallel
- Batch upserts inserting programs in 500-item batches
- Startup detection: initial fetch on first run, staleness check (6h default) on subsequent runs
- Admin EPG page showing stats: total programs, channels with EPG, last/next refresh, sources discovered

## Next.js Frontend

- Full migration to Next.js 14 App Router with route groups (`(auth)`, `(dashboard)`)
- Zustand for global state management, React Query for server data fetching
- TypeScript throughout with strict type safety
- Tailwind CSS 3.4 with custom HSL color variables
- Lucide React icon library
- Dark mode support via next-themes
- Separate Dockerfiles for production (standalone output) and development (hot reload)
- API proxy: all `/api/v1/*` requests proxied through Next.js to backend

## Quick Pick Wizard

- 6-step guided wizard for discovering and adding channels:
  1. Choose sources (IPTV-org, Pluto TV, Samsung TV Plus)
  2. Select country per source
  3. Select languages
  4. Select categories
  5. Review recommendations with filtering
  6. Confirm selection and add to playlist
- Multi-source support: mix channels from different sources in one flow
- Step indicator showing progress through the wizard
- Available for both users and admins via separate routes
- Channel selection with checkboxes, count display, and bulk actions

## Unified Role-Aware Pages

- Channels, External Sources, and Import pages share a single component per page with a `mode` prop (`admin` | `user`)
- Admin mode: full CRUD, M3U import, Test All, bulk delete, server-side pagination, extended column filters (country, language)
- User mode: add from system pool, remove, M3U playlist URL copy, client-side sorting/filtering, Quick Pick link
- External Sources: admin sees liveness stats bar, batch liveness check, and replace-existing option; user sees simplified import to personal list
- Import IPTV: admin has liveness testing, batch check, replace existing, and raw data in detail modal; user has auto-select-all and import to personal list
- Follows the WizardShell pattern established by Quick Pick for role-based component sharing

## Stream Player

- Persistent player context maintaining playback across page navigations
- HLS.js integration for HLS/M3U8 stream playback
- Dual playback modes: proxy-only or direct-with-fallback-to-proxy
- Mini player mode: draggable minimized player that persists position
- Full-screen modal mode with ESC to close and body scroll blocking
- Stream swapping: switch between streams while keeping player open
- Error handling with meaningful messages for CORS, manifest, and timeout issues
- Lazy loaded via Suspense for performance

## Reusable UI Components

- Generic DataTable component with grid layout, sorting, responsive breakpoints, expandable rows, resizable columns
- ChannelDataTable: specialized table for channels with logo, name, and action buttons
- ColumnFilter: multi-select dropdown with search, select-all/clear buttons
- SelectionToolbar: shows filtered/total counts, selection count, page/all select controls
- useBulkSelection hook: Set-based selection state management (toggle, select/unselect many/all)
- useClientSideTable hook: memoized search, column filtering, sorting, and pagination
- useDebouncedSearch hook: 300ms debounce on search input to prevent excessive API calls
- SearchInput component with built-in debounce and clear button

## Docker Deployment

- Node 18 Alpine-based container image
- Non-root user (nodejs, UID 1001) for security
- Build dependencies for native Node modules (python3, make, g++)
- Persistent volumes for APK storage and user uploads
- MongoDB 7.0 service with localhost-only port binding
- MongoDB health check using mongosh ping
- API service depends on healthy MongoDB before starting
- Configurable via environment variables
- Nginx reverse proxy support
- Separate scheduler service container with own entrypoint
- Frontend container with multi-stage build for production (standalone) and dev (hot reload)
- Redis and MailHog services in development compose
- Mongo Express for database inspection in development
- Makefile targets: `make up-prod`, `make up`, log tailing, db management (reset/drop/shell)

## Configuration

- All behavior configurable via environment variables
- Server port, environment mode, and database URI
- Super admin credentials and channel list code
- OAuth client IDs and secrets for Google and GitHub
- JWT secrets and token lifetimes
- GitHub repository details for APK update checking
- APK storage path and max file size
- Pairing PIN expiry duration
- Signup rate limit threshold
- CORS allowed origins
- Server info endpoint reporting name, version, status, and enabled features
- Config defaults endpoint for client applications
