# ADR-001: Unified Shared UI Components for Admin and User Views

## Status

Accepted

## Date

2026-03-17

## Context

The FireVision IPTV frontend has separate admin (`/admin/*`) and user (`/user/*`) route trees that evolved independently. This led to:

- Channel row rendering (logo + name + category + actions) duplicated across 6 files (~300 total lines)
- Bulk selection logic (`Set<string>` with toggle/selectAll/unselectAll) in 5 files (~200 lines)
- Status indicators (green/red/gray dots for liveness) inline in 5 files
- Image proxy + fallback logic (`proxyImageUrl` + `isSafeImageUrl`) in 8 locations
- The user import page showed 11,500+ channels in one scrollable list with no search, no pagination, and no filters -- while the admin import page had all of these features

The feature gap existed purely because the admin implementations were not reusable.

## Decision

Extract shared **primitives** (not monolithic components) that both admin and user views compose.

### New UI Components (`frontend/src/components/ui/`)

| Component          | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `StatusDot`        | Liveness/working status indicator (alive/dead/unknown/working/not-working) |
| `ChannelLogo`      | Image with `proxyImageUrl()` + `isSafeImageUrl()` fallback + placeholder   |
| `SearchInput`      | Styled search field with icon                                              |
| `SelectionToolbar` | Bulk select/deselect controls with counts                                  |

### New Hooks (`frontend/src/hooks/`)

| Hook                 | Purpose                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `useBulkSelection`   | `Set<string>` selection with toggleOne, selectMany, unselectMany, selectAll, unselectAll |
| `useClientSideTable` | Filter + sort + paginate pipeline (single `useMemo`)                                     |

### Composite Component (`frontend/src/components/`)

| Component            | Purpose                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `ChannelDetailModal` | Channel key-value detail view in Modal, configurable fields + actions |

### User View Upgrades

The user import page (`/user/import`) now has:

- Debounced search input
- Category column filter
- Pagination (50 per page)

The quick-pick recommendations step now uses the shared `Pagination` component instead of a custom implementation.

## Alternatives Considered

### Full shared DataTable component

Rejected. Admin/import, admin/sources, admin/channels, and user/import have different column layouts, actions, data sources, and API endpoints. A single DataTable would either be too rigid or require so many configuration props that it becomes harder to understand than the pages themselves.

### Keep admin and user completely separate

Rejected. The user import page was significantly degraded (no search, no pagination, no filters on 11,500+ channels). Maintaining two implementations doubles the bug surface and blocks feature parity.

### Use a third-party table library (TanStack Table, etc.)

Rejected. The project avoids new library dependencies. The tables are simple enough that custom hooks handle the logic.

## Consequences

### Positive

- User views gain search, pagination, and column filters
- ~600 lines of duplicated inline code replaced with shared components
- New features (e.g., adding liveness testing to user/import) become trivial
- Consistent visual language across admin and user views
- Easier onboarding: patterns in one place

### Negative

- Shared components become coupling points -- changes affect both admin and user views
- Mitigated by good prop design and keeping components focused on presentation

### Risks

- Over-abstracting: components become too generic and hard to use. Mitigated by extracting only what is duplicated today, not what "might be useful."
