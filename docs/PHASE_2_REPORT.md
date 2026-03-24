# Phase 2 Misc Widget Hardening Report

## Scope
Phase 2 focused on hardening existing misc widgets and related flows:
- Player Card
- Watchlist
- Data Health
- Search flows used by Player Card and Watchlist
- Widget metadata/library

No new widgets were added. No provider architecture boundaries were changed.

## Field Inventory Summary

### Player Card
- Reliable fields kept:
  - `fullName`, `teamName`, `position`, `jersey`, `height/weight/age`, `headshot`
  - live context line when present
  - season/recent/injury sections only when populated in advanced mode
- Partially reliable fields demoted:
  - broad `whyItMatters` guidance is shown only in advanced mode
  - raw `stats` blob removed from primary card and retained in debug payload
- Weak/noisy fields hidden:
  - repeated empty advanced section fallbacks across every section
- Debug-only:
  - upstream warning strings, request/endpoint metadata, raw search payload

### Watchlist
- Reliable fields kept:
  - team/player identity
  - team status prioritized to last/today/next
  - live detail and standings/record when present (advanced)
  - player recent/live summary lines (advanced)
- Partially reliable fields adjusted:
  - team card now computes primary line from best available context
  - secondary line shown only when it adds context
- Weak/noisy fields hidden:
  - provider meta note text in primary card body
  - generic placeholder duplication in team/player details
- Debug-only:
  - route endpoint/request diagnostics and raw internal maps

### Data Health
- Reliable summary kept primary:
  - effective mode/source
  - fallback state
  - cache state/age
  - schedule timezone/window
- Advanced/admin diagnostics kept secondary:
  - provider status detail
  - hydration notes
  - endpoint diagnostics
  - manual probe action

### Search Flows (misc-widget related)
- Reliable fields emphasized:
  - player/team name plus stable identifying context
  - explicit no-result states after debounce
- Partially reliable/noisy fields reduced:
  - removed ambiguous bare names without context where possible
  - prevented noisy early “no result” flicker during debounce

### Widget Metadata / Library
- Metadata trust improved:
  - corrected outdated watchlist description
  - added explicit `stability` and `audience` tags
  - surfaced tags in library UI as secondary badges

## What Was Changed

### Kept
- Existing API routes and canonical contracts
- Existing widget IDs and registry-driven metadata flow
- Existing debug pathways and report-bug hooks

### Hidden / Demoted
- Player Card raw stats from primary card UI
- Player Card repeated empty advanced section placeholders
- Watchlist provider notes in primary details
- Data Health diagnostics in beginner mode

### Beginner vs Advanced Decisions
- Beginner mode:
  - compact high-confidence summaries
  - fewer sections and reduced clutter
  - diagnostics hidden
- Advanced mode:
  - richer detail only when data is populated
  - diagnostics and probe tooling available for Data Health
  - no raw provider clutter in main content blocks

## Files Updated in Phase 2
- `components/widgets/PlayerCardWidget.tsx`
- `components/widgets/WatchlistWidget.tsx`
- `components/widgets/DataHealthWidget.tsx`
- `components/widgets/WidgetLibrary.tsx`
- `lib/widgets/registry.ts`
- `tests/player-card-widget.test.ts`
- `tests/watchlist-widget-team-search.test.ts`
- `tests/data-health-widget.test.ts` (new)
- `tests/widget-library-metadata.test.ts` (new)

## Remaining Limitations
- Some advanced insights remain provider-dependent and may be absent; the UI now omits weak sections instead of implying completeness.
- Data Health remains technical by design, but diagnostics are now intentionally gated to advanced mode.
- This pass does not expand sport-specific depth or add new data providers.
