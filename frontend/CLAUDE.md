# CLAUDE.md — FireVision IPTV Frontend

> IPTV server admin panel and user dashboard. Next.js 14, TypeScript, Tailwind CSS.

## Architecture

| Layer         | Tech                                    | Details                                                 |
| ------------- | --------------------------------------- | ------------------------------------------------------- |
| Framework     | Next.js 14 (App Router)                 | `src/app/` with route groups `(auth)` and `(dashboard)` |
| Styling       | Tailwind CSS 3.4 + CSS variables        | HSL color tokens in `globals.css`, `2px` border radius  |
| State         | Zustand 5 + persist middleware          | `auth-store.ts` (user/tokens), `ui-store.ts` (sidebar)  |
| Data fetching | TanStack React Query 5                  | Wraps Axios calls, devtools in dev                      |
| HTTP          | Axios                                   | Configured in `lib/api.ts` with auth interceptors       |
| Icons         | Lucide React                            | Only icon library — never add another                   |
| Fonts         | Space Grotesk (display), Manrope (body) | Loaded via `next/font/google`                           |
| Theme         | next-themes                             | Light default, dark mode supported                      |

## Quick Start

```bash
npm install
npm run dev          # Next.js on port 3001
npm run lint         # ESLint
npm run test         # Jest
npm run build        # Production build
```

Backend must be running at `http://localhost:8009` (or set `NEXT_PUBLIC_API_URL`).

## API Proxy

All `/api/v1/*` requests are proxied to the backend via Next.js rewrites in `next.config.mjs`:

```
Frontend (port 3001) → /api/v1/* → Backend (port 8009) /api/v1/*
```

No CORS needed in development. In production, the standalone Next.js output serves both.

## Auth Flow

1. **Login**: User submits credentials → backend returns `user` + `sessionId` (or JWT tokens)
2. **Storage**: `useAuthStore` (Zustand + persist) stores user, sessionId, accessToken, refreshToken in memory + localStorage
3. **Requests**: Axios request interceptor attaches `Authorization: Bearer <token>` or `x-session-id` header automatically
4. **Protection**: `useRequireAuth(role?)` hook on every dashboard page — validates session with `GET /auth/me` on mount
5. **401 handling**: Axios response interceptor catches 401 → calls `logout()` → redirects to `/login`
6. **Role routing**: Admin users go to `/admin/*`, regular users to `/user/*`. Wrong role → redirect

Key files:

- `src/store/auth-store.ts` — Zustand store with persist
- `src/lib/api.ts` — Axios instance with interceptors
- `src/hooks/use-auth.ts` — `useRequireAuth` hook

## Route Structure

```
/(auth)
  login/          — Login page
  register/       — Registration page
  oauth-callback/ — OAuth redirect handler

/(dashboard)
  admin/          — Admin role required
    page.tsx      — Dashboard overview
    users/        — User management (list + detail)
    channels/     — Channel management
    devices/      — Device management
    import/       — IPTV import
    sources/      — Other sources
    epg/          — EPG guide
    versions/     — App version management
    stats/        — Statistics
    activity/     — Activity log
    settings/     — Settings
    quick-pick/   — Quick channel picker
  user/           — User role required
    page.tsx      — User dashboard
    channels/     — My channels
    devices/      — Pair device
    import/       — Import IPTV
    profile/      — My profile
    quick-pick/   — Quick channel picker
```

## Component Patterns

### Layout Components (`src/components/layout/`)

- **AppShell** — Sidebar + Header + main content wrapper. Used by admin and user layouts.
- **Sidebar** — Collapsible nav with role-based links. Uses `useUIStore` for collapse state.
- **Header** — Theme toggle, user info, logout.

### Reusable UI Components (`src/components/ui/`)

- **Modal** — Accessible dialog with backdrop, ESC key, focus management
- **ConfirmDialog** — Built on Modal. Destructive/default variants.
- **Pagination** — Prev/Next/Page buttons with ellipsis
- **ColumnFilter** — Dropdown multi-select with search, select all/clear

