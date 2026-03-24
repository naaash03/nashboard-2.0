# Phase 3A.2 - MLB Stat Enrichment and Arsenal Fix

## Scope
Targeted MLB-only repair pass:
- `mlb-pitcher-arsenal`
- `mlb-starting-pitcher-matchup`
- minimal fixture/test consistency updates

No non-MLB widgets were refactored.

## Root Cause - Pitcher Arsenal 502 on Numeric IDs
- The arsenal route delegated numeric ids directly to MLB Stats API.
- For ids that are numeric but unsupported by MLB arsenal endpoint (for example, provider-mismatched ids), upstream returned non-OK responses.
- Those errors bubbled to route-level catch, producing 502s.

## Root Cause - Matchup Advanced Stats Mostly Blank
- Matchup probable starters are resolved from MLB schedule.
- The advanced stat hydrator still used API-Sports `players/statistics` with those MLB starter ids.
- MLB ids and API-Sports player ids are not interchangeable, so stat lookups often came back empty.

## Root Cause - Technical Notes in User Card Body
- Resolver notes included season/window diagnostics for runtime transparency.
- Widget body rendered `meta.notes` directly, exposing operational/debug text in the main card UI.

## What Changed

### 1) Arsenal Graceful Partial Behavior
- `mlbProvider.getPitcherArsenal(...)` now treats unsupported-id upstream errors (400/404/not found/invalid) as a clean partial outcome:
  - `data: null`
  - warning set to a user-safe unsupported message
  - no thrown error for this class
- Route keeps 200 with null data for unsupported ids, avoiding 502 in this case.

### 2) Matchup Stat Enrichment Moved to MLB Stats Path
- Matchup advanced pitcher hydration now calls MLB Stats API for pitcher season/game-log/split data using MLB starter ids.
- Parser now maps supported fields when available:
  - `ERA`, `W-L`, `WHIP`, `IP`, `K`, `K/9`, `BB/9`, `HR/9`, `Opp AVG`
  - plus last-3 starts and split snippets when present.
- If data is incomplete, enrichment remains safe and partial without crashing.

### 3) Debug Note Separation
- Added technical note filtering for user-facing note surface.
- Technical season/window notes stay in meta/debug context and report-bug payload.
- Main card body now renders only user-facing notes and no longer prioritizes raw `meta.notes`.

### 4) Fixture/Test Hardening
- Added MLB fixture payload for matchup pitcher stat hydration.
- Added starter ids to current fixture game in `next7_nym.json` for deterministic fixture enrichment.
- Added focused tests for:
  - arsenal unsupported numeric-id graceful partial response
  - matchup advanced stat hydration from MLB ids
  - technical note filtering behavior

## Remaining Limitations
- If MLB schedule does not publish a probable starter id and name resolution is unavailable, advanced stat hydration remains limited.
- Arsenal still returns 502 on true upstream/service failures outside unsupported-id cases (intentional to preserve signal for real outages).
