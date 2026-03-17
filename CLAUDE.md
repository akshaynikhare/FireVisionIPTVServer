# CLAUDE.md — FireVision IPTV Server

> Monorepo for FireVision IPTV — a self-hosted IPTV channel management platform with admin panel, user dashboard, TV device pairing, and external source integration.

## Project Structure

```
├── backend/           — Express.js API server (Node 18, JavaScript + TypeScript)
│   └── src/
│       ├── server.js          — Main Express app entry point
│       ├── scheduler-entrypoint.ts — Separate scheduler microservice
│       ├── routes/            — API route handlers
│       ├── models/            — Mongoose models
│       ├── services/          — Business logic (scheduler, EPG, caching, email, etc.)
│       ├── middleware/        — Auth guards, validation, error handling
│       ├── utils/             — JWT helpers, shared utilities
│       ├── templates/         — Email HTML templates
│       └── __tests__/         — Backend tests
├── frontend/          — Next.js 14 App Router (TypeScript, Tailwind CSS)
│   └── CLAUDE.md      — Frontend-specific instructions (READ THIS for frontend work)
├── packages/shared/   — Shared types/utilities across workspaces
├── public/            — Legacy static admin/user UI (being replaced by frontend/)
├── docs/              — Feature list, API docs, architecture, deployment guides
│   └── decisions/     — ADRs (Architectural Decision Records)
├── e2e/               — Playwright end-to-end tests
├── scripts/           — Utility scripts
├── docker-compose.yml — Dev: API + frontend + scheduler + MongoDB + Redis + MailHog
└── docker-compose.production.yml — Prod deployment
```

## Quick Start

```bash
# Full stack dev (backend + frontend)
npm run dev

# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# Build all workspaces
npm run build

# Lint & typecheck
npm run lint:fix
npm run typecheck

# Tests
npm run test              # All tests
npm run test:backend      # Backend only
npm run test:frontend     # Frontend only
npm run test:e2e          # Playwright E2E

# Docker
make up                   # Dev environment
make up-prod              # Production
```

## Workspaces

This is an npm workspaces monorepo with three packages:

- `@firevision/backend` — Express API server
- `@firevision/frontend` — Next.js dashboard
- `@firevision/shared` — Shared types and utilities

Build order matters: `shared` → `backend` → `frontend`.

## Backend Architecture

| Layer     | Tech                   | Notes                                                               |
| --------- | ---------------------- | ------------------------------------------------------------------- |
| Runtime   | Node 18                | Express.js                                                          |
| Database  | MongoDB 7 + Mongoose   | Models in `backend/src/models/`                                     |
| Cache     | Redis (optional)       | App works without it; used for session/cache speed                  |
| Auth      | Session + JWT + OAuth2 | Session-based (primary), JWT (API clients), OAuth2 (Google, GitHub) |
| Email     | Nodemailer             | Brevo SMTP (prod) or MailHog (dev)                                  |
| Scheduler | Custom service         | Separate process for liveness checks, EPG, cache refresh            |

### Key Backend Files

- `server.js` — Express app setup, middleware, route mounting
- `scheduler-entrypoint.ts` — Standalone scheduler process
- `routes/` — One file per domain: `auth.js`, `channels.js`, `users.js`, `external-sources.js`, `scheduler.js`, etc.
- `models/` — Mongoose schemas: `User`, `Channel`, `Session`, `ScheduledTaskRun`, `EpgProgram`, etc.
- `services/` — Business logic: `scheduler-service.ts`, `epg-service.ts`, `email.ts`, `stream-prober.ts`, etc.
- `middleware/` — `requireAuth.ts` (session), `requireJwtAuth.ts` (JWT), `requireAdmin.ts` (role), `validate.ts`, `errorHandler.ts`

### API Conventions

- All routes under `/api/v1/`
- Auth: session-based (`x-session-id` header) or JWT (`Authorization: Bearer`)
- Admin routes use `requireAdmin` middleware
- Request validation via `validate.ts` middleware
- Errors go through centralized `errorHandler.ts`

## Frontend Architecture

See [frontend/CLAUDE.md](frontend/CLAUDE.md) for full details. Key points:

- Next.js 14 App Router with `(auth)` and `(dashboard)` route groups
- Zustand for state, React Query for data fetching, Axios for HTTP
- Tailwind CSS with HSL color tokens, 2px border radius
- Lucide React for icons — no other icon libraries
- Dark mode via next-themes

## Environment Variables

See `.env.example` for all configuration. Key groups:

- Core: `PORT`, `NODE_ENV`, `MONGODB_URI`, `REDIS_URL`
- Auth: `SUPER_ADMIN_*`, `JWT_*_SECRET`, `GOOGLE_*`, `GITHUB_*`
- Email: `MAIL_PROVIDER`, `BREVO_*`, `MAIL_FROM`, `APP_URL`
- Scheduler: `DISABLE_SCHEDULER`, `LIVENESS_CHECK_INTERVAL_MS`, `EPG_REFRESH_INTERVAL_MS`, `CACHE_REFRESH_INTERVAL_MS`

## Conventions

### Before writing code

1. **Read first** — Always read the file before editing
2. **Search for precedent** — Find the most similar existing implementation and mirror its patterns
3. **Check the frontend CLAUDE.md** — For any frontend work, follow `frontend/CLAUDE.md` strictly

### Code style

- Backend: JavaScript (routes, server) + TypeScript (models, services, middleware, utils)
- Frontend: TypeScript only
- Minimal comments — only when logic isn't self-evident
- No unnecessary abstractions or future-proofing

### What NOT to do

- Don't add new npm dependencies without asking
- Don't modify `docker-compose.yml` without asking
- Don't change auth middleware behavior without understanding the session/JWT/OAuth flow
- Don't skip reading `frontend/CLAUDE.md` when touching frontend code

## Documentation

After implementing a new feature, update `docs/FEATURE_LIST.md` with bullet points describing the feature. Match the existing style: `## Feature Name` header followed by behavioral bullet points.

Existing docs in `docs/`:

- `FEATURE_LIST.md` — Complete feature inventory
- `API_DOCUMENTATION.md` — API endpoint reference
- `ARCHITECTURE.md` — System architecture overview
- `DEPLOYMENT_GUIDE.md` — Deployment instructions
- `SETUP_GUIDE.md` — Local development setup
- `decisions/` — ADRs for significant architectural choices
