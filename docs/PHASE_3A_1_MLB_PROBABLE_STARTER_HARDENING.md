# Phase 3A.1 - MLB Probable Starter Hardening

## Scope
Targeted MLB repair pass only:
- `mlb-starting-pitcher-matchup`
- `mlb-next-7-games`
- `mlb-pitcher-arsenal`

No non-MLB widget architecture changes were made.

## Root Cause - Matchup Widget 502 / No Upcoming Game
- `mlb-starting-pitcher-matchup` was resolving games from an APISports-specific path that could fail to return valid upcoming rows for otherwise valid MLB teams.
- `mlb-next-7-games` used MLB schedule resolution (`statsapi.mlb.com`) and still resolved games.
- This mismatch caused divergent runtime behavior and avoidable `GAME_NOT_FOUND` failures.

## Root Cause - Pitcher Arsenal Invalid playerId
- `mlb-pitcher-arsenal` treated the `playerId` query as already valid.
- Runtime input could contain names (for example, `"Clay Holmes"`), which were forwarded directly to `/people/{id}` and triggered upstream 400 invalid request errors.

## What Changed

### 1) Shared MLB Schedule + Probable Starter Path
- Added/used shared schedule helper in MLB provider:
  - `getMlbUpcomingScheduleWithProbables(...)`
- This helper:
  - resolves team schedule from MLB Stats API
  - requests probable starter hydration
  - normalizes schedule rows with probable starter identity fields
- Both widgets now rely on that shared path:
  - `mlb-next-7-games`
  - `mlb-starting-pitcher-matchup`

### 2) Matchup Game Resolution Alignment
- `mlb-starting-pitcher-matchup` default schedule fetch now uses the same MLB schedule path as `mlb-next-7-games`.
- Selection behavior remains:
  - prefer today
  - otherwise next scheduled
  - honor explicit `gameId` override
- Partial state behavior is unchanged:
  - still returns partial when game exists but starters are not posted.

### 3) Pitcher Arsenal ID Hardening
- Route now resolves non-numeric pitcher input through MLB player search before calling arsenal upstream.
- If no valid numeric id can be resolved:
  - returns clean 400 error
  - avoids leaking raw invalid-request provider text.
- Widget now resolves name input to numeric id before arsenal fetch and persists numeric id.

### 4) User-Facing Error/Warn Hygiene
- MLB widget card bodies now avoid exposing raw upstream exception strings.
- Debug details remain available through existing report/debug paths.

## Remaining Limitations
- Team key coverage still depends on the current MLB team map used by provider plumbing.
- Probable starters remain upstream-dependent; when genuinely absent, widgets keep `TBD`/partial behavior.
