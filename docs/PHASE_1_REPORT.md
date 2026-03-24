# Phase 1 Report: Production Data Architecture

Date: 2026-03-09
Branch: `feat/phase-1-data-architecture`

## Summary

Phase 1 introduced a canonical internal sports data layer and added adapter/resolver boundaries while preserving current widget behavior. Existing APIs still return their legacy payloads, but migrated routes now also expose canonical contract payloads (`contract`) for incremental widget migration.

## Core Additions

- Canonical model contracts:
  - `lib/sports/models/types.ts`
- Provider adapters:
  - `lib/sports/adapters/normalizers.ts`
  - `lib/sports/adapters/apisports/index.ts`
  - `lib/sports/adapters/espn/index.ts`
- Team mapping:
  - `lib/sports/mappings/teamMap.ts`
- Resolver boundary + widget envelope:
  - `lib/sports/resolvers/contracts.ts`
  - `lib/sports/resolvers/index.ts`
- Cache/staleness policy:
  - `lib/sports/cachePolicy.ts`
- Fixture discipline policy:
  - `lib/sports/utils/fixturePolicy.ts`

## Route Bridges (Legacy + Canonical Contract)

Migrated routes now attach canonical `contract` payloads:

- `app/api/players/search/route.ts`
- `app/api/teams/search/route.ts`
- `app/api/teams/status/route.ts`
- `app/api/teams/status/batch/route.ts`
- `app/api/search/players/route.ts`
- `app/api/widgets/player-card/route.ts`
- `app/api/widgets/nba-standings/route.ts`
- `app/api/widgets/nba-tonights-slate/route.ts`
- `app/api/widgets/tonights-slate/route.ts`
- `app/api/widgets/mlb-next-7-games/route.ts`
- `app/api/widgets/mlb-pitcher-arsenal/route.ts`
- `app/api/widgets/metadata/route.ts`
- `app/api/watchlist/route.ts`
- `app/api/health/data/route.ts`

## Hybrid Provider Fixture Policy Hardening

`lib/providers/index.ts` now gates auto fixture fallback via policy:

- explicit fixture mode still works (`dataMode=fixture`)
- auto fixture fallback allowed in `development`/`test`
- production-style auto fallback requires `NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK=1`

## Tests Added

- `tests/architecture/canonical-models.test.ts`

Coverage includes:

- canonical normalization of Team, Player, Game from APISports fixture rows
- fallback metadata semantics for widget envelope
- stable team mapping via alias/provider id
- fixture fallback policy behavior
- resolver widget envelope shape (`resolveWatchlistData`)

## Documentation Added

- `docs/PHASE_1_ARCHITECTURE.md`
- `docs/WIDGET_DATA_CONTRACTS.md`
- `docs/PHASE_1_REPORT.md`

## Validation

Commands run:

- `npm install`
- `npm run test` (33 files, 87 tests passed)
- `npm run build` (passed)
- `npm run lint` (warnings only, no errors)

## Known Non-Blocking Items

- Existing lint warnings for `@next/next/no-img-element` remain in widget components.
- Baseline browser mapping staleness warning remains during lint/build.
- Dependency audit findings unchanged (not part of Phase 1 architecture scope).
