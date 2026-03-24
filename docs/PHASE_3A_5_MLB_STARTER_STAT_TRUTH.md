# Phase 3A.5 - MLB Starter Stat Truth

## Objective
Strengthen MLB Starting Pitcher Matchup advanced stats so established starters reliably show useful comparison data in preseason/spring periods when current regular-season samples are thin.

## Current Stat Retrieval Strategy
Starter comparison stats now flow through one dedicated boundary:
- [`lib/providers/mlb/pitcherComparison.ts`](../lib/providers/mlb/pitcherComparison.ts)

This boundary separates:
- probable starter identity input
- optional MLB identity lookup by fallback name
- selected game season context
- per-stat-type retrieval from MLB Stats API
- season/gameType fallback policy
- normalized UI field mapping

## Fallback Order (Explicit)
For a candidate pitcher:
1. Current season regular-season sample (`gameType=R`)
2. Prior completed regular-season sample (`gameType=R`)
3. Current season spring sample (`gameType=S`)
4. Limited posted data (unsupported/thin)

Policy behavior:
- Current regular season is used only when meaningful.
- Thin current regular sample does not suppress prior completed regular-season comparison values.
- Spring sample is secondary and only used as primary when regular-season data is unavailable/thin.

## Why This Pass Was Needed
Combined multi-hydrate calls against MLB Stats API can fail for valid pitchers in live mode (e.g., 500 responses), which previously blanked all advanced stat mapping.

This pass now retrieves stat groups independently (`season`, `gameLog`, `homeAndAway`, `statSplits`) so one failing hydrate type does not collapse all mapped fields.

## Fields Reliably Supported Now
When source data exists, the boundary maps:
- ERA
- W-L
- WHIP
- IP
- K
- K/9
- BB/9
- HR/9
- Opp AVG
- Last 3 starts / recent form
- Home/Away split snippet
- Handedness split snippet

## User-Facing Stat Basis Labels
Advanced card labels now use:
- `Using <season> regular season`
- `Using spring sample only`
- `Limited posted data`

## Diagnostics (Non-UI)
Code-path diagnostics are attached to provider meta notes, including:
- endpoint used
- season/gameType requested
- mapped fields found
- why mapped values are missing

Diagnostics are filtered from normal card body notes and remain available in meta/debug flows.

## Remaining Source-Limited Areas
- Some pitchers still have sparse split coverage from MLB Stats API during spring/preseason windows.
- Arsenal/statcast-depth fields remain outside core starter-comparison scope and require future premium/multi-source layering.
