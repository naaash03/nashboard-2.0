# Phase 3A.6 - MLB UI Polish

## Purpose
Phase 3A.6 productizes MLB widget presentation without changing the established MLB data/source architecture.

Primary goals:
- make beginner mode compact and premium
- keep advanced mode rich but easier to scan
- clean up MLB Next 7 Games row readability

## Beginner vs Advanced Intent
- Beginner mode:
  - quick pregame scouting summary
  - no empty stat tiles
  - minimal copy and no technical phrasing in primary card body
- Advanced mode:
  - full enriched comparison details
  - side-by-side structure retained
  - dead rows suppressed where data is missing

## MLB Starting Pitcher Matchup Changes
- Beginner card now prioritizes:
  - matchup, date/time, venue
  - starter identity + headshot + handedness
  - compact stat line (`ERA` + `W-L` when available)
  - concise edge summary
  - one concise basis label only when useful
- Beginner no longer shows:
  - empty metric grids
  - verbose notes blocks intended for advanced/debug context
- Advanced view preserved:
  - dropdown game selection
  - side-by-side advanced comparison
  - edge summary and basis labeling
  - split/recent-form sections when present

## MLB Next 7 Games Changes
- Removed visible probable pitcher ID from card rows.
- Kept probable pitcher name as primary text.
- Added small probable-starter headshot when a numeric probable pitcher ID is already present.
- Clean `TBD` presentation when probable starter is unavailable.
- Retained live/fixture handling and existing route/resolver behavior.

## Diagnostics/Admin Paths
- Product UI keeps technical content minimized.
- Existing diagnostics/report-bug pathways remain intact for investigation.

## Remaining Future MLB Premium Polish
- Team/opponent/logo visual refinements across all MLB cards.
- Optional richer game-row context (broadcast/weather/park factors) when desired.
- Additional premium visual hierarchy refinements for dense advanced sections.