### Custom Hooks (`src/hooks/`)

- **useRequireAuth** — Auth guard + session validation + role routing
- **useDebouncedSearch** — Debounced input with immediate + delayed values
- **useToast** — Context-based toast (success/error/info, 3.5s auto-dismiss, pause on hover)

### Providers (`src/components/`)

- **ThemeProvider** — next-themes
- **QueryProvider** — React Query
- **ToastProvider** — Toast notification system
- **ErrorBoundary** — Crash handler
- **StreamPlayerProvider** — IPTV playback context

## CSS Variables & Theming

All colors use HSL format in `globals.css`. Key tokens:

| Token            | Light            | Dark             | Usage                           |
| ---------------- | ---------------- | ---------------- | ------------------------------- |
| `--primary`      | Orange (#B86F2D) | Golden (#E6A24E) | Buttons, accents, active states |
| `--background`   | Off-white        | Very dark gray   | Page background                 |
| `--foreground`   | Dark gray        | Light gray       | Text                            |
| `--border`       | Light gray       | Dark gray        | Borders, dividers               |
| `--signal-green` | Green            | Brighter green   | Active/success status           |
| `--signal-red`   | Red              | Brighter red     | Error/destructive               |
| `--sidebar-*`    | Beige tones      | Dark tones       | Sidebar-specific colors         |

Border radius is `2px` globally (`--radius: 2px`) — sharp, minimal corners.

## Types

Defined in `src/types/index.ts`:

- `User` — id, username, email, role, isActive, channelListCode, metadata
- `Channel` — channelId, name, url, logo, group, DRM info, metadata
- `AppVersion` — versionName, versionCode, apk info, release notes
- `TestResult` — channel test results with status, response time, manifest info

## Conventions

### Before modifying code

1. **Read first** — Always read the file before editing. Understand existing patterns.
2. **Search for precedent** — Before building a new page, check how `/admin/users` does it. Mirror the same data fetching, error handling, and layout patterns.
3. **Check types** — Use types from `src/types/index.ts`. Add new types there, not inline.

### When building new pages

1. Follow the existing pattern: server-side pagination, debounced search, column filters
2. Use `AbortController` for canceling in-flight requests on unmount
3. Wrap with ErrorBoundary
4. Handle loading, empty, and error states
5. Add responsive classes — hide non-essential columns on mobile

### Code style

- Uppercase labels with `tracking-[0.15em]` letter spacing
- `focus-visible:ring-2 focus-visible:ring-primary` on interactive elements
- Icon + text combinations for clarity
- Lucide icons at `h-4 w-4` for nav, `h-5 w-5` for page content
- `'use client'` directive on every component using hooks or browser APIs

### What NOT to do

- Don't add a second icon library
- Don't use Redux or React Context for global state — use Zustand
- Don't hardcode API URLs — always go through `lib/api.ts`
- Don't skip dark mode — test both themes before finishing
- Don't use inline styles — use Tailwind classes
- Don't add comments unless the logic isn't self-evident

## Workflow Best Practices

### Search before change

Before modifying any code, search the codebase for existing patterns. When adding a new admin page, the `/admin/users` page is the reference implementation — follow its data fetching, pagination, filtering, and error handling patterns exactly.

### Incremental development with validation

Build in small increments and validate each step:

1. Write component → render it → verify visually in both themes
2. Add API call → test with real backend data → handle errors
3. Never write 300+ lines without checking intermediate state

### API contract-first

When adding new features, define the expected API response shape first:

1. Document the endpoint, method, request/response shape
2. Add the type to `src/types/index.ts`
3. Build the API call in the page
4. Build the UI to consume it

### Error handling

- Use try-catch in all API calls
- Show toast notifications for user feedback (success/error)
- Use ErrorBoundary on every route
- Handle loading, empty, and error states in every list page

### Role-based UI density

- Admin pages: dense tables, bulk actions, advanced filters
- User pages: simpler layouts, focused on personal data
- Both: large enough touch targets for usability, responsive down to tablet
