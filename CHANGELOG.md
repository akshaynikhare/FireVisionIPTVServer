# Changelog

All notable changes to FireVision IPTV Server are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project uses [Semantic Versioning](https://semver.org/).

> Entries under **Unreleased** are updated automatically by CI when a new release tag is pushed.

---

## [1.3.1] - 2026-07-14

### Fixed

- container healthchecks use IPv4 loopback; bind Next.js standalone server to all interfaces
- point production `REDIS_URL` at the `firevision-redis` service; disable scheduler HTTP healthcheck

---

## [1.3.0] - 2026-07-14

### Added

- bound database growth with EPG cap, audit-log TTLs and lean indexes
- categorize, club and dedup channels at import; fix EXTINF titles
- cache channel serving, slim response payloads and cap list sizes
- add data-cleanup migrations (dry-run by default)
- expandable audit resource IDs and channel health stats in admin UI

### Fixed

- enforce channel cap atomically on all add paths; harden dedup remap
- enforce channel ownership boundary; scheduler exits on fatal errors
- external source status filter never matched alive or dead streams
- address review findings on cache staleness, cap races and migration safety

### Other

- record growth-prevention features and architecture decisions (ADRs)

---

## [1.2.1] - 2026-07-14

### Other

- wire `DEMO_CHANNEL_LIST_CODE` through prod compose and the deploy workflow

---

## [1.2.0] - 2026-07-14

### Added

- per-user channel ownership plus security & reliability hardening

### Other

- polish README for public discoverability; add screenshots and missing images
- refactor code structure for improved readability and maintainability

---

## [1.1.4] - 2026-04-06

### Added

- add build-time environment variables for the frontend Docker image

---

## [1.1.3] - 2026-04-06

### Added

- integrate Google reCAPTCHA for registration and enhance login error handling

### Other

- rename `SENTRY_DSN` to `BACKEND_SENTRY_DSN` for consistency across environments
- add how-to guide for adding channels to a playlist, with images and clearer instructions
- refactor code structure for improved readability and maintainability

---

## [1.1.2] - 2026-04-04

### Other

- refactor code structure for improved readability and maintainability

---

## [1.1.1] - 2026-04-04

### Added

- include user-owned channels in access-control queries

---

## [1.1.0] - 2026-04-04

### Added

- unify color palette across web and Android apps with new design tokens; add color palette reference
- implement alternate stream handling and promote-confirmation in the channel detail modal
- enhance channel flagging logic and alternate stream display
- add alternate-streams fields to channel updates and a diagnostic stats endpoint
- add QR code scanner component and integrate it into the device pairing flow
- implement user-based rate limiting and enhance mobile sidebar functionality (#35, #36)
- refactor registration page to use the AuthSidePanel component
- enhance layout and UI components for improved responsiveness and usability
- add SVG logo, icons, og-image, robots.txt and project description for branding and SEO
- add tests for IPTV-org grouped routes and stream metrics
- add FUNDING.yml for sponsorship information

### Fixed

- add type annotation for alternate streams in the channel schema

### Other

- add self-hosting guide for non-technical users and `docker-compose.selfhost.yml`

---

## [1.0.13] - 2026-03-30

### Added

- add Sentry error tracking and Codecov coverage reporting
- improve admin user assigned channels view with stats and richer table

### Fixed

- separate rate limiter for TV pairing status polling endpoint

### Other

- Apply suggestions from code review
- Fix list-related bugs: broken search filter, wrong stats display, and missing parseInt radix

## [1.0.12] - 2026-03-21

### Added

- enhance channel detail modal with alternate stream numbering
- implement alternate stream fallback and promotion logic for channels
- implement favorites syncing and display in channels page
- add proxy play tracking and metrics across the application
- enhance channel metrics tracking and update user dashboard with channel health stats
- add stream metrics system with dead/alive/unresponsive/play counters
- smart stream grouping, fallback, auto-promotion & bad stream flagging (#6)

### Fixed

- add proxy play count and last played/dead timestamps to channel metrics display
- enhance channel testing and reporting with improved axios configuration and error handling
- use atomic $inc for metrics in test endpoint and add metrics to Zod schema
- add .unref() to rate-limit cleanup timer to allow graceful shutdown
- resolve lint error in import-page-shell grouped mode toggle

## [1.0.11] - 2026-03-18

### Added

- feat(tv-auth): add dedicated TV code auth middleware, categories and favorites endpoints

### Fixed

- fix(auth): allow TV apps to authenticate using channel list code as session ID
- fix(deploy): fix env vars not reaching containers and admin credential migration

## [1.0.10] - 2026-03-18

### Fixed

- fix(deploy): fix env vars not reaching containers and admin credential migration

## [1.0.9] - 2026-03-18

### Fixed

- fix(deploy): use case-insensitive stack name lookup for Portainer

## [1.0.8] - 2026-03-18

### Added

- enhance docker-publish.yml with production deployment to Portainer

### Fixed

- fix(server): enable trust proxy in production for correct rate limiting
- fix(deploy): remove compose healthchecks to unblock Portainer stack creation
- fix(deploy): add external network check and improve stack deployment
- deployment pipeline improvements for Portainer stack creation
- fix(deploy): enhance production deployment configuration
- ensure frontend public directory is created before build

## [1.0.7] - 2026-03-18

### Added

- enhance Docker image build and deployment process with frontend support and health checks

## [1.0.6] - 2026-03-18

### Added

- enhance Portainer stack management with creation and update logic

## [1.0.5] - 2026-03-18

### Added

- update environment variables for GitHub OAuth and app configuration
- add Privacy Policy and Terms of Service pages
- enhance admin stats and session management
- enhance external source tab with optional top slot for custom content
- add charts, trends, and visualizations to Statistics page (#8)

### Changed

- replace image proxy byte-caching with validate + 302 redirect

### Other

- Unify admin and user pages into shared role-aware components (#7)

## [1.0.4] - 2026-03-17

### Added

- Refactor user and channel tables to use reusable DataTable component

### Changed

- update layout styles for authentication pages and improve overflow handling

## [1.0.3] - 2026-03-17

### Added

- User sources page and external source tab for channel management (Pluto TV, Samsung TV Plus)

## [1.0.2] - 2026-03-17

### Added

- Email verification flow with 24-hour token expiry and welcome email
- Next.js 14 frontend with App Router, Zustand, React Query, Tailwind CSS
- Stream player with persistent context, mini player, and HLS.js integration
- Quick Pick wizard for multi-source channel discovery (6-step flow)
- Scheduler microservice with liveness checks, EPG refresh, cache refresh
- External sources integration (Pluto TV and Samsung TV Plus)
- EPG service fetching XMLTV data from iptv-epg.org
- OAuth handling in login page
- App versions management page with version history and downloads
- IPTV channel import page for user dashboard
- Column filtering on user management page
- Debounced search hook across channels and recommendations pages
- Reusable DataTable, ColumnFilter, SelectionToolbar components
- Separate Dockerfiles for frontend (prod and dev)

### Changed

- Containerize Next.js frontend and remove old static UI
- Print service URLs and credentials after `make up`
- Consistent text sizing (xs) across typography styles
- Lazy loading on images in user profile and import pages
- Enhanced accessibility and UX across multiple components
- Enhanced statistics page with detailed stats endpoint

### Fixed

- Responsive design border class in AdminDashboard
- Docker publish workflow paths and trigger filters

### Removed

- Unused models, routes, and utilities for refresh tokens and legacy app version management

## [1.0.1] - 2025-11-28

### Added

- GitHub Actions workflow for building and publishing Docker image
- Device pairing functionality with setup guide
- JWT authentication and OAuth integration (Google, GitHub)
- User management module with CRUD operations and channel assignment
- IPTV-org JSON API integration with rich metadata
- Channel stream testing with batch support
- Stream proxy for CORS bypass with M3U8 rewriting
- Image proxy with 24-hour in-memory cache
- TV/device pairing via PIN and legacy channel list code
- Statistics dashboard (channels, users, sessions, devices, activity timeline)
- Health check endpoint
- Docker deployment with MongoDB, docker-compose

### Changed

- Refactored channel management and playlist references
- Refactored TV device pairing functionality
- Refactored code structure for improved readability

### Fixed

- Quick Filters and channel testing limits
- CSP and event listener issues blocking stream playback
- Helmet CSP to allow blob URLs for HLS.js

## [1.0.0] - 2025-11-01

### Added

- Initial release
- Express.js API server with MongoDB
- Channel management (CRUD, M3U import/export)
- User authentication with session-based auth
- Admin panel with AdminLTE UI
- Global M3U playlist generation with playlist code protection
- HLS video player with HLS.js
- Bcrypt password hashing
- Helmet security headers and CORS
- Gzip compression and Morgan logging

---

[Unreleased]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.3.1...HEAD
[1.3.1]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.1.4...v1.2.0
[1.1.4]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.1.3...v1.1.4
[1.1.3]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.1.2...v1.1.3
[1.1.2]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.13...v1.1.0
[1.0.13]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.12...v1.0.13
[1.0.12]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.11...v1.0.12
[1.0.11]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.10...v1.0.11
[1.0.10]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.9...v1.0.10
[1.0.9]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.8...v1.0.9
[1.0.8]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.7...v1.0.8
[1.0.7]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.6...v1.0.7
[1.0.6]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.5...v1.0.6
[1.0.5]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/1.0.2...v1.0.3
[1.0.2]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.1...1.0.2
[1.0.1]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/akshaynikhare/FireVisionIPTVServer/releases/tag/v1.0.0
