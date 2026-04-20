# NashBoard Full Audit Handoff

Audit basis: repo root on disk as inspected on 2026-04-19.

Scope note:
- This was a documentation-only pass.
- No app/provider/widget logic was changed.
- This document reflects the current repository state, not older planning assumptions.
- Runtime commands like `npm run build`, `npm test`, and `npx tsc --noEmit` were not re-run in this pass; any build/test notes below are either code-derived or explicitly marked as inherited from existing docs.

Repo state at audit start:
- Active branch: `feat/nfl-provider-parity`
- Pre-existing uncommitted change present before this doc pass: `next-env.d.ts`
- Existing handoff/planning docs reviewed: `CLAUDE.md`, `NASHBOARD_FRESH_CHAT_HANDOFF.md`, `NASHBOARD_NEXT_PASS_RECOMMENDATIONS.md`, and `docs/*`

## 1. Executive Summary

NashBoard is trying to be a widget-driven, multi-sport analytics dashboard for normal fans rather than a pure stat-head tool. The core product idea is still coherent: users add widgets to a dashboard, each widget can run in `BEGINNER` or `ADVANCED` mode, and the app tries to expose source metadata and fallback behavior rather than pretending every card is fully live all the time.

The current repo is real and substantial, but uneven. MLB is still the deepest and most product-ready vertical. NBA now has a credible stable baseline plus three honest experimental teaching widgets. NFL is no longer just a two-widget afterthought because the repo now includes `nfl_division_snapshot`, `nfl_team_context_card`, and `nfl_recent_form`, but NFL breadth still trails MLB and the stable part of NBA.

What is working well:
- The registry-driven widget library is disciplined and readable.
- The dashboard shell, persistence plumbing, and guest/signed-in split are mature enough to support real iteration.
- MLB has multiple genuinely useful live-backed widgets, not just demos.
- The shared stat explainer system is real, broad, and used meaningfully in many MLB widgets plus selected NFL/NBA/shared widgets.
- Shared player/team search and profile routes are stronger than some older widget-specific routes.

What is still fragile:
- Provider policy is inconsistent by sport and by widget family.
- Several widgets are only partially live or deliberately scaffolded.
- Signed-in persistence does not match the multi-sport UI in some places, especially `watchlist`.
- Diagnostics cover ESPN/API-Sports well enough, but not MLB Stats API or BALLDONTLIE.
- A few source labels/contracts are technically misleading about which provider is actually primary.

Biggest current blockers:
- Cross-sport product honesty is not fully aligned with current UI and metadata.
- Experimental NBA widgets still lean on scaffolded logic even when live data is partially present.
- `rb_vs_dline` is still the weakest exposed sports widget and does not match the discipline of the newer resolver/template pattern.
- Test coverage is strong for some flagship widgets and missing for several others.

Highest-confidence next steps:
- Harden cross-sport truth and persistence before adding more new widgets.
- Keep MLB widget policy MLB-first.
- Either harden or de-emphasize scaffold-heavy widgets rather than pretending they are already flagship surfaces.
- Extend diagnostics and tests in the exact places where current runtime confidence is weakest.

## 2. Architecture Overview

### Dashboard and widget system

The dashboard is centered in `components/dashboard/DashboardPage.tsx`. It:
- fetches saved widgets from `/api/dashboard` and `/api/dashboard/widgets` for signed-in users
- falls back to guest/session-only behavior via `lib/guest/guestDashboard`
- renders widgets by key through a central component map
- wraps the page in `StatExplainerProvider`
- exposes data mode and bug-report wiring to every widget

Important current caveat:
- `DashboardPage.tsx` still hardcodes new widget creation with `sport: "NFL"` when persisting a widget instance. That is a real cross-sport metadata bug/limitation even though the library itself is multi-sport.

### Registry

The registry lives in `lib/widgets/registry.ts`.

It is the source of truth for:
- widget keys
- user-facing names and descriptions
- category grouping by sport
- stability labels (`stable`, `experimental`, `admin`)
- audience hints
- default size

The widget library UI in `components/widgets/WidgetLibrary.tsx` is registry-driven and pulls metadata from `/api/widgets/metadata`. That route simply republishes registry metadata through the standardized `toWidgetPayload()` contract.

Important current caveat:
- `/api/widgets/metadata` labels `primaryProvider: "apiSports"` even though the payload is internal registry metadata, not provider data. That is harmless for UI rendering, but it weakens source semantics.

### Routes

The app uses several route patterns:

Widget-specific API routes:
- `app/api/widgets/**`
- mostly follow a route -> provider/resolver -> template/shape -> component pattern

Shared data routes:
- `app/api/players/search/route.ts`
- `app/api/players/profile/route.ts`
- `app/api/players/insights/route.ts`
- `app/api/teams/search/route.ts`
- `app/api/teams/advanced/route.ts`

Persistence and shell routes:
- `app/api/dashboard/route.ts`
- `app/api/dashboard/widgets/route.ts`
- `app/api/watchlist/route.ts`
- `app/api/health/data/route.ts`

### Resolvers

Resolvers are where the current architecture is most intertwined.

Key resolver files:
- `lib/sports/resolvers/nflWidgets.ts`
- `lib/sports/resolvers/nbaScaffolds.ts`
- `lib/sports/resolvers/mlbSeriesTracker.ts`
- `lib/sports/resolvers/mlbStartingPitcherMatchup.ts`
- shared resolver helpers in `lib/sports/resolvers/index.ts`

Resolver responsibilities now include:
- validating input and fallback mode
- choosing provider order
- preserving honest partial states instead of throwing
- building user-facing notes while hiding technical diagnostics
- exposing consistent `meta` + `contract` envelopes

NFL and experimental NBA rely heavily on dedicated resolvers.
MLB is split:
- flagship MLB widgets like `mlb_series_tracker` and `mlb_starting_pitcher_matchup` use richer resolvers
- many second-tier MLB widgets call `mlbProvider` methods directly from routes

### Templates

Templates are used unevenly but intentionally.

Template-heavy widgets:
- `tonights_slate`
- `rb_vs_dline`
- `nba_tonights_slate`
- `nba_standings`
- `nba_team_matchup_profile`
- `nba_rest_schedule_spot`
- `nba_player_role_form`
- `mlb_next_7_games`
- `mlb_pitcher_arsenal`
- legacy `/api/widgets/player-card`

Resolver/direct-shape widgets with little or no separate template layer:
- `nfl_division_snapshot`
- `nfl_team_context_card`
- `nfl_recent_form`
- `mlb_series_tracker`
- `mlb_starting_pitcher_matchup`
- `mlb_season_stats`
- `mlb_platoon_advantage`
- `mlb_recent_form`
- `mlb_bullpen_fatigue`
- `mlb_run_expectancy`
- `watchlist`
- `data_health`
- live `player_card` component flow

