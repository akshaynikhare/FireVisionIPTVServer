# ADR-007: Route-Level Channel Cap + allCatalog Flag (No Schema Validator)

## Status

Accepted

## Date

2026-07-14

## Context

`users.channels[]` holds ObjectId references to catalog channels. Production data showed 128,618
total refs across 210 users — average 612, but one user held **19,898**. That outlier made the
non-admin channel sync build a ~280 KB `$in` query, run ~20k index point-lookups, and ship a
~14 MB JSON response to a low-end TV stick — exactly the failure mode `TV_CHANNELS_MAX` (2000)
already protected the admin path against. Nothing bounded how large a user's list could grow:
every import path (`user-playlist`, `iptv-org`, `external-sources`) appended without limit.

A user holding ~20k refs isn't curating a selection — they effectively want the whole catalog.

## Decision

Two mechanisms, both enforced in code rather than the schema:

1. **Route-level growth cap.** `capChannelAdditions(currentCount, ids)` (in
   `services/import-helpers.ts`, `USER_CHANNELS_MAX` default 5000) is applied at all five sites
   that add to `user.channels[]`. Additions beyond the cap are skipped and logged; existing
   over-limit users keep working.

2. **`allCatalog` flag on User.** Admin-settable via the existing `PUT /users/:id` whitelist.
   Flagged users are served the shared catalog query (`{ ownerId: null }`, capped at
   `TV_CHANNELS_MAX`, shared Redis-cached payload) instead of a giant `$in` over their refs.
   This is the intended migration path for the 19,898-ref account.

Additionally, every channel-list response (admin and user) is now bounded by `TV_CHANNELS_MAX`.

## Alternatives Considered

- **Mongoose array-length validator on `channels`** — rejected: validators run on any `save()`
  of a modified path, so the existing 19,898-ref user would fail validation even when _removing_
  channels or updating unrelated fields through a save. A schema rule can't distinguish growth
  from shrinkage.
- **Junction collection (user_channels)** — rejected at this scale: 210 users don't justify a
  join on the hottest read path; revisit only if user count grows ~10x.
- **Hard-trimming the outlier user's array** — rejected: it's a data mutation (see ADR-006) and
  silently loses a user's selection; `allCatalog` gives them strictly more instead.

## Consequences

- Worst-case sync drops from ~14 MB/20k-lookup to a cached, capped catalog payload
- No user's existing data is modified; over-limit accounts degrade gracefully (additions skipped,
  warning logged) instead of erroring
- The cap is advisory-silent to clients today (skipped count only logged server-side); surface it
  in the UI if users report "missing" imports
- `allCatalog` users share the admin catalog cache entry, so flipping the flag adds no query load
- A user at the cap who wants more channels needs an admin to either raise `USER_CHANNELS_MAX`
  or set `allCatalog` — a deliberate support touchpoint, not self-service
