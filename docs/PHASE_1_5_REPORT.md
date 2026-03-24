# Phase 1.5 Runtime Integrity Report

## Scope
This pass was limited to runtime integrity and misc widget stabilization:
- Schedule/season query correctness
- Clean user-facing fallback output
- Debug/admin separation from normal widget content
- Preserve current routes and passing baseline

## Runtime Issues Fixed

### 1) Schedule/Season Query Coherence
- Added shared helper: `lib/providers/scheduleContext.ts`
  - `resolveLeagueSeasonContext(...)`
  - `resolveScheduleQueryContext(...)`
- Updated `lib/providers/apiSports/teamAdvanced.ts` to use shared schedule context.
- `season` for API-Sports standings/games is now resolved from the active date window context (instead of blindly trusting stale env season values).
- Prevents mismatched combinations like `season=2024` with `from/to` dates in 2026.

### 2) Team/Watchlist Fallback Cleanliness
- Updated `components/widgets/WatchlistWidget.tsx`:
  - Added runtime message sanitizer for provider/debug-style noise.
  - Removed direct surface of provider warning text from successful calls.
  - Replaced fragile fallback strings with clean product states:
    - `No recent games available`
    - `Next scheduled game not available`
    - `No scheduled games available right now`
    - `Live context unavailable`
  - Removed direct rendering of `metaNotes` in main card details.

### 3) Player Card Fallback Cleanliness
- Updated `components/widgets/PlayerCardWidget.tsx`:
  - Added `sanitizePlayerCardWarning(...)` for user-facing warning hygiene.
  - Stopped pushing raw provider warnings into main card content.
  - Standardized section fallback copy:
    - `Live context unavailable.`
    - `Season insights unavailable.`
    - `No recent games available.`
    - `Live status unavailable.`
  - Removed provider notes block from main advanced body.
  - Kept warning diagnostics visible in Debug section (`Profile warning`, `Insights warning`).

### 4) Data Health Presentation Tidy-Up
- Updated `components/widgets/DataHealthWidget.tsx`:
  - Top section now presents concise health summary:
    - effective mode/source
    - fallback state
    - cache state/age
    - schedule timezone/window
  - Provider status and endpoint dumps remain available but secondary inside `<details>`.

## Tests Added/Updated

### Added
- `tests/providers/schedule-context.test.ts`
  - Validates mismatch correction (configured season vs active date window)
  - Validates sport-specific season inference behavior
  - Validates coherent schedule window context output

### Updated
- `tests/watchlist-advanced-batch.test.ts`
  - Added clean team fallback status check
  - Added diagnostic sanitization check
  - Added check that direct `metaNotes` rendering is not present in main watchlist details
- `tests/player-card-widget.test.ts`
  - Updated fallback text expectations to clean product copy
  - Added provider diagnostic sanitization check
  - Added debug-only warning surface check

## Known Remaining Limitations
- Team advanced provider metadata still carries technical warnings for diagnostics; widgets now sanitize/hide these from primary content.
- This pass did not redesign provider routing or add new data features; it only hardened current runtime behavior.

## Files Changed (Phase 1.5)
- `lib/providers/scheduleContext.ts` (new)
- `lib/providers/apiSports/teamAdvanced.ts`
- `components/widgets/WatchlistWidget.tsx`
- `components/widgets/PlayerCardWidget.tsx`
- `components/widgets/DataHealthWidget.tsx`
- `tests/providers/schedule-context.test.ts` (new)
- `tests/watchlist-advanced-batch.test.ts`
- `tests/player-card-widget.test.ts`