### Providers

Provider usage is split across four real families:
- ESPN: strongest for NFL, stable for NBA slate/standings, important fallback/enrichment source elsewhere
- MLB Stats API: strongest single-source integration in the repo; backbone for most MLB widgets
- API-Sports: important hybrid and fallback source, especially for shared player/team flows and secondary NFL/NBA coverage
- BALLDONTLIE: narrow, experimental NBA live layer for the three new teaching widgets

Provider wrappers:
- `lib/providers/espn/**`
- `lib/providers/mlb/**`
- `lib/providers/apiSports/**`
- `lib/providers/balldontlie/**`
- shared hybrid orchestration in `lib/providers/index.ts`

### Shared glossary / stat explainer

The glossary lives in `lib/stats/glossary.ts`.

It is not just static copy. It supports:
- sport-aware stat lookup
- merged custom + built-in terms
- fallback aliases
- enrichment by label and stat key

The frontend provider lives in `components/stats/StatExplainerProvider.tsx` and loads `/api/glossary` while merging built-ins. Widgets that use `StatLabel` get hover/click explainer behavior from the shared provider.

### Search and selection flows

Search/selection is more shared than the widget list implies.

Player flows:
- `PlayerCardWidget` and `WatchlistWidget` use `/api/players/search`
- details come from `/api/players/profile`
- advanced context comes from `/api/players/insights`

Team flows:
- `WatchlistWidget` uses `/api/teams/search`
- advanced team context comes from `/api/teams/advanced`

These routes all go through `lib/providers/index.ts`, which currently prefers:
- API-Sports first
- ESPN fallback/enrichment second
- fixture fallback last when explicitly or automatically allowed

Important implication:
- shared MLB player/team utilities are not MLB Stats API first; they currently depend on the hybrid API-Sports -> ESPN -> fixture strategy instead

### Persistence / saved widgets

Widget persistence is backed by Prisma through:
- `/api/dashboard`
- `/api/dashboard/widgets`

Guest persistence is local/session-based through `lib/guest/**`.

Important current mismatch:
- `watchlist` presents as a multi-sport utility widget in the UI
- signed-in `/api/watchlist` persistence is still NFL teams only
- guest/local watchlist behavior is broader than signed-in server persistence

### Where beginner vs advanced mode is decided

Mode is decided in both backend and frontend.

Backend:
- routes often accept `mode=beginner|advanced`
- templates/resolvers can prune, enrich, or relabel payloads differently by mode

Frontend:
- widgets still gate rendering detail based on `props.mode === "ADVANCED"`
- some widgets truly differ in information density
- some only differ in presentation

Current reality:
- mode discipline is strongest in MLB flagship widgets, Player Card, Watchlist, and the NFL stable trio
- mode separation is thinner in slate widgets and some simpler cards

### How source/meta/debug info flows

Most routes call `resolveDataModeFromRequest(req)` and then return:
- `data`
- `meta`
- `contract` from `toWidgetPayload()`

Common contract/debug fields:
- source provider
- source mode
- fetched time
- fallbackUsed
- requestId

The architecture is trying to be truthful about fallback and stale/cache behavior. The main weaknesses are not the existence of source metadata, but:
- some widgets surface it clearly and some barely do
- some contracts hardcode `primaryProvider` values that do not match the real source chain

## 3. Data Provider Strategy By Sport

### MLB

Current primary provider(s):
- MLB Stats API for almost every MLB-specific widget through `lib/providers/mlb/**`

Current secondary/fallback provider(s):
- ESPN fallback is used selectively, most notably in `mlb_starting_pitcher_matchup` when probable starters are missing from the MLB path
- fixture/disk fallback exists through `fetchMlbJson`

Demo/scaffold role:
- small for MLB overall
- explicit for `mlb_run_expectancy`
- partial/null-safe responses for `mlb_pitcher_arsenal`, `mlb_platoon_advantage`, and some low-data cases

Health assessment:
- healthiest provider strategy in the repo
- MLB widget policy is coherent because most MLB widgets actually share one real backbone
- the remaining weakness is not provider choice; it is sparse upstream coverage in certain endpoints and uneven test coverage across the second-tier widgets

Policy recommendation:
- keep MLB widget strategy MLB-first
- do not broaden API-Sports-first semantics for MLB-specific widgets
- fix any metadata/provider-label confusion that still claims API-Sports primacy where MLB Stats API is actually the backbone

### NBA

Current primary provider(s):
- ESPN for `nba_tonights_slate` and `nba_standings`
- BALLDONTLIE for `nba_team_matchup_profile`, `nba_rest_schedule_spot`, and `nba_player_role_form` when configured and when a live selection exists

Current secondary/fallback provider(s):
- API-Sports NBA fallback in the three experimental teaching widgets
- demo/scaffold fallback when live provider access or coverage is insufficient

Demo/scaffold role:
- central to the three experimental widgets
- these widgets are honest about it, but they are still scaffold-assisted products

Health assessment:
- mixed
- stable baseline widgets are healthy
- experimental widgets are operational and thoughtfully coded, but not fully mature
- current NBA policy is effectively split into two systems: ESPN stable widgets and BALLDONTLIE hybrid teaching widgets

Policy recommendation:
- keep ESPN for stable baseline widgets
- keep BALLDONTLIE only if the team is willing to finish hardening those widgets
- otherwise de-emphasize the most scaffold-heavy NBA cards instead of treating them as already product-complete

### NFL

Current primary provider(s):
- ESPN for `tonights_slate`, `nfl_division_snapshot`, `nfl_team_context_card`, `nfl_recent_form`, and most of `rb_vs_dline`

Current secondary/fallback provider(s):
- API-Sports NFL fallback for the stable trio in `lib/sports/resolvers/nflWidgets.ts`
- demo data for fixture mode and failure/offseason cases

Demo/scaffold role:
- material, but generally honest
- stable widgets are built to degrade gracefully instead of faking full live certainty
- `rb_vs_dline` still behaves more like an older bespoke experimental widget than a hardened resolver-based widget

Health assessment:
- decent for the stable trio plus slate
- still thin in breadth compared with MLB
- not provider-broken, but not fully converged either

Policy recommendation:
- keep ESPN-first as the core NFL policy
- keep API-Sports as a fallback/enrichment source, not the main truth layer
- either harden `rb_vs_dline` into the newer pattern or push it down in priority/exposure

## 4. Widget Inventory Table

Readiness classes used below:
- `strong live`
- `live`
- `hybrid`
- `partial-live`
- `scaffold-heavy`
- `demo fallback dependent`
- `unclear / needs audit`

