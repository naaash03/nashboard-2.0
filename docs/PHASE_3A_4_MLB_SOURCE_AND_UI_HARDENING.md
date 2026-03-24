# Phase 3A.4 - MLB Source And UI Hardening

## Purpose
Phase 3A.4 hardens MLB widget trust in preseason/spring contexts without changing NashBoard architecture.
This pass focuses on:
- stable pitcher stat basis selection for matchup comparisons
- compact user-facing advanced stat presentation
- cleaner pitcher arsenal selection and unsupported handling

## Root Problems Addressed
- Starting Pitcher Matchup still mixed game resolution and season-stat logic in one resolver boundary.
- Advanced matchup cards could render thin/blank metric boxes when split data was sparse.
- Pitcher Arsenal still surfaced failed states for some unsupported upstream pitch-arsenal responses.
- Pitcher Arsenal search flow could feel raw by collapsing name input to numeric ID only.

## Current MLB Source Responsibilities
- Game + probable starters:
  - `getMlbUpcomingScheduleWithProbables(...)` in [`lib/providers/mlb/provider.ts`](../lib/providers/mlb/provider.ts)
  - Consumed by matchup and next-7 flows for team-first game resolution.
- Pitcher comparison stat enrichment:
  - `resolveMlbPitcherComparisonStats(...)` in [`lib/providers/mlb/pitcherComparison.ts`](../lib/providers/mlb/pitcherComparison.ts)
  - Dedicated boundary for stat-basis selection and normalized comparison fields.
- Pitcher arsenal:
  - `mlbProvider.getPitcherArsenal(...)` in [`lib/providers/mlb/provider.ts`](../lib/providers/mlb/provider.ts)
  - Route-level shaping in [`app/api/widgets/mlb-pitcher-arsenal/route.ts`](../app/api/widgets/mlb-pitcher-arsenal/route.ts)

## What Changed In 3A.4
- Matchup resolver now calls the dedicated pitcher-comparison boundary for advanced stat hydration.
- Selected game time is passed into stat enrichment so basis selection remains game-context aware.
- Matchup advanced metric tiles render only available fields; missing families collapse to one compact explanation.
- Technical season/window notes continue to stay out of the normal user-facing card notes.
- Pitcher Arsenal unsupported upstream errors now return clean partial (`data: null`, warning) instead of forced 502.
- Pitcher Arsenal widget now resolves search-by-name to a selected pitcher identity while preserving numeric-ID compatibility.

## Stat-Basis Policy (Matchup)
The pitcher comparison boundary now explicitly classifies and labels basis as:
- current regular season
- prior completed regular season fallback
- spring sample only
- unsupported/no posted split data

This keeps selected-game resolution separate from selected-stat-basis logic.

## Remaining MLB Stack Gaps
- Single-source dependence still limits depth when MLB Stats split coverage is delayed/incomplete.
- Some split families (recent form/situational splits) remain sparse for fringe pitchers or early calendar windows.
- Arsenal coverage remains uneven across pitchers and seasons by upstream availability.

## Recommended Future Multi-Source Separation
Maintain explicit boundaries:

1. Game + probable starter context
- schedule, game selection, team-first resolution

2. Core pitcher comparison stats/splits
- season-over-season fallback, split normalization, stat-basis labels

3. Premium overlays (arsenal/statcast)
- optional enrichment layer; graceful partial when unsupported

This structure allows future source expansion without altering widget contracts or dashboard persistence.
