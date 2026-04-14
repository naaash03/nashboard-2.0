# NashBoard 2.0 Fresh Chat Handoff

Audit basis: repo root only, current on-disk state as of 2026-04-14.

Important repo note:
- The active app is the repo root.
- The nested `nashboard-2.0/` directory is deferred sidecar material. Ignore it unless a future pass explicitly says otherwise.
- The working tree is not clean. Recent NBA/BALLDONTLIE work exists on disk but is still uncommitted. Fresh chats should treat the current disk state, not only committed history, as the baseline.

## 1. Project purpose

### What NashBoard is
NashBoard is a modular sports analytics dashboard built in Next.js. Users add widgets to a personal dashboard, switch widgets between `BEGINNER` and `ADVANCED` modes, and run in signed-in or guest/session-only mode.

### Beginner vs Advanced philosophy
- Beginner mode is supposed to be readable, guided, and low-noise.
- Advanced mode is supposed to reveal deeper context, diagnostics, and richer stat surfaces without changing the product into an admin console.
- The best widgets are not just denser in advanced mode; they explain why a number matters and where it came from.

### Why the app exists
The product goal is "sports analytics for normal fans." It sits between shallow scoreboard apps and expert-only stat tools. The app is trying to make advanced context usable without requiring users to already know the analytics vocabulary.

## 2. Current product state

### Which sports are meaningfully supported right now
- MLB: strongest and deepest vertical by a clear margin.
- NBA: now credible as a second sport. Core live widgets exist, and three new teaching widgets are present, but two of those still rely partly on scaffolds.
- NFL: only basic coverage right now. It has useful core/shared support, but it does not yet have parity with MLB or NBA.

### Which areas feel polished
- Dashboard shell: polished enough to feel like a real product surface.
- Widget library: usable, categorized, and metadata-driven.
- MLB widget suite: current reference standard for product quality.
- Shared explainer layer: `StatExplainerProvider`, glossary fallback, and MLB ranking support are present and real.

### Which areas are still utility/admin-like
- `watchlist`: useful, but it should remain a utility widget, not a hero feature.
- `data_health`: explicitly admin/diagnostic.
- Some shared routes and fallbacks are more mature than the product surfaces that use them.

### Which widgets are the current reference standard
- `mlb_starting_pitcher_matchup`
- `mlb_series_tracker`
- `mlb_next_7_games`
- Dashboard shell itself
- `nba_tonights_slate` and `nba_standings` now visually align much better with the MLB standard, but they are still not the flagship widgets.

## 3. Major completed work from the recent multi-day workflow

### MLB widget polish
- MLB became the strongest vertical in the app.
- The MLB suite now includes schedule, matchup, series, season stats, platoon, recent form, bullpen fatigue, and run expectancy coverage.
- `mlb_starting_pitcher_matchup` and `mlb_series_tracker` were hardened into product-real widgets rather than rough data dumps.

### Dashboard shell polish
- The main dashboard is now a coherent product shell rather than a dev sandbox.
- Header, guest/signed-in status banner, add/remove/lock/reset controls, and bug-report flow are all in place.

### Shared widget polish
- `player_card`, `watchlist`, and `data_health` were cleaned up significantly.
- The shared layer now leans harder on canonical routes and trust-oriented metadata instead of raw provider leakage.

### Shared data trust / team identity fixes
- The hybrid provider layer (`lib/providers/index.ts`) now does real API-Sports -> ESPN -> fixture merging for shared player/team surfaces.
- Team identity and provider-id reconciliation improved enough for multi-sport shared widgets to be usable.
- Legacy widget-key compatibility was preserved for saved dashboards where needed.

### NBA widget polish
- `nba_tonights_slate` and `nba_standings` were rewritten/polished to match the MLB visual/product standard much more closely.
- They now feel like real dashboard widgets rather than temporary placeholders.

### New NBA widget scaffolding
- Three NBA teaching widgets were added:
  - `nba_team_matchup_profile`
  - `nba_rest_schedule_spot`
  - `nba_player_role_form`
- These were scaffolded first with honest demo/fixture data so they render correctly even without a new provider key.

### BALLDONTLIE live-data enrichment pass
- A narrow BALLDONTLIE provider layer was added in `lib/providers/balldontlie/*`.
- The three new NBA widgets now have first live-backed paths where feasible.
- Current status:
  - `nba_rest_schedule_spot`: strongest BALLDONTLIE integration
  - `nba_team_matchup_profile`: live records/form, scaffolded matchup pillars
  - `nba_player_role_form`: live lookup, live stats when available, honest partial fallback when stats-tier access is missing

## 4. Current widget inventory by category

### MLB
Library-exposed:
- `mlb_next_7_games`
- `mlb_pitcher_arsenal`
- `mlb_series_tracker`
- `mlb_starting_pitcher_matchup`
- `mlb_season_stats`
- `mlb_platoon_advantage`
- `mlb_recent_form`
- `mlb_bullpen_fatigue`
- `mlb_run_expectancy`

