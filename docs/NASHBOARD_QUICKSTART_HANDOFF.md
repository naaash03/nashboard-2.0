# NashBoard Quickstart Handoff

Audit basis: repo root on disk as inspected on 2026-04-19.

## What NashBoard Is

NashBoard is a widget-based sports analytics dashboard built in Next.js. Users add widgets, switch them between `BEGINNER` and `ADVANCED` modes, and run either in guest mode or signed-in mode with saved dashboard state.

The app is trying to be "sports analytics for normal fans," not just a scoreboard and not just a pro-stat terminal.

## Current Repo State

- Branch during audit: `feat/nfl-provider-parity`
- Pre-existing uncommitted change at audit start: `next-env.d.ts`
- This repo is real and mature enough to hand off, but uneven by widget tier

Current sport status:
- MLB: strongest vertical by a clear margin
- NBA: stable core widgets are solid; three newer widgets are honest hybrid/scaffold experiments
- NFL: better than older docs imply because it now has a stable trio beyond `tonights_slate`, but still thinner overall

## Best Current Widgets

- `mlb_starting_pitcher_matchup`
- `mlb_series_tracker`
- `mlb_next_7_games`
- `player_card`
- `nfl_division_snapshot`
- `nfl_team_context_card`
- `nfl_recent_form`
- `nba_tonights_slate`
- `nba_standings`

## Weakest / Most Incomplete Areas

- `rb_vs_dline` is still the weakest exposed sports widget
- `watchlist` UI is ahead of signed-in persistence reality
- `data_health` diagnostics do not include MLB Stats API or BALLDONTLIE
- `nba_team_matchup_profile` is still hybrid with scaffolded matchup pillars
- `nba_player_role_form` is honest partial-live, not fully mature live

## Architecture In One Pass

Core files to read first:
- `lib/widgets/registry.ts`
- `components/dashboard/DashboardPage.tsx`
- `lib/providers/index.ts`
- `lib/sports/resolvers/nflWidgets.ts`
- `lib/sports/resolvers/nbaScaffolds.ts`
- `lib/sports/resolvers/mlbStartingPitcherMatchup.ts`
- `lib/sports/resolvers/mlbSeriesTracker.ts`
- `lib/stats/glossary.ts`

Real structure:
- registry drives library exposure
- `app/api/widgets/**` serves widget routes
- resolvers handle provider order and partial/demo honesty where needed
- templates are used on some widget families, but not uniformly
- `StatExplainerProvider` + `StatLabel` power shared stat explanations

## Provider Truth By Sport

MLB:
- MLB Stats API is the real backbone for MLB widgets
- ESPN is only a targeted fallback/enrichment source in a few cases

NBA:
- ESPN powers stable slate/standings widgets
- BALLDONTLIE powers the three experimental teaching widgets when configured
- API-Sports is fallback there

NFL:
- ESPN is primary for stable widgets
- API-Sports NFL is fallback
- demo/fixture is used honestly for failure/offseason cases

## Biggest Current Caveats

- `DashboardPage.tsx` still persists new widgets with `sport: "NFL"`
- signed-in `/api/watchlist` is still NFL teams only
- `/api/health/data` only exposes ESPN/API-Sports health
- some `toWidgetPayload()` calls still hardcode a primary provider that is not the actual source backbone
- older docs like `CLAUDE.md` are now partially stale

## Best Next Pass

Run a cross-sport truth/persistence hardening pass:
- fix widget sport persistence
- fix `watchlist` signed-in scope
- tighten provider/source metadata honesty
- extend diagnostics to MLB Stats API and BALLDONTLIE

Do that before adding more new widgets.

## Paste Into A New Chat

NashBoard is a widget-based sports analytics dashboard with `BEGINNER` and `ADVANCED` modes. Current repo state is strongest in MLB, solid in stable NBA, and improved but still thinner in NFL. Best current widgets are `mlb_starting_pitcher_matchup`, `mlb_series_tracker`, `mlb_next_7_games`, `player_card`, and the stable NFL trio. NBA stable widgets are solid; the newer NBA widgets are hybrid/scaffold-heavy but honest about it. Important repo caveats: `DashboardPage.tsx` still saves new widgets with `sport: "NFL"`, signed-in `/api/watchlist` is still NFL-team only, `data_health` only covers ESPN/API-Sports, and some provider labels in widget contracts are misleading. Best next pass is cross-sport truth/persistence hardening, not adding more features.
