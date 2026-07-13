# ADR-005: Per-User Channel Ownership (Private Imports vs Shared Catalog)

## Status

Accepted

## Date

2026-07-12

## Context

Channels lived in a single global `channels` collection with **no owner field**. A `User` only held `channels: [ObjectId]` — a _selection_ of references into that shared pool. This conflated two very different things:

- the **admin-curated catalog** (imported from iptv-org / external sources), which users browse and pick from, and
- a user's **own imported channels** (their M3U / Xtream playlist).

Because both wrote to the same collection, several problems followed:

- **Credential leak.** When a user imported an M3U ([user-playlist.js](../../backend/src/routes/user-playlist.js)), new channels were inserted into the shared collection. Playlist URLs frequently embed subscription tokens/credentials, and those became readable by any Admin (`GET /admin/channels`) and servable by the public **demo** (which pairs to the super-admin's code and, being `role: 'Admin'`, saw the entire pool — ~61k channels).
- **Destructive catalog refresh.** Admin re-imports ran `Channel.deleteMany({})` (5 sites) — a full wipe. Once users owned channels, this would delete their data too.
- **Global `channelId` uniqueness** prevented two users from importing the same channel id independently.

## Decision

Add `ownerId` to the `Channel` model:

- `ownerId: null` → **shared catalog** (admin-managed; browsable; servable to the demo).
- `ownerId: <userId>` → **private** channel owned by that user (never shown to admins/demo).

Supporting changes:

- **Uniqueness** moves from global `channelId` to a compound unique index `{ ownerId, channelId }` — same id can exist once per owner (and once in the catalog).
- **Reads**: admin/demo/catalog paths (admin list & stats, `categories`, `tv.js`, `generateM3UPlaylist`, `User.generateUserPlaylist`, and the admin branches of `GET /channels`) scope to `ownerId: null`. User TV reads stay keyed on `User.channels` (unchanged) so no visibility is lost.
- **Writes**: user imports stamp `ownerId = user` and dedup per-owner; admin catalog creates default to `ownerId: null`; the 5 `deleteMany({})` wipes become `deleteMany({ ownerId: null })` and `$pull` only the deleted catalog ids from users (private refs survive).
- **Admin single-channel ops** (`PUT`/`DELETE /admin/channels/:id`) are guarded to `ownerId: null` so a hand-crafted request can't reach a private channel.
- **Migration** ([0001-channel-ownership.ts](../../backend/src/scripts/migrations/0001-channel-ownership.ts)): **Conservative** attribution — a legacy channel referenced by exactly one non-admin user and no admin becomes that user's private channel; everything else stays catalog. `User.channels` is never modified; the migration asserts every user's channel count is unchanged, and is a dry-run unless `--commit`.

## Alternatives Considered

- **Separate `UserChannel` collection** (join model). Cleaner separation, but a larger refactor of every read/write path and the migration; deferred.
- **Aggressive attribution (clone-per-user).** Fully privatizes every user-referenced channel by cloning shared docs. Closes the legacy leak completely but duplicates data and grows the collection. Rejected in favor of Conservative to minimize risk; can be re-run later if needed.
- **Leave as-is + cap only.** The interim Option B (demo decoupling + `TV_CHANNELS_MAX` cap) made the demo usable but did **not** close the credential leak — insufficient on its own.

## Consequences

- The credential leak is closed for all new imports; admins and the demo only ever see the catalog.
- Per-owner `channelId` uniqueness lets users import overlapping playlists independently.
- Admin catalog refreshes can no longer delete user-owned channels.
- **Legacy caveat**: under Conservative attribution, a channel that was imported by a user but is also shared/ambiguous stays in the catalog — so some pre-existing private URLs may remain until re-import. Aggressive attribution remains available if fuller closure is required.
- Requires a one-time migration (backup → dry-run → `--commit`) and a dedicated `DEMO_CHANNEL_LIST_CODE` demo user for the best demo experience.
