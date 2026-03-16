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
