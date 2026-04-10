# NashBoard 2.0 Handoff Summary

Audit date: 2026-04-09

## What NashBoard 2.0 Is

NashBoard 2.0 is a customizable sports analytics dashboard aimed at everyday fans who need advanced data explained clearly. The active root app already supports:

- persisted dashboard widgets for signed-in users
- guest/session-only mode when DB/auth are unavailable
- explicit `BEGINNER` and `ADVANCED` widget modes
- shared player/team search, profile, insights, and status APIs
- live, auto-fallback, and fixture data modes

In practical repo terms, it is an advanced prototype with strong production-minded infrastructure, but it is not fully converged yet.

## What Is Built Today

Core systems that are clearly present in the active root app:

- Next.js app shell centered on `components/dashboard/DashboardPage.tsx`
- Prisma/Postgres persistence for dashboards, widget instances, watchlist teams, favorite players, cached responses, and glossary terms
- NextAuth-based auth with optional Google OAuth and a local dev-admin path
- hybrid provider router in `lib/providers/index.ts` using API-Sports, ESPN, MLB Stats API, and fixtures
- health/diagnostics routes for data and origin debugging

Current widget picture:

- Exposed and apparently usable: `tonights_slate`, `player_card`, `watchlist`, `rb_vs_dline`, `mlb_next_7_games`, `mlb_pitcher_arsenal`, `mlb-starting-pitcher-matchup`, `mlb-series-tracker`, `nba_tonights_slate`, `nba_standings`, `data_health`
- Implemented but not exposed by the current root registry: `mlb_season_stats`, `mlb_platoon_advantage`, `mlb_recent_form`, `mlb_bullpen_fatigue`, `mlb_run_expectancy`
- Backend groundwork only: `mlb-recent-results`

MLB is the deepest current vertical. Player Card and Watchlist are the most important shared cross-sport widgets.

## Architecture In One Pass

The practical path is:

1. Widget metadata is defined in `lib/widgets/registry.ts`.
2. `DashboardPage` renders widget instances via a hardcoded `WIDGET_COMPONENTS` map.
3. Widgets call either shared APIs (`app/api/players/*`, `app/api/teams/*`) or widget-specific routes (`app/api/widgets/*`).
4. Routes call providers/resolvers in `lib/providers/*` and `lib/sports/*`.
5. Providers normalize data, annotate source/fallback metadata, and sometimes expose canonical `contract` payloads.
6. Signed-in persistence uses Prisma; guest persistence uses `sessionStorage`.

Important architectural strengths:

- canonical sports data layer exists
- fallback/fixture behavior is deliberate
- diagnostics and health visibility are first-class
- beginner vs advanced mode is implemented, not just implied

Important architectural gaps:

- not all routes follow the canonical contract pattern yet
- the widget registry does not match the full implementation surface
- some persistence APIs are still MVP/NFL-only even though the UI is now multi-sport

## Biggest Risks / Truths A New Engineer Should Know

- Treat the repo root as the active app. The nested `nashboard-2.0/` copy contains extra systems, including stat glossary/ranking work, but those are not active in the root app.
- The root app does not currently have a full live stat explainer/ranking system. It only has minimal glossary plumbing (`app/api/glossary/route.ts` plus the `GlossaryTerm` model).
- `DashboardPage` still creates persisted widgets with a hardcoded root sport of `NFL`, even though MLB/NBA widgets now exist.
- Signed-in watchlist/favorites persistence is narrower than the UI suggests:
  - `app/api/watchlist/route.ts` rejects non-NFL watchlist saves
  - `app/api/favorites/route.ts` stores favorites with `sport: "NFL"`
- Local setup docs are inconsistent:
  - `.env.example` and `README.md` expect `localhost:5432` and `postgres/postgres`
  - `docker-compose.yml` exposes `5433` and uses `admin/admin`

## Recommended Next Priorities

Immediate:

1. Reconcile root vs nested sidecar source of truth.
2. Align widget registry, library exposure, and dashboard render keys.
3. Close the signed-in multi-sport persistence gap for watchlist and favorites.
4. Fix setup/seed consistency across docs and scripts.
5. Decide whether glossary/ranking should be merged into the active root app or explicitly deferred.

Short-term:

1. Standardize all widget routes on the canonical `contract` shape.
2. Reduce duplicate API surfaces.
3. Add stronger integration coverage for dashboard persistence and large widget flows.
4. Break up the largest client/provider files.

## Fast Orientation

- Start with `components/dashboard/DashboardPage.tsx`, `lib/providers/index.ts`, `lib/widgets/registry.ts`, and `prisma/schema.prisma`.
- If you are debugging product behavior, trust the root app first, not `nashboard-2.0/`.
- If you are debugging shared widget behavior, focus on `PlayerCardWidget`, `WatchlistWidget`, and the shared `app/api/players/*` and `app/api/teams/*` routes.
- If you are debugging MLB, the deepest files are `lib/providers/mlb/index.ts`, `lib/sports/resolvers/mlbStartingPitcherMatchup.ts`, and `lib/sports/resolvers/mlbSeriesTracker.ts`.