| Widget Key | Sport | User Title | Purpose | Route File | Component File | Template File | Resolver File | Primary Source | Fallback Source | Beginner Quality | Advanced Quality | Stat Explainer | Source State | Production Readiness | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tonights_slate` | NFL | Tonight's Slate | show today-first NFL slate with offseason-safe next/previous behavior | `app/api/widgets/tonights-slate/route.ts` | `components/widgets/TonightsSlateWidget.tsx` | `lib/templates/tonightsSlate.ts` | none; route logic only | ESPN scoreboard/schedule helpers | none beyond route state handling and fixture mode | good | moderate | missing | `live` | medium-high | honest offseason handling; no dedicated widget test found |
| `nfl_division_snapshot` | NFL | NFL Division Snapshot | standings context by division, including honest offseason final-state wording | `app/api/widgets/nfl-division-snapshot/route.ts` | `components/widgets/NflDivisionSnapshotWidget.tsx` | `lib/templates/nflDivisionSnapshot.ts` | `lib/sports/resolvers/nflWidgets.ts` | ESPN team profiles | API-Sports NFL, then demo | good | good | good | `live` | high | one of the better NFL widgets; tested |
| `nfl_team_context_card` | NFL | NFL Team Context Card | show next-game or most-recent-game context for a selected team | `app/api/widgets/nfl-team-context-card/route.ts` | `components/widgets/NflTeamContextCardWidget.tsx` | `lib/templates/nflTeamContextCard.ts` | `lib/sports/resolvers/nflWidgets.ts` | ESPN profile + schedule | API-Sports NFL, then demo | good | good | limited | `live` | high | honest offseason/bye behavior; tested |
| `nfl_recent_form` | NFL | NFL Recent Form / Schedule Spot | summarize recent results with schedule-context framing | `app/api/widgets/nfl-recent-form/route.ts` | `components/widgets/NflRecentFormWidget.tsx` | `lib/templates/nflRecentForm.ts` | `lib/sports/resolvers/nflWidgets.ts` | ESPN profile + schedule history | API-Sports NFL, then demo | good | good | limited | `live` | high | tested; good fallback honesty |
| `rb_vs_dline` | NFL | RB vs D-Line | estimate lead RB vs opponent run-defense context | `app/api/widgets/rb-vs-dline/route.ts` | `components/widgets/RbVsDlineWidget.tsx` | `lib/templates/rbVsDline.ts` | none | ESPN next game + recent RB leader + ESPN fixture-style JSON | fixture/demo-like endpoint behavior | weak | weak-moderate | missing | `partial-live` | low | assumption-heavy, older architecture, no dedicated test found |
| `player_card` | Utilities | Player Card | cross-sport player profile and advanced context | live widget uses shared `/api/players/*`; legacy route: `app/api/widgets/player-card/route.ts` | `components/widgets/PlayerCardWidget.tsx` | main widget: none; legacy route uses `lib/templates/playerCard.ts` | shared provider orchestration in `lib/providers/index.ts` | API-Sports hybrid player search/profile/insights | ESPN enrichment/fallback, then fixture | good | good | good | `strong live` | high | actual widget path is stronger than legacy NFL-only route |
| `watchlist` | Utilities | Watchlist | track teams and players with live/recent/next context | no single widget route; uses `/api/watchlist`, `/api/teams/search`, `/api/teams/advanced`, `/api/players/search`, `/api/players/insights` | `components/widgets/WatchlistWidget.tsx` | none | shared provider orchestration plus watchlist persistence route | API-Sports hybrid shared routes | ESPN enrichment/fallback, guest/local storage, fixture | moderate | good | partial-good | `hybrid` | medium | multi-sport UI, but signed-in server persistence is still NFL-teams-only |
| `data_health` | Utilities | Data Health | provider diagnostics and mode/cache status | `app/api/health/data/route.ts` | `components/widgets/DataHealthWidget.tsx` | none | route logic only | ESPN/API-Sports health snapshots | none | weak | moderate | missing | `live` | medium | useful admin widget; does not cover MLB Stats API or BALLDONTLIE |
| `mlb_next_7_games` | MLB | MLB Next 7 Games | show upcoming seven games for a team | `app/api/widgets/mlb-next-7-games/route.ts` | `components/widgets/MlbNext7GamesWidget.tsx` | `lib/templates/mlbNext7Games.ts` | none | MLB Stats API schedule | fixture mode only | good | moderate | missing | `live` | high | simple but solid; tested |
| `mlb_pitcher_arsenal` | MLB | Pitcher Arsenal | pitch mix, velo, and spin for one pitcher | `app/api/widgets/mlb-pitcher-arsenal/route.ts` | `components/widgets/MlbPitcherArsenalWidget.tsx` | `lib/templates/mlbPitcherArsenal.ts` | none | MLB Stats API pitch arsenal | shared player search for name-to-id, then graceful null/partial when arsenal missing | moderate | moderate | missing | `partial-live` | medium | live-backed but sparse upstream coverage; tested |
| `mlb_series_tracker` | MLB | Series Tracker | explain current/upcoming series or spring matchup context | `app/api/widgets/mlb-series-tracker/route.ts` | `components/widgets/MlbSeriesTrackerWidget.tsx` | none | `lib/sports/resolvers/mlbSeriesTracker.ts` | MLB Stats API season schedule/probables | fixture mode only | good | good | good | `strong live` | high | one of the best product widgets in the repo; heavily tested |
| `mlb_starting_pitcher_matchup` | MLB | Starting Pitcher Matchup | compare probable starters for a selected game/team | `app/api/widgets/mlb-starting-pitcher-matchup/route.ts` | `components/widgets/MlbStartingPitcherMatchupWidget.tsx` | none | `lib/sports/resolvers/mlbStartingPitcherMatchup.ts` | MLB schedule/probables + MLB pitcher stats | ESPN fallback for missing probables, fixture mode, partial states | good | good | good | `strong live` | high | flagship widget; tested deeply; contract primary-provider label is slightly misleading |
| `mlb_season_stats` | MLB | Season Stats Explorer | year-by-year player/team season stats | `app/api/widgets/mlb-season-stats/route.ts` | `components/widgets/MlbSeasonStatsWidget.tsx` | none | none | MLB Stats API player/team stats + standings | fixture mode only | good | good | good | `live` | medium-high | useful, but less tested than flagship MLB widgets |
| `mlb_platoon_advantage` | MLB | Platoon Advantage | estimate matchup edge from probable-starter splits or handedness | `app/api/widgets/mlb-platoon-advantage/route.ts` | `components/widgets/MlbPlatoonAdvantageWidget.tsx` | none | none | MLB upcoming schedule + MLB pitcher split stats | handedness-only estimate when split data missing; fixture mode | moderate | good | good | `partial-live` | medium | live path exists, but often degrades to estimate |
| `mlb_recent_form` | MLB | Recent Form Rating | hot/warm/cool/cold recent-form board | `app/api/widgets/mlb-recent-form/route.ts` | `components/widgets/MlbRecentFormWidget.tsx` | none | none | MLB Stats API recent schedule/results | fixture mode only | good | good | good | `live` | medium-high | solid and honest; no dedicated widget test found |
| `mlb_bullpen_fatigue` | MLB | Bullpen Fatigue Tracker | starter rest + reliever availability from recent usage | `app/api/widgets/mlb-bullpen-fatigue/route.ts` | `components/widgets/MlbBullpenFatigueWidget.tsx` | none | none | MLB roster + MLB pitcher game logs | inferred role logic when roster roles are generic; fixture mode | moderate | good | good | `partial-live` | medium | useful but inference-heavy; no dedicated widget test found |
| `mlb_run_expectancy` | MLB | Run Expectancy (RE24) | teach run expectancy and scoring probability by base/out state | `app/api/widgets/mlb-run-expectancy/route.ts` | `components/widgets/MlbRunExpectancyWidget.tsx` | none | none | static RE24 matrix | none; always static/demo-backed | moderate | good | good | `demo fallback dependent` | medium | intentionally educational, not live |
| `nba_tonights_slate` | NBA | NBA Tonight's Slate | show current NBA slate | `app/api/widgets/nba-tonights-slate/route.ts` | `components/widgets/NbaTonightsSlateWidget.tsx` | `lib/templates/nbaTonightsSlate.ts` | none | ESPN scoreboard | fixture mode only | good | good | missing | `live` | high | stable and aligned with product shell; tested |
| `nba_standings` | NBA | NBA Standings | show conference standings snapshot | `app/api/widgets/nba-standings/route.ts` | `components/widgets/NbaStandingsWidget.tsx` | `lib/templates/nbaStandings.ts` | none | ESPN standings | fixture mode only | good | good | missing | `live` | high | stable baseline widget; tested |
| `nba_team_matchup_profile` | NBA | NBA Team Matchup Profile | teach why one matchup shape matters | `app/api/widgets/nba-team-matchup-profile/route.ts` | `components/widgets/NbaTeamMatchupProfileWidget.tsx` | `lib/templates/nbaTeamMatchupProfile.ts` | `lib/sports/resolvers/nbaScaffolds.ts` | BALLDONTLIE live team/game context | API-Sports NBA, then demo scaffold | moderate | moderate | partial | `hybrid` | medium-low | real live context exists, but matchup pillars are still scaffolded; tested honestly |
| `nba_rest_schedule_spot` | NBA | NBA Rest / Schedule Spot | explain rest edge and game-density context | `app/api/widgets/nba-rest-schedule-spot/route.ts` | `components/widgets/NbaRestScheduleSpotWidget.tsx` | `lib/templates/nbaRestScheduleSpot.ts` | `lib/sports/resolvers/nbaScaffolds.ts` | BALLDONTLIE schedule context | API-Sports NBA, then demo scaffold | good | good | partial-good | `hybrid` | medium | strongest experimental NBA widget; tested |
| `nba_player_role_form` | NBA | NBA Player Role + Form | explain a selected player's usage/form context | `app/api/widgets/nba-player-role-form/route.ts` | `components/widgets/NbaPlayerRoleFormWidget.tsx` | `lib/templates/nbaPlayerRoleForm.ts` | `lib/sports/resolvers/nbaScaffolds.ts` | BALLDONTLIE player lookup/stats | API-Sports NBA, then partial or demo scaffold | moderate | good | partial-good | `partial-live` | medium | honest partial-live behavior; tested |

Additional non-library route worth noting:
- `app/api/widgets/mlb-recent-results/route.ts` exists and returns recent results data, but there is no current registry entry or widget component exposing it as a first-class dashboard widget.

## 5. Widget-By-Widget Narrative Audit

### NFL

#### `tonights_slate`

This widget is trying to tell the user what NFL games matter right now without becoming useless in the offseason. The route uses ESPN scoreboard data first, then deliberately falls back to the next slate or most recent slate so the widget remains populated when "tonight" is empty. Reliability is good for a simple context widget because the logic is explicit and offseason-safe, but it is still just a slate card, not a deeper analytics product. Beginner versus advanced separation is thin; advanced mainly adds more metadata like the "learn more" link and slightly richer detail. It does not use the stat explainer. It feels production-usable, but not like a flagship widget, and it would benefit from dedicated tests because none were found in `tests/widgets/**`.

#### `nfl_division_snapshot`

This widget is trying to explain where a team sits in its division and how standings should be interpreted during offseason windows. It uses `resolveNflDivisionSnapshot()` in `lib/sports/resolvers/nflWidgets.ts`, which prefers ESPN team profile/standings context, falls back to API-Sports NFL when needed, and then uses demo data in fixture or failure cases. Reliability is solid because the resolver explicitly handles offseason honesty instead of pretending current standings always exist. Beginner mode gives a readable division board; advanced mode adds denser standings/stat context. The stat explainer is wired well here through `StatLabel`, especially for record, points, and playoff-seed terminology. This feels product-ready and is one of the best current NFL widgets.

#### `nfl_team_context_card`

This widget is trying to answer "what is going on with this team right now?" It uses ESPN profile and schedule first, then API-Sports NFL fallback, then demo data. Reliability is strong because it explicitly supports bye/offseason/no-next-game states and does not collapse when a current game is unavailable. Beginner mode stays compact around team identity, record, and next/last game; advanced mode adds more surrounding context. Stat explainer usage is limited compared with `nfl_division_snapshot`, but the widget still reads clearly. It feels product-ready and should remain part of the NFL baseline.

#### `nfl_recent_form`

This widget is trying to tell the user whether a team is trending up or down and what its recent stretch means. It shares the same ESPN-first -> API-Sports -> demo fallback strategy as the other NFL resolver-based widgets. Reliability is good as long as the upstream schedule/history data is present, and the resolver is honest about offseason handling. Beginner mode surfaces the recent run without too much noise; advanced mode adds denser schedule/context detail. Stat explainer coverage is lighter than in MLB or `nfl_division_snapshot`. This is a good stable NFL widget, though it still feels a step below the best MLB cards in polish.

#### `rb_vs_dline`

This widget is trying to infer how favorable a rushing matchup is for the expected lead back. It uses ESPN for next-game and recent-RB-leader context, then additional ESPN-backed JSON/fixture-style endpoints for roster and run-defense data. Reliability is materially weaker than the newer resolver-based widgets because the lead-back inference is assumption-heavy and the architecture does not look like the stronger route/resolver/template flows elsewhere in the repo. Beginner and advanced mode separation is weak; advanced mostly exposes a little more detail and a link. There is no stat explainer wiring, and there are no dedicated tests in `tests/widgets/**`. This widget is exposed, but it is not currently product-strong.

### Shared / Utilities

#### `player_card`

This widget is trying to be the reusable cross-sport player identity and context surface. The important truth is that the actual widget does not depend on the older `/api/widgets/player-card` route; `PlayerCardWidget.tsx` uses `/api/players/search`, `/api/players/profile`, and `/api/players/insights`, which are backed by the hybrid provider layer in `lib/providers/index.ts`. Reliability is good because the shared provider tracks attempted sources, enrichment, and fallback behavior across API-Sports, ESPN, and fixture. Beginner mode gives a clean identity card; advanced mode unlocks live/recent insights, raw metadata, and richer stat surfaces. The stat explainer is integrated meaningfully. This is one of the strongest building-block widgets in the repo, but the old NFL-only widget route is now a confusing legacy artifact.

#### `watchlist`

This widget is trying to let users curate teams and players across sports and then pull live/recent/next context into one place. It is more complex than a normal widget because it orchestrates shared team/player search routes, advanced team/player insight routes, and persistence through `/api/watchlist` plus guest/local storage. Reliability is mixed: guest mode is flexible and broad, but signed-in persistence is still NFL teams only on the server, which means the UI promise is ahead of the backed persistence model. Beginner mode works as a lightweight tracker; advanced mode is substantially more useful because it loads team advanced data and player insight batches. The stat explainer is present for advanced metric rows. This is useful, but not fully honest as a cross-sport signed-in product until persistence catches up.

#### `data_health`

This widget is trying to expose operational truth: data mode, cache status, provider status, endpoint diagnostics, and hydration/fallback notes. It calls `/api/health/data`, which currently probes ESPN and API-Sports and also infers effective source by running a shared MLB player search probe. Reliability is good for what it actually measures, but the coverage is incomplete because MLB Stats API and BALLDONTLIE do not show up as first-class health surfaces. Beginner mode is intentionally thin; advanced mode is where the widget actually becomes useful. There is no stat explainer. This is a real admin widget, not a flagship product card, and it should stay treated that way.

### MLB

#### `mlb_next_7_games`

This widget is trying to answer a simple but real question: what are this team's next seven games, and who is the probable starter if posted? It pulls directly from `mlbProvider.getNextSevenGames()`, which uses the MLB Stats API schedule path. Reliability is good because the source is direct and simple, but there is no non-MLB live fallback if the schedule endpoint is sparse. Beginner mode is already close to the full value; advanced mode only adds modest detail like game IDs and slightly denser metadata. There is no stat explainer wiring. This is a solid supporting widget rather than a hero card.

#### `mlb_pitcher_arsenal`

This widget is trying to explain a pitcher's pitch mix, velocity, and spin. The route can resolve a name into a pitcher ID through the shared player search layer, but the actual arsenal data comes from the MLB Stats API only. Reliability is mixed because the route handles unsupported pitch-arsenal cases gracefully, but the upstream endpoint itself is sparse and inconsistent by pitcher. Beginner and advanced modes differ only modestly; advanced mostly exposes extra pitch detail. There is no stat explainer. It is legitimately useful when the data exists, but it is not dependable enough yet to be treated as a top-tier widget.

#### `mlb_series_tracker`

This widget is trying to explain the current or upcoming series, not just list games. It uses `resolveMlbSeriesTracker()` and the MLB schedule path as its backbone, then reasons about official series groupings, inferred series, spring matchups, postseason labels, and probable starters. Reliability is high for an MLB context widget because the resolver is doing real domain work and is heavily tested. Beginner mode avoids overstating thin spring-training context; advanced mode adds the richer team totals, run differential, pitching context, and selection controls. The stat explainer is integrated well. This is one of the best current widgets in NashBoard.

#### `mlb_starting_pitcher_matchup`

This widget is trying to tell the user who is starting, which pitcher has the edge, and why. It is the strongest MLB widget because the resolver does real game selection, probable-starter recovery, advanced stat hydration, partial-state handling, and optional custom-pitcher selection in advanced mode. The true source chain is MLB schedule/probables first, then ESPN fallback for missing starter info, with MLB-derived pitcher stat hydration and fixture mode support. Reliability is high, but not fake-perfect; it explicitly surfaces partial states when probables are not posted. Beginner mode is readable and compact, while advanced mode is meaningfully richer with advanced metrics, splits, recent starts, notes, and game selection. The stat explainer is wired thoroughly. This is the clearest current flagship widget in the repo.

#### `mlb_season_stats`

This widget is trying to be a player/team season explorer rather than a one-game card. It pulls player and team season data from MLB provider methods, which in turn read MLB Stats API player/team stats and standings. Reliability is good for the basic stat surfaces because the path is direct, but the widget has less explicit hardening than the two MLB flagships and no dedicated widget test file was found. Beginner mode keeps the tables and summary denser but manageable; advanced mode adds more columns and richer team/player detail. The stat explainer is implemented strongly here, including ranking context for several MLB stat labels. This is useful and credible, but not as battle-tested as the top MLB widgets.

#### `mlb_platoon_advantage`

This widget is trying to explain whether the home or away side owns the handedness/splits edge. It uses the MLB upcoming schedule path to get the next game and then tries to hydrate probable-starter split data from the MLB Stats API. Reliability is only partial-live because split data is not always available; the widget intentionally downgrades to a handedness-based estimate when it cannot compare real splits for both starters. Beginner mode is understandable but fairly lightweight; advanced mode is materially better because it shows more of the split table and reasoning. The stat explainer is present and useful. The widget is credible, but the upstream data gaps keep it in the mid-tier.

#### `mlb_recent_form`

This widget is trying to say whether a team is hot, warm, cool, or cold and back that up with recent-window numbers. It uses MLB schedule/results data from the last 7, 14, and 30-day windows and computes weighted recent-form output in `lib/providers/mlb/teamStats.ts`. Reliability is good because the path is direct and the widget is honest when there are no recent games. Beginner mode gives the headline rating and readable context; advanced mode adds the fuller period breakdown. The stat explainer is well wired for record, run differential per game, and win percentage. This is a solid live-backed widget, though it still needs more direct test coverage.

#### `mlb_bullpen_fatigue`

This widget is trying to estimate whether a bullpen is fresh, available, tired, or fatigued and how the starter rest picture looks. It uses the MLB roster plus pitcher game logs and then infers roles/workload when the upstream roster data is too generic. Reliability is therefore partial-live rather than fully strong live: the data is real, but some classification is inferred. Beginner mode is decent for a quick glance; advanced mode is meaningfully better because it surfaces more pitch-usage, appearance, and starter detail. The stat explainer is strong. This is useful and well intentioned, but it still depends on inference-heavy logic and lacks dedicated tests.

#### `mlb_run_expectancy`

This widget is trying to teach run expectancy rather than report live status. It uses a static RE24 matrix hardcoded in `app/api/widgets/mlb-run-expectancy/route.ts` with `meta.sourceUsed = "demo"`. Reliability is fine because it is intentionally static, but it is not a live-data widget and should not be described that way. Beginner mode is approachable; advanced mode gives more context and derived interpretation. The stat explainer is used well here. This is a legitimate educational/support widget, not a core live product surface.

### NBA

#### `nba_tonights_slate`

This widget is trying to be the NBA equivalent of a clean slate board. It pulls ESPN scoreboard data and shapes it with `shapeNbaTonightsSlate()`. Reliability is good because the ESPN path is straightforward and the widget is not trying to do too much. Beginner versus advanced separation is modest; advanced mostly increases density. There is no stat explainer. This is a stable baseline widget and feels production-ready.

#### `nba_standings`

This widget is trying to show conference standings in a way that still makes sense to normal users. It uses the ESPN NBA standings endpoint and a dedicated template layer. Reliability is good and the use case is clear. Beginner mode is cleaner and shorter; advanced mode shows more rows and detail. There is no stat explainer, so it depends entirely on presentation clarity. This is stable and production-ready, but it is still a baseline widget rather than a differentiator.

#### `nba_team_matchup_profile`

This widget is trying to teach why a matchup shape matters before a game. The resolver prefers BALLDONTLIE live team/game context, falls back to API-Sports NBA, and then returns a demo scaffold if real context cannot be built. Reliability is hybrid rather than fully live because the record/form shell may be real while the "pillar board" remains scaffolded, and the code says that explicitly. Beginner and advanced mode separation exists, but both modes are still constrained by scaffolded pillar logic. The stat explainer is partial and slightly alias-fragile because some labels are generic rather than tightly stat-keyed. This widget is honest and promising, but not yet a fully real matchup engine.

#### `nba_rest_schedule_spot`

This widget is trying to explain whether a team is in a favorable or unfavorable rest/schedule spot. The resolver prefers BALLDONTLIE schedule context, then API-Sports NBA, then demo. Reliability is better than the other two experimental NBA widgets because the live input needed is narrower and more attainable. Beginner mode already works; advanced mode improves it with factor breakdowns and more scheduling detail. The stat explainer is present on factor labels, though still more label-driven than MLB's stronger stat-key usage. This is the strongest of the new experimental NBA widgets and the best candidate for future graduation.

#### `nba_player_role_form`

This widget is trying to explain a selected player's current role and recent form. It uses live player search from `/api/players/search?sport=nba`, then the NBA scaffold resolver prefers BALLDONTLIE player lookup/stats, falls back to API-Sports, and preserves honest partial states when the player is found but stat access is weak. Reliability is therefore partial-live, not fully live. Beginner mode gives the big picture; advanced mode is where the widget becomes significantly more useful through richer metrics, recent-game context, and role signals. The stat explainer is present but not as rigorous as the best MLB widgets. This widget is thoughtfully designed, but its ceiling still depends on provider maturity.

## 6. Interdependency Map

Shared flows and dependencies:
- The widget library, metadata endpoint, and dashboard rendering all depend on `lib/widgets/registry.ts`.
- `DashboardPage.tsx` is the universal shell for mode switching, refresh, persistence, bug reporting, and stat-explainer context.
- `StatExplainerProvider.tsx` and `lib/stats/glossary.ts` are shared across sports and utility widgets.
- `PlayerCardWidget` and `WatchlistWidget` depend on the same shared search/profile/insight/team advanced routes.
- Shared routes depend on `lib/providers/index.ts`, so any provider-policy change there affects multiple widgets at once.
- NFL stable widgets all depend on `lib/sports/resolvers/nflWidgets.ts`.
- Experimental NBA widgets all depend on `lib/sports/resolvers/nbaScaffolds.ts`.
- MLB flagship widgets depend on dedicated MLB resolvers and shared MLB provider helpers; several second-tier MLB widgets depend directly on `lib/providers/mlb/teamStats.ts`.

Common failure patterns:
- provider availability/config gaps cause live -> fallback -> demo transitions
- sparse upstream data creates partial states rather than hard failures in the better widgets
- source metadata can be technically present while still being weakly surfaced in the UI
- tests are concentrated in some widget families, so runtime regressions are more likely in less-tested widgets

Shared weak-provider assumptions:
- shared player/team utilities depend on API-Sports first even for MLB/NBA utility flows
- BALLDONTLIE-backed NBA widgets all share the same live-provider maturity limits
- the stable NFL trio shares ESPN-first assumptions and API-Sports NFL fallback availability
- `watchlist` and `player_card` share the same hybrid provider strengths and weaknesses

## 7. Current Strengths

- MLB is genuinely deep. The repo now contains multiple MLB widgets that are live-backed, product-shaped, and mode-aware.
- `mlb_starting_pitcher_matchup` and `mlb_series_tracker` are real standout widgets with strong resolver logic and strong test coverage.
- NFL is meaningfully better than older docs imply because the repo now includes a stable trio beyond `tonights_slate`.
- NBA stable widgets are credible, and the newer NBA widgets are honest about demo/hybrid/partial-live status instead of hiding it.
- The stat explainer system is one of the better architectural investments in the repo.
- The registry/library/dashboard discipline is good. Widget exposure is centralized rather than ad hoc.
- Shared player/team routes are stronger than some older single-widget routes and give NashBoard a real cross-sport foundation.
- The app generally prefers graceful partial states over crashes in the stronger widgets.

## 8. Current Weaknesses / Risks

- The app is still uneven by widget tier. Some cards are genuinely production-ready, and some are still scaffold-assisted or inference-heavy.
- Cross-sport persistence and metadata honesty lag the UI. The clearest example is `watchlist`.
- Diagnostics are incomplete. `data_health` does not cover MLB Stats API or BALLDONTLIE.
- The hardcoded `sport: "NFL"` widget-creation path in `DashboardPage.tsx` is a real cross-sport correctness issue.
- Provider truth labels are not always precise. Some contracts still hardcode a primary provider that is not the actual data backbone.
- `rb_vs_dline` stands out as older, weaker, and less disciplined than the newer resolver-based widgets.
- Test coverage is uneven. MLB flagships and NBA experimental widgets are well covered; several other surfaced widgets are not.
- Existing docs are partially stale. `CLAUDE.md` and older handoff/planning docs do not fully reflect the current registry and provider posture.

## 9. Provider Truth Table By Widget

| Widget | Real Data Flow |
| --- | --- |
| `tonights_slate` | ESPN scoreboard for today -> ESPN next-slate helper -> ESPN most-recent-slate helper -> fixture mode only when requested |
| `nfl_division_snapshot` | ESPN NFL team profiles/standings -> API-Sports NFL team advanced fallback -> demo/fixture snapshot |
| `nfl_team_context_card` | ESPN NFL team profile + schedule -> API-Sports NFL team advanced/schedule fallback -> demo/fixture card |
| `nfl_recent_form` | ESPN NFL team profile + schedule history -> API-Sports NFL team advanced/schedule fallback -> demo/fixture card |
| `rb_vs_dline` | ESPN next game + recent RB leader + ESPN/fixture-style roster/run-defense endpoints -> offseason empty state / fixture behavior |
| `player_card` | `/api/players/search|profile|insights` -> shared hybrid provider -> API-Sports first -> ESPN enrich/fallback -> fixture fallback |
| `watchlist` teams | `/api/teams/search` + `/api/teams/advanced` -> API-Sports first -> ESPN enrich/fallback -> fixture fallback; signed-in persistence through `/api/watchlist` is NFL-team only |
| `watchlist` players | `/api/players/search` + `/api/players/insights` -> API-Sports first -> ESPN enrich/fallback -> fixture fallback |
| `data_health` | internal diagnostics route -> ESPN health snapshot + API-Sports health snapshot + shared player-search probe; no MLB Stats API or BALLDONTLIE health path |
| `mlb_next_7_games` | MLB Stats API schedule -> fixture mode |
| `mlb_pitcher_arsenal` | shared player search if input is a name -> MLB Stats API pitch arsenal -> graceful null/partial when arsenal unsupported |
| `mlb_series_tracker` | MLB Stats API season schedule/probables -> fixture mode |
| `mlb_starting_pitcher_matchup` | MLB schedule/probables/team identity path -> ESPN probable-starter fallback when MLB path lacks starters -> MLB pitcher stat hydration -> fixture mode / partial state |
| `mlb_season_stats` player mode | MLB Stats API player season stats -> fixture mode |
| `mlb_season_stats` team mode | MLB Stats API team hitting stats + team pitching stats + standings/records -> fixture mode |
| `mlb_platoon_advantage` | MLB next-game schedule -> MLB pitcher split stats -> handedness estimate when split data is missing -> fixture mode |
| `mlb_recent_form` | MLB recent schedule/results -> weighted recent-form calculation -> fixture mode |
| `mlb_bullpen_fatigue` | MLB roster -> MLB pitcher game logs -> inferred starter/reliever role handling when needed -> fixture mode |
| `mlb_run_expectancy` | static RE24 matrix only |
| `nba_tonights_slate` | ESPN NBA scoreboard -> fixture mode |
| `nba_standings` | ESPN NBA standings -> fixture mode |
| `nba_team_matchup_profile` | BALLDONTLIE live context -> API-Sports NBA team advanced fallback -> demo scaffold |
| `nba_rest_schedule_spot` | BALLDONTLIE schedule context -> API-Sports NBA team advanced fallback -> demo scaffold |
| `nba_player_role_form` | shared NBA player search -> BALLDONTLIE player identity/stats -> API-Sports fallback -> partial-live or demo scaffold |

## 10. Beginner Vs Advanced Audit

Widgets with truly meaningful mode separation:
- `mlb_starting_pitcher_matchup`
- `mlb_series_tracker`
- `mlb_season_stats`
- `mlb_recent_form`
- `mlb_bullpen_fatigue`
- `mlb_run_expectancy`
- `player_card`
- `watchlist`
- `nfl_division_snapshot`
- `nfl_team_context_card`
- `nfl_recent_form`

Widgets where advanced mode is real but still constrained by scaffold/live limits:
- `nba_rest_schedule_spot`
- `nba_player_role_form`
- `nba_team_matchup_profile`

Widgets where advanced mode is present but mostly a density/detail increase:
- `tonights_slate`
- `nba_tonights_slate`
- `nba_standings`
- `mlb_next_7_games`
- `mlb_pitcher_arsenal`

Widgets where mode separation is currently weak relative to the product goal:
- `rb_vs_dline`

System-wide conclusion:
- beginner/advanced is a real architecture feature, not just a UI toggle
- the quality of that separation is strongest in MLB and shared utility widgets
- the biggest remaining gap is not the existence of mode support, but making sure advanced mode adds better truth rather than just more fields

## 11. Stat Explainer Audit

Implemented well:
- `mlb_starting_pitcher_matchup`
- `mlb_series_tracker`
- `mlb_season_stats`
- `mlb_recent_form`
- `mlb_bullpen_fatigue`
- `mlb_run_expectancy`
- `nfl_division_snapshot`
- `player_card`
- `watchlist`

Implemented partially but usefully:
- `nba_team_matchup_profile`
- `nba_rest_schedule_spot`
- `nba_player_role_form`
- `mlb_platoon_advantage`

Mostly missing:
- `tonights_slate`
- `rb_vs_dline`
- `nfl_team_context_card`
- `nfl_recent_form`
- `mlb_next_7_games`
- `mlb_pitcher_arsenal`
- `nba_tonights_slate`
- `nba_standings`
- `data_health`

Glossary/alias fragility to note:
- Some NBA widgets pass display labels into `StatLabel` without a stable `statKey`, which makes the explainer experience more dependent on label matching and alias fallback.
- MLB widgets generally use stronger stat-keyed explainer wiring and therefore feel more robust.

System-wide conclusion:
- the stat explainer system itself is strong
- the repo's main gap is coverage discipline, not glossary quality

## 12. Cleanup / Consolidation Candidates

Duplicate or confusing surfaces:
- The legacy `/api/widgets/player-card` route is now weaker and narrower than the actual shared player-card flow.
- `tonights_slate` and `nba_tonights_slate` use inconsistent naming conventions across sports.
- `mlb_recent_results` exists as a backend route but is not a surfaced widget; either expose it intentionally or stop treating it like an active product surface.

Weak widgets that should be hidden, deprioritized, or clearly marked experimental:
- `rb_vs_dline`
- `nba_team_matchup_profile` unless the scaffold/live split is improved further
- `mlb_pitcher_arsenal` if sparse upstream coverage continues to confuse users

Widgets that should stay front-and-center:
- `mlb_starting_pitcher_matchup`
- `mlb_series_tracker`
- `mlb_next_7_games`
- `player_card`
- `nfl_division_snapshot`
- `nfl_team_context_card`
- `nfl_recent_form`
- `nba_tonights_slate`
- `nba_standings`

Utility/admin widgets that should stay secondary:
- `watchlist`
- `data_health`
- `mlb_run_expectancy`

## 13. Known Technical Debt

- `DashboardPage.tsx` still persists new widgets with `sport: "NFL"` regardless of the chosen widget.
- Signed-in `/api/watchlist` persistence is still NFL teams only, while the widget UI is multi-sport and supports players.
- `data_health` only reports ESPN and API-Sports health, not MLB Stats API or BALLDONTLIE.
- Some contract `primaryProvider` labels are not truthful to the underlying path:
  - `/api/widgets/metadata`
  - `/api/widgets/player-card`
  - `/api/widgets/mlb-starting-pitcher-matchup`
- Existing docs are partially stale:
  - `CLAUDE.md` still reflects an older inventory and still describes several NBA widgets as "IN PROGRESS"
  - older handoff/planning docs underrate current NFL coverage
- Test coverage is uneven across surfaced widgets:
  - no dedicated widget tests found for `tonights_slate`, `rb_vs_dline`, `player_card`, `watchlist`, `data_health`, `mlb_season_stats`, `mlb_platoon_advantage`, `mlb_recent_form`, `mlb_bullpen_fatigue`, or `mlb_run_expectancy`
- Existing root handoff doc states an inherited TypeScript issue:
  - `npx tsc --noEmit` reportedly fails in `tests/architecture/canonical-models.test.ts` and `tests/widgets/mlb-starting-pitcher-matchup-widget.test.ts`
  - this audit did not re-run TypeScript, so treat that note as inherited, not revalidated
- Provider/env caveats still matter:
  - `DATABASE_URL` for server persistence
  - auth/session configuration for signed-in mode
  - API-Sports keys for hybrid/team advanced paths
  - `BALL_DONT_LIE_KEY` for live experimental NBA widgets
- The working tree was already not fully clean before this pass because `next-env.d.ts` was modified.

## 14. Immediate Next Passes

### Pass 1: Cross-Sport Truth And Persistence Hardening

Scope:
- align widget creation metadata with actual widget sport
- align `watchlist` signed-in persistence with the current multi-sport UI
- tighten source/provider labels where contracts are currently misleading
- extend health/diagnostic truth so MLB Stats API and BALLDONTLIE are no longer invisible

Why it matters:
- this is the single clearest gap between what the UI promises and what the repo actually guarantees

Likely files/areas:
- `components/dashboard/DashboardPage.tsx`
- `app/api/watchlist/route.ts`
- `app/api/health/data/route.ts`
- `app/api/widgets/metadata/route.ts`
- `app/api/widgets/player-card/route.ts`
- `app/api/widgets/mlb-starting-pitcher-matchup/route.ts`
- possibly Prisma/auth watchlist persistence surfaces

Best owner:
- plan here first for acceptance boundaries, then implement with Codex

### Pass 2: NBA Experimental Widget Hardening

Scope:
- reduce scaffold dependence in `nba_team_matchup_profile`
- strengthen live-path confidence for `nba_player_role_form`
- decide whether `nba_rest_schedule_spot` is ready to graduate from experimental

Why it matters:
- NBA now has credible baseline coverage; the next question is whether the experimental widgets become truly product-useful or stay teaching scaffolds

Likely files/areas:
- `lib/sports/resolvers/nbaScaffolds.ts`
- `lib/providers/balldontlie/**`
- `app/api/widgets/nba-team-matchup-profile/route.ts`
- `app/api/widgets/nba-rest-schedule-spot/route.ts`
- `app/api/widgets/nba-player-role-form/route.ts`
- corresponding widget components/templates/tests

Best owner:
- Codex after a quick Claude Code review of scope and provider limits

### Pass 3: MLB Second-Tier Verification Pass

Scope:
- add coverage for MLB widgets that are live-backed but under-tested
- verify recent-form, bullpen-fatigue, platoon-advantage, season-stats, and run-expectancy contracts/UI behavior

Why it matters:
- MLB is the benchmark vertical, but several MLB widgets are trusted more by architecture than by current test surface

Likely files/areas:
- `tests/widgets/mlb-*.test.ts`
- `components/widgets/Mlb*.tsx`
- `app/api/widgets/mlb-*/route.ts`
- `lib/providers/mlb/teamStats.ts`

Best owner:
- Codex

### Pass 4: NFL Experimental Cleanup

Scope:
- either harden `rb_vs_dline` into the newer resolver/fallback pattern or clearly demote it
- add direct widget tests for `tonights_slate` and `rb_vs_dline`

Why it matters:
- the stable NFL trio is now decent; `rb_vs_dline` is the outlier that still makes NFL feel inconsistent

Likely files/areas:
- `app/api/widgets/rb-vs-dline/route.ts`
- `components/widgets/RbVsDlineWidget.tsx`
- `lib/templates/rbVsDline.ts`
- `tests/widgets/*`

Best owner:
- Claude Code review first, then Codex implementation

### Pass 5: Inventory And Naming Consolidation

Scope:
- decide what to do with `mlb_recent_results`
- decide whether the legacy player-card route should remain public
- normalize widget naming conventions and stale docs

Why it matters:
- future chats will move faster if the exposed product inventory matches the real architecture and docs

Likely files/areas:
- `lib/widgets/registry.ts`
- `lib/widgets/widgetType.ts`
- `app/api/widgets/player-card/route.ts`
- `docs/**`
- route exposure/library docs

Best owner:
- plan here first, then Codex

## 15. New-Chat Handoff Section

### Paste this into a new chat to continue NashBoard

NashBoard is a Next.js sports analytics dashboard built around addable widgets with `BEGINNER` and `ADVANCED` modes. Current repo state is strongest in MLB, credible in stable NBA, and improved but still thinner in NFL. The best current widgets are `mlb_starting_pitcher_matchup`, `mlb_series_tracker`, `mlb_next_7_games`, `player_card`, and the stable NFL trio (`nfl_division_snapshot`, `nfl_team_context_card`, `nfl_recent_form`). NBA stable widgets (`nba_tonights_slate`, `nba_standings`) are solid; the newer NBA widgets are honest hybrid/scaffold widgets backed by BALLDONTLIE with API-Sports fallback.

Important current truth:
- branch was `feat/nfl-provider-parity` during the audit
- there was a pre-existing uncommitted change in `next-env.d.ts`
- `watchlist` UI is multi-sport but signed-in `/api/watchlist` persistence is still NFL-team only
- `DashboardPage.tsx` still persists new widgets with `sport: "NFL"`
- `data_health` only covers ESPN and API-Sports, not MLB Stats API or BALLDONTLIE
- some routes still hardcode `primaryProvider` labels that do not match the real source chain

Best next pass:
- do a cross-sport truth/persistence hardening pass before adding more features
- specifically fix widget sport persistence, fix `watchlist` signed-in scope, tighten provider/source metadata honesty, and extend diagnostics to MLB Stats API + BALLDONTLIE

Important constraints for the next assistant:
- do not assume older docs are fully current; check `lib/widgets/registry.ts`, `components/dashboard/DashboardPage.tsx`, `lib/providers/index.ts`, `lib/sports/resolvers/nflWidgets.ts`, `lib/sports/resolvers/nbaScaffolds.ts`, `lib/sports/resolvers/mlbStartingPitcherMatchup.ts`, and `lib/sports/resolvers/mlbSeriesTracker.ts`
- preserve honest live/partial/demo distinctions
- do not rewrite provider policy casually; MLB should stay MLB-first, NFL should stay ESPN-first with API-Sports fallback, and NBA experimental widgets should stay honest about scaffold/live limits
