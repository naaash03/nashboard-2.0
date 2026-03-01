# FIX REPORT

## Changelog (2026-03-01)
- Widget category refactor:
  - `player_card` and `watchlist` moved to `UTILITIES` for metadata/category grouping.
  - Widget Library display label now shows `Misc` while internal category key remains `Utilities`.
- MLB widgets (live + fixture):
  - Added real MLB provider stack (`lib/providers/mlb/client.ts`, `teamMap.ts`, `provider.ts`) backed by MLB Stats API (`https://statsapi.mlb.com/api/v1`).
  - Added `MLB Next 7 Games` and `MLB Pitcher Arsenal` routes + UI widgets with persistent config, metadata footer, and report-bug bundle payloads.
  - Added MLB fixtures under `tests/fixtures/mlb/` and widget route tests under `tests/widgets/`.
- NBA widgets (live ESPN + fixture):
  - Added ESPN NBA provider (`lib/providers/espn/nba.ts`) using scoreboard + standings endpoints.
  - Added `NBA Tonight's Slate` and `NBA Standings Snapshot` routes + UI widgets with persistent config and standardized envelope metadata.
  - Added NBA fixtures under `tests/fixtures/espn/nba/` and route tests under `tests/widgets/`.
- Fixture mode usage:
  - Set `NASHBOARD_DATA_MODE=fixture` to force fixture responses.
  - Run all tests with `npm test`.
- Player directory + sport switcher (NFL/MLB/NBA):
  - Added unified ESPN player provider and APIs:
    - `GET /api/players/search?sport=nfl|mlb|nba&q=...&dataMode=live|fixture`
    - `GET /api/players/profile?sport=nfl|mlb|nba&playerId=...&dataMode=live|fixture`
  - Both routes now return standardized envelopes:
    - success: `{ data, meta, error?: undefined }`
    - error: `{ data: null, meta, error: { message, code } }`
  - Added fixture payloads under `tests/fixtures/espn/players/` for NFL/MLB/NBA search + profile.
  - `Player Card` now supports sport tabs and persists `config.sportKey` + selected player per sport.
  - `Watchlist` now supports `Teams` and `Players` modes; players mode includes sport tabs and persists `config.playerWatchlist` (`nfl`/`mlb`/`nba`, limit 10 per sport).
- Misc widgets hardening (layout + watchlist status):
  - Added shared `TabsRow` and standardized tab spacing in `Player Card` and `Watchlist` to prevent cramped/jumbled rows in small widget widths.
  - `Watchlist` Teams mode now has league tabs (`NFL/MLB/NBA`) and per-sport persistence via:
    - `config.teamWatchlist = { nfl: string[], mlb: string[], nba: string[] }`
    - Backward-compatible migration: legacy `config.watchlist.teams` is treated as NFL and copied into `teamWatchlist.nfl` on load.
  - Added ESPN team status provider + routes:
    - `GET /api/teams/status?sport=nfl|mlb|nba&teamKey=...&dataMode=live|fixture`
    - `GET /api/teams/status/batch?sport=nfl|mlb|nba&teamKeys=NYM,LAD,...&dataMode=live|fixture`
  - Teams mode now uses the batch endpoint for one-call status hydration and shows `LIVE`, `Today`, `Final`, or `No game today` per team row.
  - Added scoreboard fixtures for deterministic status responses in fixture mode:
    - `tests/fixtures/espn/scoreboard/mlb_scoreboard_sample.json`
    - `tests/fixtures/espn/scoreboard/nba_scoreboard_sample.json`

## What Changed
- Guest watchlist correctness:
  - Added `lib/guest/watchlist.ts` session-only store with add/remove/load and max-5 enforcement.
  - Reworked `WatchlistWidget` to split guest vs server architecture:
    - guest path never calls `/api/watchlist`
    - server path used only when signed-in + auth configured + DB configured
    - widget footer source now reports `Source Guest` in guest mode.
- Global fixture mode consistency:
  - Added request resolver in `lib/config/env.ts` with precedence:
    1) query `dataMode`
    2) cookie `nashboard_dataMode`
    3) env `NASHBOARD_DATA_MODE`
    4) default `live`
  - Dashboard now writes `nashboard_dataMode` cookie (`Path=/; SameSite=Lax`) whenever mode changes.
  - Health and widget routes now consume resolved mode so direct `/api/health/data?probe=1` reflects cookie-selected fixture mode.
