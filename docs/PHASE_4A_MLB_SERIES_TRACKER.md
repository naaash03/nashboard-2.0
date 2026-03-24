# Phase 4A: MLB Series Tracker

## Purpose
MLB Series Tracker adds a series-first MLB workflow to NashBoard:
- Resolve current active series for a selected team.
- Fall back to next upcoming series when no active set exists.
- Allow selection of any in-season series via dropdown.
- Preserve a clean beginner summary while offering deeper advanced context.

## Source Responsibilities
Current implementation follows existing NashBoard MLB provider boundaries:
- MLB Stats API (`/schedule` with `hydrate=probablePitcher`) is used as schedule truth.
- Series grouping prefers MLB official grouping signals when present (`seriesDescription`, `seriesGameNumber`, `gamesInSeries`).
- Fallback grouping uses opponent + consecutive scheduled dates.

Current pass does not add new APISports/ESPN series ingestion. The resolver remains source-safe and degrades to partial states when grouping confidence/data density is limited.

## Route Contract
`GET /api/widgets/mlb-series-tracker`

Query params:
- `teamKey` (required)
- `mode` (`beginner|advanced`)
- `dataMode` (`live|fixture|auto`)
- `seriesId` (optional selected series)
- `cacheBust` (optional)

Response envelope:
- `data`: normalized series tracker payload (or `null` on partial/failed fetch)
- `meta`: includes `sourceUsed`, `seriesGroupingMethod`, `season`, `seriesType`, and standard widget metadata
- `error`: nullable string
- `contract`: standardized NashBoard widget contract

## Grouping and Resolution Logic
Grouping order:
1. Official grouping signals (`seriesDescription` and/or `seriesGameNumber` + `gamesInSeries`).
2. Fallback opponent + consecutive local dates.

Selection order:
1. `seriesId` override when provided.
2. Current active series.
3. Next upcoming series.
4. Most recent completed series.

If no active series exists and an upcoming one is selected automatically, payload includes:
- `message: "No active series. Showing next upcoming series."`

## Postseason Support
Postseason game types are recognized and labeled:
- `F` -> Wild Card (best-of 3)
- `D` -> ALDS/NLDS (best-of 5)
- `L` -> ALCS/NLCS (best-of 7)
- `W` -> World Series (best-of 7)

Series payload includes:
- `seriesType: "postseason"`
- `postseasonRound`
- `bestOf`

## UI States
Supported states:
- Loading
- Success
- Partial
- Failed
- No active series (upcoming fallback)
- Completed series

One-line product-facing messaging is used in card body; diagnostics remain in `meta`/report-bug paths.

## Beginner vs Advanced Intent
Beginner mode:
- compact series summary
- series score
- concise chips/timeline status

Advanced mode:
- full timeline rows
- probable starter context
- grouping/lifecycle context
- recent head-to-head list

## Remaining MLB Data Limitations
Currently source-limited fields in advanced analytics remain optional:
- Team AVG/OBP/SLG
- Starters ERA and bullpen ERA rollups
- hitter-level recap details

Those require additional per-game boxscore/statcast enrichment, which is deferred to a future MLB premium data phase.
