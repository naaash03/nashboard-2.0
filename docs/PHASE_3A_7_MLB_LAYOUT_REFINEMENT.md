# Phase 3A.7 - MLB Layout Refinement

## Scope
Phase 3A.7 is a presentation-only pass for:
- MLB Starting Pitcher Matchup
- MLB Next 7 Games

No source architecture, route contracts, or persistence/registry behavior were changed in this pass.

## Beginner Presentation Intent (Matchup)
- Beginner mode is now a compact pregame scouting card.
- It prioritizes:
  - matchup, date/time, venue
  - starter identity + headshot + handedness
  - single compact stat line (`ERA`, `W-L` when posted)
  - concise edge summary
- It avoids advanced density:
  - no stat-tile grids
  - no split sections
  - no game-log sections
  - no verbose technical/fallback wording in normal body

## Advanced Presentation Intent (Matchup)
- Advanced mode keeps enriched stat depth and season-aware basis behavior.
- Layout is refined for scanability:
  - clearer vertical section spacing
  - balanced side-by-side starter cards
  - cleaner visual handling when one side is missing
  - reduced dead-space feel while preserving existing fields and dropdown flow

## One-Sided Probable Starter Handling
- Missing-side card now uses an intentional placeholder state, not a broken-looking block.
- Available-side card remains full-strength and readable.
- Summary copy stays useful in partial states (for example, one side announced, opposite side TBD).

## Next 7 Row/Card Decisions
- Keeps current functionality and resolved probable-starter behavior.
- Keeps probable starter name prominent.
- Keeps headshot display where probable pitcher ID is already available.
- Keeps `TBD` clean when no probable starter is posted.
- Keeps probable pitcher ID out of visible UI rows.
- Improves schedule row hierarchy with clearer matchup/date/home-away/starter structure.

## What Remains Before MLB Series Tracker
- Add cross-widget premium polish theme pass (final visual tuning).
- Add series-level aggregation and narrative context (upcoming Series Tracker scope).
- Optional premium additions (park factors, weather, deeper overlays) remain future work.
