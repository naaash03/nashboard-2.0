# Phase 3A.3 - MLB Season-Aware Pitcher Stat Fallback

## Scope
Focused MLB pass for `mlb-starting-pitcher-matchup` stat enrichment in preseason/spring periods.

## Problem
- Probable starters and game resolution were correct.
- Advanced pitcher cards could still be mostly blank in preseason because current-year regular season samples were unavailable or too thin.

## Season-Aware Policy Implemented
For advanced pitcher stat enrichment:
1. Try current season regular split.
2. If current split is missing or too thin, try prior completed regular season.
3. If only thin current sample exists and prior is unavailable, use thin sample.
4. If no posted season split data exists, degrade gracefully.

## Coverage
The policy now fills, when available:
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
- Home/away and handedness split snippets

## Stat Basis Labeling
Each advanced pitcher card now carries a clean product-facing basis label:
- `Stats basis: 2025 regular season`
- `Stats basis: 2024 regular season`
- `Stats basis: Spring training sample only`
- `Stats basis: No posted season split data yet`

## Architecture Notes
- Game selection and probable-starter resolution remain tied to the selected upcoming game.
- Only pitcher stat enrichment gained season-aware fallback.
- No redesign and no non-MLB widget refactor.

## Tests Added/Updated
- Preseason thin current sample falls back to prior regular season.
- Advanced card fields remain populated for established pitchers via prior-season fallback.
- Stat-basis label is present and correct.
- Unsupported/no-id case degrades gracefully with clean basis labeling.
