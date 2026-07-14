# FireVision IPTV Server — Documentation

## Workflow

| Doc                                                  | Description                                          |
| ---------------------------------------------------- | ---------------------------------------------------- |
| [SETUP_GUIDE](workflow/SETUP_GUIDE.md)               | Local development setup, env vars, dev commands      |
| [SELF_HOSTING_GUIDE](workflow/SELF_HOSTING_GUIDE.md) | Self-host with Docker Compose, full config reference |
| [DEPLOYMENT_GUIDE](workflow/DEPLOYMENT_GUIDE.md)     | Production deployment — Nginx, SSL, systemd, backups |
| [OAUTH_SETUP](workflow/OAUTH_SETUP.md)               | Google and GitHub OAuth configuration                |

## Architecture & API

| Doc                                       | Description                                                       |
| ----------------------------------------- | ----------------------------------------------------------------- |
| [ARCHITECTURE](ARCHITECTURE.md)           | System overview, tech stack, database schema, deployment topology |
| [API_DOCUMENTATION](API_DOCUMENTATION.md) | Full REST API reference — all endpoints, request/response schemas |
| [FEATURE_LIST](FEATURE_LIST.md)           | Complete feature inventory                                        |

## Subsystems

| Doc                                                              | Description                                       |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| [TV_PAIRING_SYSTEM](workflow/TV_PAIRING_SYSTEM.md)               | PIN-based and code-based TV device pairing flows  |
| [CHANNEL_LIST_CODE_SYSTEM](workflow/CHANNEL_LIST_CODE_SYSTEM.md) | 6-char playlist code generation and usage         |
| [ADMIN_DASHBOARD](ADMIN_DASHBOARD.md)                            | Dashboard features, API examples, IPTV-org import |

## Design

| Doc                               | Description                                                      |
| --------------------------------- | ---------------------------------------------------------------- |
| [COLOR_PALETTE](COLOR_PALETTE.md) | Flame/Void/Parchment palette — CSS variables and Tailwind tokens |

## Decisions

| ADR                                                                | Description                                                     |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| [ADR-001](decisions/001-unified-ui-components.md)                  | Unified role-aware UI components                                |
| [ADR-002](decisions/002-unified-color-palette.md)                  | Unified color palette across platforms                          |
| [ADR-003](decisions/003-pairing-pin-rate-limiting.md)              | Pairing PIN rate limiting strategy                              |
| [ADR-004](decisions/004-no-account-lockout.md)                     | No account lockout after failed login attempts                  |
| [ADR-005](decisions/005-channel-ownership.md)                      | Per-user channel ownership (private imports vs shared catalog)  |
| [ADR-006](decisions/006-prevention-in-code-over-data-cleanup.md)   | Prevention in code over data cleanup                            |
| [ADR-007](decisions/007-route-level-channel-cap-and-allcatalog.md) | Route-level channel cap + allCatalog flag (no schema validator) |
