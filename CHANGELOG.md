# Changelog

All notable changes to FireVision IPTV Server are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project uses [Semantic Versioning](https://semver.org/).

> Entries under **Unreleased** are updated automatically by CI when a new release tag is pushed.

---

## [Unreleased]

### Changed

- Update layout styles for authentication pages and improve overflow handling

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

[Unreleased]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.3...HEAD
[1.0.3]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/1.0.2...v1.0.3
[1.0.2]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.1...1.0.2
[1.0.1]: https://github.com/akshaynikhare/FireVisionIPTVServer/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/akshaynikhare/FireVisionIPTVServer/releases/tag/v1.0.0
