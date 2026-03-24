# Phase 1 Production Data Architecture

## Scope

Phase 1 adds a canonical internal data layer for current misc-widget flows without redesigning UI behavior. The goal is to stabilize contracts so future widgets can consume NashBoard-native models instead of provider-specific payloads.

## Canonical Models

Canonical contracts are defined in:

- `lib/sports/models/types.ts`

Core entities now include:

- `League`
- `Team`
- `Player`
- `Game`
- `StandingsRow`
- `PlayerInsight`
- `TeamStatus`
- `WidgetPayload<T>`

These are the internal target contracts for widget-facing data.

## Provider Adapters

Adapter normalizers are implemented in:

- `lib/sports/adapters/normalizers.ts`
- `lib/sports/adapters/apisports/index.ts`
- `lib/sports/adapters/espn/index.ts`

Implemented functions:

- `normalizeTeamFromApiSports`
- `normalizeTeamFromEspn`
- `normalizePlayerFromApiSports`
- `normalizePlayerFromEspn`
- `normalizeGameFromApiSports`
- `normalizeGameFromEspn`
- `normalizeStandingsRowFromApiSports`
- `normalizeStandingsRowFromEspn`

These normalize current provider rows into canonical NashBoard models.

## Mapping Layer

Team identity mapping is centralized in:

- `lib/sports/mappings/teamMap.ts`

Current behavior:

- Canonical team id is abbreviation-based (e.g., `nba-lal`, `mlb-nym`)
- Supports APISports and ESPN provider ids
- Supports alias resolution (abbreviation, display name, short alias)
- Covers current core league pathways (`NFL`, `NBA`, `MLB`) and includes deterministic fallback for unmapped teams

## Resolver and Contract Boundary

Resolver utilities are in:

- `lib/sports/resolvers/index.ts`
- `lib/sports/resolvers/contracts.ts`

Implemented resolver surfaces:

- `resolveSearchResults`
- `resolvePlayerCardData`
- `resolveTeamStatus`
- `resolveTeamStatusBatch`
- `resolveWatchlistData`
- `resolveStandings`
- `resolveSlate`

`toWidgetPayload(...)` is the shared widget envelope boundary used by routes to expose canonical source metadata (`provider`, `mode`, `fallbackUsed`, `stale`, `fetchedAt`) and optional debug notes.

## Provider Priority and Fallback Rules

Current priority for core routes:

1. `apiSports` primary where supported
2. `espn` fallback/enrichment
3. `fixture` only when explicit mode is requested, or auto-fixture fallback is allowed by environment policy

Auto fixture fallback policy is centralized in:

- `lib/sports/utils/fixturePolicy.ts`

Policy:

- Allowed by default in `development`/`test`
- Disabled in `production` unless explicitly enabled with `NASHBOARD_ALLOW_AUTO_FIXTURE_FALLBACK=1`

## Cache and Staleness Philosophy

Shared TTL policy is defined in:

- `lib/sports/cachePolicy.ts`

Current Phase 1 baseline:

- live slate: 45s
- standings: 300s
- player profile: 600s
- player insight: 240s
- team status: 60s
- search: 180s

Staleness signaling:

- `sourceUsed: "cache"` is treated as stale-capable
- widget contract `source.stale` is set when cached source is used
- fallback/stale details are surfaced in `WidgetPayload.debug.notes`

## Fixture Mode Policy

Fixture mode remains in codebase for:

- tests
- explicit developer requests (`dataMode=fixture`)
- controlled fallback in non-production mode

Routes now report canonical contract source metadata so fixture usage is visible.

## Migration Notes

Phase 1 is intentionally additive:

- legacy route response shapes remain available for existing widgets/tests
- canonical contracts are attached as bridge payloads (`contract`) in migrated routes
- full outward response unification can be completed in a later phase once widget clients are fully migrated

Current migrated route groups:

- player search
- team search
- team status (single + batch)
- player card
- watchlist
- widget metadata
- data health
- tonight/slate and standings routes in current misc-widget set