Backend-only / not surfaced as a dashboard widget:
- `mlb_recent_results` route exists, but there is no current widget component/registry entry.

Notes:
- MLB is the current product-quality benchmark.
- `mlb_run_expectancy` is useful educationally, but it is not a hero widget.

### NBA
Library-exposed:
- `nba_tonights_slate`
- `nba_standings`
- `nba_team_matchup_profile`
- `nba_rest_schedule_spot`
- `nba_player_role_form`

Notes:
- `nba_tonights_slate` and `nba_standings` are stable.
- The three newer NBA widgets are all marked experimental, and that is appropriate.

### NFL
Library-exposed:
- `tonights_slate`
- `rb_vs_dline`

Notes:
- NFL coverage is still thin relative to MLB and NBA.
- `rb_vs_dline` is still experimental and advanced-leaning.

### Shared / Utility
Library-exposed:
- `player_card`
- `watchlist`
- `data_health`

Notes:
- `player_card` is one of the most important cross-sport building blocks.
- `watchlist` is useful but should stay secondary.
- `data_health` is admin-like and not a user-facing hero feature.

### Duplicates, weak widgets, and deprioritized surfaces
- Duplicate starting-pitcher exposure was cleaned up. The canonical user-facing key is now `mlb_starting_pitcher_matchup`.
- Legacy alias support still exists for saved dashboards:
  - `mlb-starting-pitcher-matchup` -> `mlb_starting_pitcher_matchup`
  - `mlb-series-tracker` -> `mlb_series_tracker`
- Weak/deprioritized surfaces:
  - `data_health`
  - `watchlist` as a hero candidate
  - `mlb_run_expectancy` as a major roadmap driver
  - `mlb_recent_results` until it gets a real surfaced widget

## 5. Live vs demo/fixture status

Important truth:
- Almost nothing in NashBoard is "pure live with no fallback." The app is intentionally built around cache/fallback/truthful partial states.

### Mostly live-backed
- `tonights_slate` (NFL, ESPN live with offseason-safe fallback behavior)
- `player_card` shared APIs (`/api/players/*`) via hybrid API-Sports/ESPN/fixture routing
- `mlb_next_7_games`
- `mlb_series_tracker`
- `mlb_starting_pitcher_matchup`
- `mlb_season_stats`
- `mlb_platoon_advantage`
- `mlb_recent_form`
- `mlb_bullpen_fatigue`
- `mlb_pitcher_arsenal` (live-backed, but specific pitcher coverage can still fail)
- `nba_tonights_slate`
- `nba_standings`

### Partially live-backed
- `watchlist`: live shared APIs, but signed-in persistence is still NFL-only
- `rb_vs_dline`: real route and ESPN-backed inputs, but still feels experimental and assumption-heavy
- `nba_team_matchup_profile`: live team records/recent form when BALLDONTLIE is available, but the matchup pillars remain scaffolded
- `nba_player_role_form`: live player lookup and sometimes live game-log/stat-backed form, but it can degrade to roster-context-only if the BALLDONTLIE stats path is unavailable

### Live-backed only when explicitly configured/selected
- `nba_rest_schedule_spot`: strongest live BALLDONTLIE widget, but only when a `teamKey` is provided and `BALL_DONT_LIE_KEY` is configured
- `nba_player_role_form`: only attempts BALLDONTLIE live mode when a player is selected

### Demo/fixture-backed or intentionally static
- `mlb_run_expectancy`: static educational data, not a live provider widget
- NBA scaffold widgets when no BALLDONTLIE key is present or no live selection is provided

### Fallback-heavy areas
- Shared player/team routes in `lib/providers/index.ts`
- NFL offseason-safe slate behavior
- New NBA teaching widgets
- `mlb_pitcher_arsenal` when MLB Stats API coverage is sparse

## 6. Data sources and API status

### ESPN unofficial
- Used for now:
  - NFL slate
  - NBA slate and standings
  - shared player/team fallback and enrichment
  - team status
- Integration status: already integrated deeply
- Partial or complete: complete as a core source, but still a fallback/enrichment source in many shared flows
- Planned next: likely still central for free live support, especially NFL and NBA

### MLB Stats API
- Used for now:
  - most MLB widgets
  - MLB stat/ranking support in `/api/stat-ranking`
- Integration status: already integrated deeply
- Partial or complete: strongest fully integrated provider in the repo
- Planned next: continue using it as the main MLB truth source

### API-Sports
- Used for now:
  - hybrid shared player/team routes
  - team advanced data
  - some MLB matchup resolution paths
- Integration status: already integrated, but not as the only source
- Partial or complete: partial; it is important but not trusted alone for many surfaces
- Planned next: likely continue as optional first-pass live source where it adds value, but not a broad rewrite target

### BALLDONTLIE
- Used for now:
  - newly added NBA live enrichment paths
  - `nba_rest_schedule_spot`
  - `nba_team_matchup_profile`
  - `nba_player_role_form`
- Integration status: newly integrated, narrow scope only
- Partial or complete: partial
- Planned next:
  - richer NBA team split data if feasible
  - better player stat coverage
  - health/diagnostic integration if the provider stays