- LAN dev-origin warning fix:
  - Updated `next.config.ts` `allowedDevOrigins` with:
    - `localhost:3000`
    - `127.0.0.1:3000`
    - `192.168.220.1:3000`
- Data visibility + diagnostics upgrades:
  - Added explicit `dataMode=live|fixture` plumbing across widget APIs and frontend calls.
  - Added persisted `Dev Fixture Data` toggle (session in guest mode; server preference in signed-in mode via `/api/preferences/data-mode`).
  - Upgraded ESPN client metadata and endpoint observability (endpoint URL, upstream status/message, source mode, cache diagnostics).
  - Upgraded Data Health endpoint/widget:
    - separate statuses for DB (`configured`/`unconfigured`), ESPN (`ok`/`error`/`timeout`/`blocked`/`empty`), Fixture (`enabled`/`disabled`)
    - endpoint-level last success/error snapshots
    - cache hit/miss and non-negative cache age
    - `Test ESPN now` probe button
  - Added per-widget debug drawers (collapsed) showing endpoint, meta, and last error.
  - Removed silent demo fallback behavior from core widget routes.
  - Improved offseason behavior:
    - Tonight's Slate includes next-slate fallback and historical recent-slate section for visible context.
    - Player search now returns diagnostic warnings when ESPN returns empty.
    - RB vs D-Line now returns a structured offseason empty-state object and recent RB leader when available.
- Runtime usability fixes (no DB/auth required):
  - Added centralized env helpers in `lib/config/env.ts` (`isDbConfigured`, `isAuthConfigured`, `appBaseUrl`, `missingAuthVars`).
  - Added client-only guest dashboard store in `lib/guest/guestDashboard.ts` using `sessionStorage`.
  - Reworked `DashboardPage` to select mode safely:
    - forced guest mode when auth is not fully configured
    - guest mode for signed-out users
    - DB-backed mode for signed-in users only
  - Guest mode no longer calls DB dashboard routes and supports add/remove/move/lock/reset/refresh end-to-end.
  - Added explicit DB warning banner without blocking guest flow.
- Auth hardening and UX:
  - `AppProviders` now conditionally disables `SessionProvider` when auth is unavailable.
  - `TopBarAuth` disables Google sign-in when auth is unavailable and shows clear guidance.
  - `/api/auth/[...nextauth]` now returns `501` JSON with missing env hints when auth is unavailable.
  - Added friendly `/api/auth/error` page with missing var diagnostics and LAN URL guidance.
- LAN setup documentation:
  - Updated `.env.example` with `NEXTAUTH_*` and `GOOGLE_*`.
  - Added `docs/LOCAL_SETUP.md` with guest-only mode, DB setup, and LAN Google OAuth callback/origin instructions.
- Build hardening for missing `DATABASE_URL`:
  - Prisma usage in API routes now uses dynamic imports inside handlers: `const { prisma } = await import("@/lib/db/prisma")`.
  - Added explicit `DATABASE_URL` guards in all Prisma-backed API routes to return `500` JSON errors without touching Prisma when env is missing.
  - Added `lib/db/prisma.ts` as canonical Prisma entry; `lib/prisma.ts` now re-exports for compatibility.
  - Updated `auth.ts` to avoid database-session adapter initialization when `DATABASE_URL` is absent (falls back to JWT session strategy), allowing build-time import safety.
- Lint hardening:
  - Removed explicit `any` usages in dashboard, data health widget, and fixture tests.
  - Rewrote widget effects (`PlayerCard`, `RB vs D-Line`, `Tonight's Slate`, `Watchlist`) to async IIFE + cancellation guards with correct dependencies.
  - Fixed unescaped apostrophe in `TonightsSlateWidget`.
- Replaced legacy cookie auth with Google Sign-In via NextAuth + Prisma adapter.
- Implemented per-user dashboard model (single dashboard, blank default, private by default).
- Added share-token view-only support and invited-email scaffolding fields/logic.
- Added guest mode behavior (session-only frontend storage with sign-in CTA).
- Replaced demo-first widget flows with ESPN provider + fixture/live modes and cache-first fallback.
- Added canonical provider types and beginner/advanced templates:
  - `lib/providers/types.ts`
  - `lib/templates/tonightsSlate.ts`
  - `lib/templates/playerCard.ts`
  - `lib/templates/rbVsDline.ts`
