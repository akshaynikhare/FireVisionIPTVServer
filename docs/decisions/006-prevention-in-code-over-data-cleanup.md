# ADR-006: Prevention in Code over Data Cleanup

## Status

Accepted

## Date

2026-07-14

## Context

A profiling pass over a restored production backup (413k docs, ~75 MB on-disk; see
`docs/DB_OPTIMIZATION_ANALYSIS.md`) found several classes of accumulated data problems:

- `epgprograms` was 82% of all storage because EPG ingest stored ~6 days of guide lookahead
- 70% of the catalog (44,305 channels) sat in `Uncategorized` — two bulk M3U imports carried no
  `group-title`, and the parser defaulted silently
- 81% of `auditlogs` rows were `test_channel`/`check_liveness*` noise, with no TTL despite the
  model claiming one; `scheduledtaskruns` had no TTL at all
- ~300 duplicate-URL channel rows and dead cache streams (iptv-org 52% dead) accumulated
  because imports and sweeps never deduped or pruned

The obvious fix was a set of one-off cleanup migrations (backfill categories, delete far-future
EPG rows, collapse duplicates). But every one of these problems would regrow, because the code
that generates the data was the root cause.

## Decision

Fix the **generation and serving paths only**; do not mutate existing data.

- EPG ingest drops programs beyond `EPG_MAX_LOOKAHEAD_HOURS` (default 48h) at parse time
- `audit()` early-returns for noisy liveness/test actions; retention declared as TTL (180d audit,
  30d task runs) and applied on deploy via `npm run migrate:sync-indexes -- --commit`
- Imports resolve a category from the iptv-org cache before defaulting to `Uncategorized`, club
  same-tvg-id streams into `alternateStreams`, and skip URLs already in the catalog
- An opt-in scheduler step prunes stale dead cache rows after each liveness sweep

Existing bad data is left in place: the far-future EPG backlog self-reaps through the existing
TTL as programs age out; legacy Uncategorized/duplicate rows persist harmlessly but stop growing.

## Alternatives Considered

- **Cleanup migrations + code fixes together** — rejected for this pass: mutating production data
  carries restore/rollback risk and hides whether the prevention actually works; the storage win
  was dominated by EPG, which self-heals within days once ingest is bounded.
- **Cleanup only, no code changes** — rejected outright: every problem regrows from the same
  ingest paths; the next backup would show the same profile.
- **Normalizing the catalog onto the iptv-org cache** — rejected in the analysis: measured overlap
  is only ~20%, the cache is volatile (half-dead, refresh-truncated), and it would put a join on
  the hottest read path.

## Consequences

- No production data was touched; all changes are reviewable code with unit tests (69/69 green)
- EPG storage converges to ~40% smaller steady-state without a delete ever running
- Legacy artifacts (44k Uncategorized, ~300 dup rows, one 19,898-ref user) remain visible until a
  future, separately-approved cleanup — reports on old data still reflect them
- If a cleanup is wanted later, it is now safe to write because re-imports can no longer recreate
  what it removes