### The Odds API
- Used for now: not used
- Integration status: not integrated in the active root app
- Partial or complete: not started
- Planned next: only after core multi-sport usefulness is stronger

### OpenWeather
- Used for now: not used
- Integration status: not integrated
- Partial or complete: not started
- Planned next: optional future context layer only, not a current priority

### Groq
- Used for now: not used
- Integration status: not integrated
- Partial or complete: not started
- Planned next: possible future AI layer, but there is no current root-app implementation

### Gemini
- Used for now: not used
- Integration status: not integrated
- Partial or complete: not started
- Planned next: future idea only; no current code path in the active root app

## 7. Key technical debt / known limitations

- The working tree is dirty. Fresh chats should inspect `git status` before doing anything and treat current on-disk files as the real baseline.
- `npx tsc --noEmit` still fails because of pre-existing unrelated tests:
  - `tests/architecture/canonical-models.test.ts`
  - `tests/widgets/mlb-starting-pitcher-matchup-widget.test.ts`
- `npm run build` does pass.
- The new NBA widgets are still partly scaffolded.
- Some routes are still very current-day oriented:
  - team status and watchlist context are still strongly today-window focused
  - NFL slate is today-first with next-slate fallback, which is good product behavior but not broad schedule coverage
- Fallback/demo behavior is still prominent in shared routes and new NBA widgets.
- `data_health` only reports ESPN and API-Sports health. It does not currently expose MLB Stats API or BALLDONTLIE health in the same way.
- Legacy/compatibility logic still exists:
  - widget key aliasing in `lib/widgets/widgetType.ts`
  - older route surfaces such as `/api/search/players` and `/api/widgets/player-card`
- Signed-in persistence is still narrower than the multi-sport UI:
  - `/api/watchlist` is still NFL-only for signed-in saves
  - `/api/favorites` still stores favorites as NFL-only
- `DashboardPage` still carries a top-level hardcoded `sport` state of `"NFL"` when creating widgets.
- BALLDONTLIE currently has a narrow provider layer and in-memory cache, not the same persistent-cache/diagnostic maturity as ESPN and MLB.

## 8. Product direction

### What NashBoard should focus on next
- Build basic NFL parity so the app feels truly multi-sport.
- Consolidate confusing or duplicate widget surfaces before layering on AI.
- Keep strengthening trustworthy live context and honest fallbacks.
- Add odds-aware/predictive work only after the base multi-sport product is more coherent.

### Which widgets are hero features
- `mlb_starting_pitcher_matchup`
- `mlb_series_tracker`
- `mlb_next_7_games`
- `player_card`
- The best near-term NBA hero candidates are:
  - `nba_tonights_slate`
  - `nba_standings`
  - eventually `nba_rest_schedule_spot` once live coverage is fully trusted

### Which widgets are utilities only
- `watchlist`
- `data_health`
- `mlb_run_expectancy`
- any future debugging or admin-only surfaces

### Why AI should come after multi-sport usefulness is stronger
AI will only be worth the cost if the underlying sports context is trustworthy and broad enough to analyze. Right now the bigger gap is not "lack of AI"; it is sport parity, widget clarity, and live-data completeness.

## 9. Cost constraints

The app should stay effectively free or near-zero-cost while it expands.

That means:
- keep leaning on free/low-cost sources first:
  - ESPN unofficial
  - MLB Stats API
  - built-in glossary/ranking logic
- use optional keyed providers sparingly:
  - API-Sports
  - BALLDONTLIE
- avoid expensive always-on polling or background AI jobs
- keep AI usage on-demand, targeted, and tied to specific high-value widgets
- preserve fixture/demo paths so the product remains usable even when a paid/optional key is absent

## 10. Fresh-chat onboarding instructions

### What a new ChatGPT chat should know immediately
- The repo root is the active app.
- Ignore `nashboard-2.0/`.
- The working tree is dirty because recent NBA/BALLDONTLIE work exists on disk and is not yet committed.
- Start from the current registry, dashboard shell, provider layer, and the three NBA BALLDONTLIE files rather than re-auditing the whole repo.

Recommended first reads:
- `lib/widgets/registry.ts`
- `components/dashboard/DashboardPage.tsx`
- `lib/providers/index.ts`
- `lib/sports/resolvers/nbaScaffolds.ts`
- `lib/providers/balldontlie/*`
- `app/api/widgets/nba-*`

### What a new Claude chat should know immediately
- Use the root app only.
- Treat the current handoff plus `git status` as the starting point.
- Claude is especially useful here for pass planning, cleanup scoping, and review of cross-file consistency before implementation starts.

### How to continue work without re-auditing everything from scratch
1. Read this file first.
2. Run `git status --short` and note that the NBA/BALLDONTLIE pass is present but uncommitted.
3. Read `NASHBOARD_NEXT_PASS_RECOMMENDATIONS.md`.
4. For implementation, inspect only the files relevant to the chosen pass.
5. Do not reopen the sidecar or restart broad repo auditing unless a pass explicitly requires it.