- Implemented ESPN NFL provider/client:
  - timeout 8s, retry 2, in-memory TTL, persistent cache table, fixture mode.
- Reworked APIs:
  - `/api/widgets/tonights-slate`
  - `/api/search/players`
  - `/api/widgets/player-card`
  - `/api/widgets/rb-vs-dline`
  - `/api/health/data`
- Added persistence models and logic for watchlist (NFL teams only, max 5), favorites, glossary, cached responses.
- Rebuilt dashboard UI around fixed 4-column responsive grid, lock toggle, reset, refresh-all + auto refresh and hidden-tab pause.
- Added widget library modal by sport and utilities category.
- Added per-widget Beginner/Advanced mode switch and metadata footer (`Updated ... · Source ...`).
- Added report-bug modal with copyable diagnostic bundle.
- Added MLB scaffolding widgets (`MLB Next 7 Games`, `Pitcher Arsenal`) and provider stubs with placeholder UI.

## Fixture Mode
- Set `NASHBOARD_DATA_MODE=fixture` to force provider reads from `tests/fixtures/espn/nfl/*.json`.
- Scenario control via `NASHBOARD_FIXTURE_SCENARIO`:
  - `slate_empty_today`
  - `next_season_not_posted`
  - default

## Run Tests
- Install dependencies: `npm install`
- Generate Prisma client: `npx prisma generate`
- Run tests: `npm run test`

## Caching Approach
- In-memory TTL cache in `lib/providers/espn/client.ts` for fast repeat hits.
- Persistent DB cache in `CachedResponse` keyed by `provider + endpoint + paramsHash`.
- On ESPN upstream failure, return last cached payload with warning (cache-first behavior).
- Demo payloads are blocked unless explicitly requested with `allowDemo=1`.

## Beginner/Advanced Templates
- Templates only change presentation depth and context; canonical truth remains unchanged.
- Beginner always includes simple fields, tooltip language, and why-it-matters context.
- Advanced adds expanded stats/context and learn-more links.

## MLB Scaffolding Plan
- Current state: widget plumbing + persistence + placeholders implemented.
- Next integration: free MLB data provider mapped to same canonical + template pipeline.

## Decision Checklist
- [x] Google auth with NextAuth + Prisma adapter
- [x] Private dashboards by default
- [x] Share-link view-only MVP
- [x] Invited-email sharing scaffolding in DB + placeholder logic
- [x] Guest mode session-only reset
- [x] New users start with blank dashboard
- [x] Single dashboard title `<UserName>'s Dashboard`
- [x] Fixed 4-column responsive grid
- [x] Dark mode default
- [x] Lock layout toggle
- [x] Reset dashboard to blank
- [x] Refresh all + 60s auto refresh + 5s rate limit + hidden-tab pause
- [x] Updated/source footer in widgets
- [x] 12-hour time display and lbs player weight
- [x] Add Widget modal with NFL/MLB/NBA/Utilities
- [x] Data Health widget in Utilities
- [x] Per-widget Beginner/Advanced switch (default Beginner)
- [x] Watchlist teams-only NFL, max 5 cap
- [x] Favorite Player action (separate from watchlist)
- [x] Player Card choose-from-results UX (3+ chars, debounce, Enter, <=8, headshot/team logo)
- [x] Player Card API ID-only
- [x] Duplicate same-player widget prevention
- [x] Tonight's Slate offseason-safe next-slate behavior and schedule-not-posted message
- [x] Broadcaster + game type + records included when available
- [x] RB vs D-Line team-driven expected RB + required rushing/run-defense stats + disclaimer
- [x] Cache-first fallback on ESPN failure
- [x] No silent demo data without `allowDemo=1`
- [x] Report a Bug bundle with copy-to-clipboard
- [x] Canonical types and template files
- [x] ESPN fixture-mode support
- [x] Prisma models for auth/dashboard/widgets/watchlist/favorites/glossary/cache
- [x] Glossary term model and route scaffold
- [x] Data health endpoint
- [x] Vitest fixture-mode tests for required offseason/stability cases
- [x] MLB scaffolding widget slots + provider stub


