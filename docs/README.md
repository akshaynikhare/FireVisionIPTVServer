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

| Doc                                                     | Description                                       |
| ------------------------------------------------------- | ------------------------------------------------- |
| [TV_PAIRING_SYSTEM](TV_PAIRING_SYSTEM.md)               | PIN-based and code-based TV device pairing flows  |
| [CHANNEL_LIST_CODE_SYSTEM](CHANNEL_LIST_CODE_SYSTEM.md) | 6-char playlist code generation and usage         |
| [ADMIN_DASHBOARD](ADMIN_DASHBOARD.md)                   | Dashboard features, API examples, IPTV-org import |

## Design

| Doc                               | Description                                                      |
| --------------------------------- | ---------------------------------------------------------------- |
| [COLOR_PALETTE](COLOR_PALETTE.md) | Flame/Void/Parchment palette — CSS variables and Tailwind tokens |

## Decisions

| ADR                                               | Description                            |
| ------------------------------------------------- | -------------------------------------- |
| [ADR-001](decisions/001-unified-ui-components.md) | Unified role-aware UI components       |
| [ADR-002](decisions/002-unified-color-palette.md) | Unified color palette across platforms |
