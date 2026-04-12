# NashBoard 2.0 Project Report

Audit date: 2026-04-09

## Scope And Evidence Notes

This report is a documentation-only audit of the repository state in `c:\Users\Adam\Desktop\nashboard-2.0-main`.

- Primary truth source for current behavior: the repo root application (`app/`, `components/`, `lib/`, `prisma/`, `tests/`, `docs/`).
- Important caveat: the nested `nashboard-2.0/` directory contains an additional copy of the project with extra systems, including a richer stat glossary/ranking stack. Those files are not wired into the active root app and are treated here as sidecar evidence only.
- Git history in the current checkout is not reliable evidence. `git log` reported that the current `main` branch has no commits. Phase reports in `docs/` include dates and branch names, but those should be treated as documentary evidence, not as independently verified git history from this workspace.

## A. Executive Summary

NashBoard 2.0 is a customizable sports analytics dashboard intended to make advanced sports data understandable for everyday fans without removing depth for advanced users. The repo strongly supports that thesis through:

- explicit `BEGINNER` vs `ADVANCED` widget modes in the persistence model (`prisma/schema.prisma`) and in widget props/components
- a dashboard shell with add/remove/layout persistence (`components/dashboard/DashboardPage.tsx`, `app/api/dashboard/*`, `lib/guest/guestDashboard.ts`)
- shared player/team lookup and enrichment routes (`app/api/players/*`, `app/api/teams/*`)
- hybrid data sourcing and fallback infrastructure (`lib/providers/index.ts`, `lib/dataMode.ts`, `lib/sports/*`)
- growing MLB, NBA, and NFL widget coverage

Who it appears to be for:

- casual fans who need plain-language summaries and reduced UI noise
- advanced fans who want richer context, diagnostics, and deeper stat detail
- engineers building a modular sports-data dashboard platform rather than isolated one-off widgets

What makes it different in repo terms:

- it treats widgets as persisted, modular dashboard units rather than standalone pages
- it has a real dual-mode UX model instead of a cosmetic "advanced toggle"
- it includes a canonical contract layer meant to decouple UI from raw provider payloads (`docs/WIDGET_DATA_CONTRACTS.md`, `lib/sports/models/types.ts`, `lib/sports/resolvers/contracts.ts`)
- it is unusually explicit about fallback, fixture mode, health diagnostics, and data-source truthfulness

Current maturity level:

- best described as an advanced prototype / pre-production application
- the repo has strong engineering intent: strict TypeScript, Prisma migrations, NextAuth, health routes, fallback policy, and 43 current `*.test.ts` files
- it is not fully converged yet: there are active mismatches between UI and persistence scope, between implemented widgets and registry exposure, and between the active root app and the nested sidecar copy

## B. Product Vision

### Why The Project Exists

The repo consistently pushes toward "advanced sports data, explained honestly." That shows up in:

- plain-language copy and learn-more links in widgets such as `components/widgets/PlayerCardWidget.tsx` and `components/widgets/RbVsDlineWidget.tsx`
- beginner/advanced rendering branches in major widgets
- a glossary persistence model (`GlossaryTerm` in `prisma/schema.prisma`) and a root glossary API (`app/api/glossary/route.ts`)
- data health visibility (`app/api/health/data/route.ts`, `components/widgets/DataHealthWidget.tsx`)

The likely product problem being solved is that mainstream sports interfaces are either:

- too shallow for users who want context, or
- too technical for users who want help understanding what a stat means and when to trust it

### Beginner Vs Advanced Mode Philosophy

The mode split is real, not just aspirational.

Observed behavior in the root app:

- `Player Card` beginner mode stays closer to profile + essential context; advanced mode pulls `/api/players/insights` and exposes richer sections and Admin / Debug diagnostics.
- `Watchlist` beginner mode emphasizes compact high-confidence team/player summaries; advanced mode loads `/api/teams/advanced` and `/api/players/insights/batch`.
- `Data Health` hides deep provider diagnostics unless advanced mode is active.
- MLB and NBA widgets generally keep the same data path but reveal extra identifiers, notes, or deeper sections in advanced mode.

This supports a product philosophy of:

- beginner mode = confidence, clarity, smaller cognitive load
- advanced mode = richer context, source nuance, diagnostics, and deeper stat surfaces

### Core UX Goals Visible In Code

- allow users to compose their own dashboard from widgets (`components/widgets/WidgetLibrary.tsx`, `app/api/dashboard/widgets/route.ts`)
- persist layouts for signed-in users, but still work in guest mode (`components/dashboard/DashboardPage.tsx`, `lib/guest/guestDashboard.ts`)
- expose live and historical context while staying resilient to provider gaps (`lib/providers/index.ts`, `lib/sports/utils/fixturePolicy.ts`)
- prefer honest empty/partial states over pretending data is complete (`docs/PHASE_1_5_REPORT.md`, `docs/PHASE_2_REPORT.md`, `docs/PHASE_2_5_REPORT.md`)

## C. Tech Stack

### Framework And Language

- Next.js `16.0.3` with App Router
- React `19.2.0`
- TypeScript `^5` with `strict: true` (`tsconfig.json`)
- Tailwind CSS v4

### Database And Auth

- PostgreSQL via Prisma 7 (`prisma/schema.prisma`, `lib/db/prisma.ts`)
- NextAuth v5 beta (`auth.ts`)
- Prisma adapter is used only when auth and DB are both configured
- optional Google OAuth
- local/dev admin credentials mode when `DEV_ADMIN_ENABLED=true`

### Testing And Quality Tooling

- Vitest (`vitest.config.ts`) in `node` environment
- ESLint 9 + `eslint-config-next`
- 43 current `*.test.ts` files under `tests/`
- no Playwright, Cypress, or browser e2e framework was visible

### Deployment / Runtime Assumptions

Visible assumptions from `README.md`, `.env.example`, `docs/LOCAL_SETUP.md`, and scripts:

- Node.js 20+
- local development expects either:
  - guest-only mode with no DB/auth
  - Docker-backed Postgres
  - external Postgres fallback
- host/origin correctness matters for auth and cookies; the repo explicitly documents LAN host pitfalls and includes `/api/health/origin`

### External Data Sources Used In Active Root Code

- ESPN endpoints for player search/profile/insights, scoreboard, standings, and slate flows
- API-Sports endpoints for hybrid player/team search and team advanced enrichment
- MLB Stats API for MLB widgets and MLB-specific provider logic
- fixtures under `tests/fixtures/**` for deterministic test and fixture-mode responses

### Important Environment / Setup Mismatch

There is a real inconsistency between setup artifacts:

- `.env.example` and `README.md` use `postgresql://postgres:postgres@localhost:5432/nashboard`
- `docker-compose.yml` starts Postgres on host port `5433` with `admin/admin`

This is a repo-backed setup risk, not just a cosmetic docs issue.

## D. System Architecture

### Practical Architecture Summary

| Layer | Primary files | What it does | Notes |
| --- | --- | --- | --- |
| App shell | `app/page.tsx`, `components/dashboard/DashboardPage.tsx` | Loads dashboard state, decides guest vs signed-in flow, renders widget grid | Current shell is client-heavy |
| Widget library / registry | `components/widgets/WidgetLibrary.tsx`, `lib/widgets/registry.ts`, `app/api/widgets/metadata/route.ts` | Defines what widgets are surfaced to users and how they are categorized | Registry does not currently expose every implemented widget |
| Widget components | `components/widgets/*` | Fetch widget-specific or shared APIs, render beginner/advanced UI | Several files are large and stateful |
| Shared APIs | `app/api/players/*`, `app/api/teams/*`, `app/api/watchlist/*`, `app/api/favorites/*`, `app/api/preferences/data-mode/route.ts` | Reusable search/profile/insights/status/persistence endpoints | This is the backbone for Player Card and Watchlist |
| Widget APIs | `app/api/widgets/*` | Widget-specific routes for slate, MLB, NBA, and metadata | Contract maturity is uneven across widgets |
| Provider / resolver layer | `lib/providers/*`, `lib/sports/*` | Fetches from ESPN / API-Sports / MLB / fixtures, normalizes, merges, annotates metadata | `lib/providers/index.ts` is the core hybrid router |
| Persistence | `app/api/dashboard/*`, `lib/guest/*`, Prisma models | Persists dashboard, widget config, watchlist, favorites, and data-mode preference | Signed-in and guest paths intentionally differ |

### Frontend Structure

The active frontend is centered on one shell component:

- `app/page.tsx` passes `authConfigured` and `dbConfigured` into `components/dashboard/DashboardPage.tsx`
- `DashboardPage` chooses guest vs signed-in mode, fetches dashboard data, tracks refresh cadence, and renders widgets using a hardcoded `WIDGET_COMPONENTS` map
- widget instances carry `widgetType`, `mode`, coordinates, and `config`
- guest users are backed by `sessionStorage`; signed-in users are backed by API routes and Prisma

Important current limitation:

- `DashboardPage` keeps `const [sport] = useState<Sport>("NFL")` and posts that sport value when creating persisted widgets
- this means the top-level persisted add-widget path is still NFL-centered even though the app now has MLB and NBA widgets

### Backend / API Structure

The backend is split into:

- widget-agnostic shared APIs:
  - players: `search`, `profile`, `insights`, `insights/batch`
  - teams: `search`, `status`, `status/batch`, `advanced`
  - user systems: dashboard, watchlist, favorites, data-mode preference
- widget-specific APIs:
  - NFL: tonight's slate, RB vs D-Line, legacy player card route
  - NBA: tonight's slate, standings
  - MLB: next 7 games, pitcher arsenal, starting pitcher matchup, series tracker, season stats, platoon advantage, recent form, bullpen fatigue, run expectancy, recent results

### Data Flow: Metadata To UI

The intended path in the root repo is:

1. Widget registry is defined in `lib/widgets/registry.ts`.
2. `app/api/widgets/metadata/route.ts` serves registry data and a canonical `contract` payload.
3. `DashboardPage` or `WidgetLibrary` uses widget keys to create/persist widget instances.
4. A widget component calls either:
   - a widget-specific route under `app/api/widgets/*`, or
   - shared player/team routes under `app/api/players/*` and `app/api/teams/*`.
5. Route handlers call providers or resolvers.
6. Providers normalize and annotate upstream responses with `meta`, mode, source, fallback, and warning data.
7. Widgets render different levels of detail depending on `props.mode`.

The canonical contract work is visible and real, but not yet universal. Some routes return both legacy `data` plus `contract`; others still return only `{ data, meta }`.

### Persistence Model

There are two distinct persistence paths:

- guest mode:
  - `lib/guest/guestDashboard.ts` stores dashboard layout/widgets in `sessionStorage`
  - `lib/guest/watchlist.ts` stores a lightweight guest watchlist with MVP-era constraints
- signed-in mode:
  - `Dashboard`, `WidgetInstance`, `WatchlistTeam`, `FavoritePlayer`, `CachedResponse`, and `GlossaryTerm` are stored in Postgres via Prisma
  - `app/api/dashboard/*` persists layout lock, widgets, and sharing fields
  - `app/api/preferences/data-mode/route.ts` persists data-mode preference using `CachedResponse`

### Caching And Fallback Behavior

Caching and fallback are first-class concerns in the repo.

- `lib/sports/cachePolicy.ts` defines TTLs by logical endpoint type
- ESPN and MLB clients both use in-memory cache plus persistent cache via `CachedResponse`
- API-Sports client uses in-memory cache and endpoint health snapshots
- `lib/dataMode.ts` resolves effective mode with precedence:
  - explicit `dataMode` query
  - persisted preference mode
  - fallback `auto`
- `lib/sports/utils/fixturePolicy.ts` controls when automatic fixture fallback is allowed

### Normalization And Adapter Patterns

Canonical boundaries were introduced deliberately in Phase 1:

- canonical types live in `lib/sports/models/types.ts`
- provider-specific normalizers live in `lib/sports/adapters/normalizers.ts`
- stable widget envelopes are created through `lib/sports/resolvers/contracts.ts`
- shared resolver exports live in `lib/sports/resolvers/index.ts`

This is one of the strongest architectural choices in the repo.

### How Widgets Are Registered And Rendered

Current root behavior uses two related but not fully aligned systems:

- registry exposure:
  - `lib/widgets/registry.ts`
  - `app/api/widgets/metadata/route.ts`
- actual render map:
  - `components/dashboard/DashboardPage.tsx`

The render map includes more MLB widgets than the registry exposes. That means the codebase currently distinguishes between:

- widgets implemented in component/API form
- widgets currently discoverable via the library metadata surface

## E. Core Shared Systems

### Auth And Session Handling

Primary files:

- `auth.ts`
- `lib/auth.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/error/route.ts`
- `components/AppProviders.tsx`

Behavior:

- auth is optional
- if core auth + DB are configured, the Prisma adapter is enabled
- if `DEV_ADMIN_ENABLED=true`, a credentials provider allows `admin` / `admin` and upserts `admin@nashboard.local`
- session strategy is `database` only when adapter-backed auth is active; otherwise JWT is used
- the app can run without auth configured at all

Assessment:

- this is a production-minded pattern because the app can degrade cleanly into guest mode instead of failing at startup

### Prisma / Database Layer

Primary files:

- `prisma/schema.prisma`
- `lib/db/prisma.ts`
- `lib/prisma.ts`
- `prisma/migrations/*`

What exists now:

- users, accounts, sessions, verification tokens
- dashboard and widget instances
- watchlist teams
- favorite players
- glossary terms
- cached responses

Notable characteristics:

- `lib/db/prisma.ts` throws through a proxy if code touches Prisma without `DATABASE_URL`
- current schema includes dashboard sharing fields (`shareScope`, `shareToken`, `invitedEmails`)
- migrations show meaningful schema evolution, including at least one major reset/re-initialization cycle

### Dashboard / Widget Persistence

Primary files:

- `app/api/dashboard/route.ts`
- `app/api/dashboard/widgets/route.ts`
- `app/api/dashboard/widgets/[id]/route.ts`
- `components/dashboard/DashboardPage.tsx`
- `lib/guest/guestDashboard.ts`

What works:

- signed-in users get a created-on-demand dashboard record
- widgets persist position, size, mode, config, and optional `playerId`
- guest users can still add/remove/reorder/lock/reset widgets per browser session

What is only partially surfaced:

- backend sharing exists, and `DashboardPage` displays a raw `?shareToken=` string when present
- a richer sharing UI is not obvious from the current root app

### Search / Player / Team Lookup

Primary files:

- `app/api/players/search/route.ts`
- `app/api/players/profile/route.ts`
- `app/api/players/insights/route.ts`
- `app/api/players/insights/batch/route.ts`
- `app/api/teams/search/route.ts`
- `app/api/teams/advanced/route.ts`
- `app/api/teams/status/route.ts`
- `app/api/teams/status/batch/route.ts`

Used by:

- `components/widgets/PlayerCardWidget.tsx`
- `components/widgets/WatchlistWidget.tsx`

Assessment:

- these shared routes are the most important application surface outside of dashboard persistence
- they are where multi-sport support is most real in the active root app

### Metadata Service / Widget Registration

Primary files:

- `lib/widgets/registry.ts`
- `app/api/widgets/metadata/route.ts`
- `components/widgets/WidgetLibrary.tsx`

Strengths:

- each registry entry has `key`, `name`, `description`, `sportCategory`, default size, and optional `stability` / `audience`
- the library is metadata-driven rather than hardcoded labels everywhere

Current issue:

- registry exposure lags behind actual implemented widget components

### Glossary / Stat Explainer System

Active root app reality:

- `app/api/glossary/route.ts` exists
- `GlossaryTerm` exists in Prisma
- the root glossary endpoint falls back to a tiny hardcoded array when the table is empty
- no active root stat explainer UI, ranking modal, or robust glossary module was found

Conclusion:

- glossary support in the active root app is minimal and infrastructure-level, not a complete end-user education system

Sidecar-only note:

- the nested `nashboard-2.0/` copy contains `lib/stats/glossary.ts` and `components/stats/*`, which look like a much richer explainer system
- that system is not present in the active root app

### Ranking / Stat-Ranking System

Active root app reality:

- no active root `/api/stat-ranking` route was found
- no root `lib/stats/rankability.ts` or stat-ranking UI components were found

Sidecar-only note:

- `nashboard-2.0/app/api/stat-ranking/route.ts`
- `nashboard-2.0/lib/stats/rankability.ts`

Conclusion:

- ranking/explainer work appears planned, sidecared, or unmerged rather than shipped in the active root app

### Beginner Vs Advanced Handling

This is implemented at several levels:

- persisted widget mode via Prisma enum `WidgetMode`
- widget props carry `mode`
- widgets themselves decide what to fetch and what to reveal in advanced mode
- `docs/PHASE_1_5_REPORT.md`, `docs/PHASE_2_REPORT.md`, and `docs/PHASE_2_5_REPORT.md` explicitly document a trust-oriented UI philosophy around this split

### Provider Envelopes And Data Contracts

Primary files:

- `lib/providers/types.ts`
- `lib/sports/models/types.ts`
- `lib/sports/resolvers/contracts.ts`
- `docs/WIDGET_DATA_CONTRACTS.md`

Observed contract rules:

- widgets should consume canonical entities and `WidgetPayload<T>` where available
- routes may temporarily expose both legacy `data` and canonical `contract`
- source metadata is expected to explain provider, fallback, and staleness

Current maturity:

- strong in architecture docs and many routes
- not yet consistent across all widget routes, especially several MLB routes added later

### Fallback / Fixture / Test Behavior

Primary files:

- `lib/dataMode.ts`
- `lib/sports/utils/fixturePolicy.ts`
- `tests/fixtures/**`
- `app/api/health/data/route.ts`

Observed behavior:

- explicit fixture mode is supported
- `auto` mode is the default path and tries live-first, then fallback/hydration
- health APIs expose effective mode, source, cache info, and provider snapshots
- tests rely heavily on fixture payloads rather than only pure unit mocks

### Versioning / History

What is visible:

- `docs/PHASE_0_REPORT.md`
- `docs/PHASE_1_REPORT.md`
- `docs/PHASE_1_5_REPORT.md`
- `docs/PHASE_2_REPORT.md`
- `docs/PHASE_2_5_REPORT.md`
- MLB-specific phase docs (`docs/PHASE_3A_*`, `docs/PHASE_4A_MLB_SERIES_TRACKER.md`)
- `docs/FIX_REPORT.md`

What is unclear:

- actual branch/commit history from this checkout
- whether the nested `nashboard-2.0/` copy is ahead of root, behind root, or a branch artifact

## F. Widget Inventory

### Status Key Used In This Report

- `usable`: exposed or nearly exposed and appears coherent within current repo scope
- `partial`: implemented but incomplete, mismatched, demo-backed, or not fully converged
- `planned`: evidence exists in backend/docs, but not clearly surfaced as a usable current widget
- `uncertain`: repo does not provide enough evidence to state more strongly

### Currently Exposed In Root Registry / Library

| Sport | Widget id | Purpose | Apparent status | Beginner / Advanced behavior | Data source / route | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| NFL | `tonights_slate` | Today-first NFL slate with fallback logic | usable | Both modes exist; advanced appears to add extra learn-more / metadata detail rather than a fundamentally different data path | `app/api/widgets/tonights-slate/route.ts`, ESPN scoreboard + fallback logic | Stable in registry |
| UTILITIES | `player_card` | Search and inspect player profiles across NFL/MLB/NBA | usable | Beginner mode stays profile-focused; advanced mode fetches `/api/players/insights` and reveals richer sections and Admin / Debug data | Widget uses `/api/players/search`, `/api/players/profile`, `/api/players/insights`; legacy route also exists at `app/api/widgets/player-card/route.ts` | One of the most mature shared-system widgets |
| UTILITIES | `watchlist` | Track teams and players across sports | partial | Beginner mode prioritizes compact context; advanced mode uses `/api/teams/advanced` and `/api/players/insights/batch` | `app/api/watchlist/route.ts`, plus shared player/team APIs | UI is multi-sport, but persisted DB watchlist route is still NFL-only |
| NFL | `rb_vs_dline` | RB vs run-defense matchup context | partial | Mode toggle exists; advanced reveals extra context such as `learnMore` | `app/api/widgets/rb-vs-dline/route.ts` | Registry marks it `experimental` and `advanced` audience |
| MLB | `mlb_next_7_games` | Upcoming schedule for an MLB team | usable | Advanced mode shows extra identifiers like `gamePk`; otherwise same core summary | `app/api/widgets/mlb-next-7-games/route.ts`, MLB provider | Registry marks it stable |
| MLB | `mlb_pitcher_arsenal` | Pitch mix snapshot for selected MLB pitcher | usable | Advanced mode exposes richer pitch detail such as velocity | `app/api/widgets/mlb-pitcher-arsenal/route.ts`, MLB provider plus player resolution | Registry marks it experimental |
| MLB | `mlb-starting-pitcher-matchup` | Pregame pitcher comparison card | usable | Beginner mode compresses the story; advanced mode exposes selectable games, deeper splits, logs, notes, and stat-basis details | `app/api/widgets/mlb-starting-pitcher-matchup/route.ts`, `lib/sports/resolvers/mlbStartingPitcherMatchup.ts` | Heavily documented/tested despite experimental tag |
| MLB | `mlb-series-tracker` | Follow active/upcoming MLB series | usable | Beginner mode emphasizes summary; advanced adds deeper timeline and selection detail | `app/api/widgets/mlb-series-tracker/route.ts`, `lib/sports/resolvers/mlbSeriesTracker.ts` | Also heavily documented/tested |
| NBA | `nba_tonights_slate` | NBA slate snapshot | usable | Mode toggle exists; advanced-mode difference appears modest in current component | `app/api/widgets/nba-tonights-slate/route.ts`, ESPN NBA provider | Stable in registry |
| NBA | `nba_standings` | East/West standings snapshot | usable | Advanced mode reveals more identifiers such as team keys | `app/api/widgets/nba-standings/route.ts`, ESPN NBA provider | Stable in registry |
| UTILITIES | `data_health` | Ops / diagnostics widget | usable | Advanced mode clearly unlocks provider diagnostics; beginner mode stays summary-level | `app/api/health/data/route.ts` | Registry marks it `admin` audience |

### Implemented In Root Components / Routes But Not Exposed By Current Root Registry

| Sport | Widget id / route | Purpose | Apparent status | Beginner / Advanced behavior | Data source / route | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| MLB | `mlb_season_stats` | Player/team season stat lookup | partial | Mode toggle exists; advanced exposes more detail | `app/api/widgets/mlb-season-stats/route.ts` | Component exists, but no registry entry; route does not expose canonical `contract` |
| MLB | `mlb_platoon_advantage` | Team handedness matchup context | partial | Mode toggle exists; advanced view shows deeper detail | `app/api/widgets/mlb-platoon-advantage/route.ts` | Implemented but hidden from registry |
| MLB | `mlb_recent_form` | Team recent-form snapshot | partial | Mode toggle exists; advanced adds more breakdown | `app/api/widgets/mlb-recent-form/route.ts` | Implemented but hidden from registry |
| MLB | `mlb_bullpen_fatigue` | Bullpen workload / fatigue summary | partial | Mode toggle exists; advanced shows deeper bullpen detail | `app/api/widgets/mlb-bullpen-fatigue/route.ts` | Implemented but hidden from registry |
| MLB | `mlb_run_expectancy` | Run expectancy / RE24-style educational widget | partial | Mode toggle exists; advanced exposes more matrix detail | `app/api/widgets/mlb-run-expectancy/route.ts` | Current route is demo/static-backed rather than live |

### Backend Groundwork Present But Not A Current Root Dashboard Widget

| Sport | Route / system | Purpose | Apparent status | Notes |
| --- | --- | --- | --- | --- |
| MLB | `app/api/widgets/mlb-recent-results/route.ts` | Recent-results data for an MLB team | planned | Provider support exists in `lib/providers/mlb/index.ts`, but no root widget component or registry entry was found |

### Widget Inventory Takeaways

- MLB is the deepest current sport area in the root repo.
- Player Card and Watchlist are the most important cross-sport/shared-system widgets.
- Registry exposure does not currently represent the full implementation surface.
- The root app contains both hyphenated and underscored internal widget keys for some MLB widgets in `DashboardPage`, which suggests compatibility work or naming drift.

## G. Major Development Phases / Progress So Far

### 1. Foundation And Repo Stabilization

Evidence:

- `docs/PHASE_0_REPORT.md`
- `README.md`
- `.env.example`
- `scripts/db-bootstrap.mjs`
- `scripts/db-doctor.mjs`

What appears to have been accomplished:

- cleanup of local setup and environment guidance
- explicit Prisma scripts and postinstall generation
- Docker/bootstrap support for local DB
- baseline lint/test/build/dev verification documented in the phase report

### 2. Canonical Sports Data Architecture

Evidence:

- `docs/PHASE_1_REPORT.md`
- `docs/PHASE_1_ARCHITECTURE.md`
- `docs/WIDGET_DATA_CONTRACTS.md`
- `lib/sports/models/types.ts`
- `lib/sports/adapters/*`
- `lib/sports/resolvers/*`
- `lib/sports/cachePolicy.ts`
- `lib/sports/utils/fixturePolicy.ts`

What appears to have been accomplished:

- creation of canonical models and widget envelope rules
- adapter/resolver boundaries between upstream providers and UI
- bridge-style route migration so widgets can keep working during contract transition
- explicit cache and fallback semantics

This is arguably the most important architectural phase in the repo.

### 3. Runtime Integrity And Trust Hardening

Evidence:

- `docs/PHASE_1_5_REPORT.md`
- `docs/PHASE_2_REPORT.md`
- `docs/PHASE_2_5_REPORT.md`
- `components/widgets/PlayerCardWidget.tsx`
- `components/widgets/WatchlistWidget.tsx`
- `components/widgets/DataHealthWidget.tsx`

What appears to have been accomplished:

- removal of raw provider noise from primary widget UI
- better clean-state / partial-state behavior
- clearer advanced vs debug separation
- search quality ranking and deduping improvements
- reduced duplicate fetches in major widgets

This phase is strong evidence that the project cares about trust and perceived product quality, not just data plumbing.

### 4. Auth, Database, And Persistence Maturation

Evidence:

- `auth.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `app/api/dashboard/*`
- `app/api/watchlist/*`
- `app/api/favorites/route.ts`
- `app/api/preferences/data-mode/route.ts`

What appears to have been accomplished:

- optional but real sign-in support
- persisted dashboards and widget instances
- dashboard sharing fields in schema and API
- favorites, watchlist, and data-mode preference persistence
- guest-mode fallback when DB/auth are unavailable

Important nuance:

- persistence scope is more mature than the MVP label on some APIs implies, but still uneven across sports

### 5. Hybrid Provider Routing And Data-Mode Control

Evidence:

- `docs/FIX_REPORT.md`
- `lib/providers/index.ts`
- `lib/dataMode.ts`
- `lib/providers/apiSports/*`
- `lib/providers/espn/*`
- `app/api/health/data/route.ts`

What appears to have been accomplished:

- `auto` mode with live-first and fallback/hydration behavior
- hybrid API-Sports -> ESPN -> fixture routing for important shared endpoints
- provider diagnostics and health snapshots
- explicit source/fallback metadata

This makes the repo much more production-minded than a typical prototype dashboard.

### 6. MLB Expansion And Hardening

Evidence:

- `lib/providers/mlb/index.ts`
- `lib/providers/mlb/client.ts`
- `lib/providers/mlb/pitcherComparison.ts`
- `lib/sports/resolvers/mlbStartingPitcherMatchup.ts`
- `lib/sports/resolvers/mlbSeriesTracker.ts`
- `docs/PHASE_3A_*`
- `docs/PHASE_4A_MLB_SERIES_TRACKER.md`
- MLB widget components and tests

What appears to have been accomplished:

- MLB provider stack using MLB Stats API
- multiple MLB widgets beyond a simple schedule card
- extensive hardening around probable starters, matchup selection, stat enrichment, season-aware fallbacks, and UI polish

Current conclusion:

- MLB is the most actively built-out vertical in the repository

### 7. Explainer / Ranking Work

Active root app:

- only minimal glossary plumbing is present

Sidecar evidence:

- nested `nashboard-2.0/` contains a real glossary/ranking stack

Conclusion:

- this work appears to exist conceptually and perhaps in another branch/copy, but it is not part of the active root application today

## H. Current State Of Quality / Engineering Standards

### Branching / Workflow Habits

Repo evidence:

- phase docs reference branch names like `chore/phase-0-repo-stabilization` and `feat/phase-1-data-architecture`

Assessment:

- branch naming appears intentional and reasonably disciplined
- actual git history in this checkout is unavailable, so commit style and merge discipline cannot be verified directly

### TypeScript Strictness

- `tsconfig.json` enables `strict: true`
- the codebase is strongly typed across providers, widgets, and Prisma models

This is a clear strength.

### Testing Discipline

Current repo evidence:

- 43 test files under `tests/`
- fixtures for ESPN, API-Sports, MLB, and hybrid routing scenarios
- architecture, route, provider, and widget behavior tests are all present

Observed strengths:

- testing is not limited to pure utility functions
- major systems like hybrid routing, widget metadata, MLB matchup logic, and advanced watchlist behavior have coverage

Observed limits:

- no browser/e2e tests were visible
- no coverage threshold tooling was visible
- large interactive widgets still carry integration risk that node-only tests may miss

### Provider / Data Contract Discipline

Strengths:

- canonical model layer exists
- contract docs are explicit
- source/fallback metadata is treated as a core interface

Weaknesses:

- not all widget routes now conform equally
- there are legacy and newer API surfaces side by side

### Migration Discipline

Strengths:

- Prisma migrations are committed and dated

Weaknesses:

- migration history suggests meaningful schema reshaping, including resets/re-inits
- that is normal for an evolving prototype, but it also signals that schema stability is not fully settled

### Security Practices

Strengths visible in repo:

- auth is environment-gated rather than assumed
- Prisma access is protected behind DB checks
- `NEXTAUTH_URL` / host consistency is documented carefully
- sharing uses generated `shareToken`

Cautions:

- dev admin credentials are hardcoded `admin` / `admin` when enabled, which is fine for local development but should remain explicitly dev-only

### Error Handling

Strengths:

- many routes return graceful JSON errors instead of throwing raw failures
- widgets intentionally sanitize provider warnings
- Data Health and origin-health endpoints provide operational visibility

Weaknesses:

- very large client widgets still contain many state transitions and request branches, which increases the chance of UI-only bugs even if route handling is disciplined

### Modularity And Maintainability

Maintainability strengths:

- canonical sports-data layer
- shared search/profile/status routes
- metadata-driven widget library
- guest-vs-signed-in separation is explicit

Maintainability weaknesses:

- `lib/providers/index.ts`, `components/widgets/PlayerCardWidget.tsx`, and `components/widgets/WatchlistWidget.tsx` are large and complex
- some older paths still coexist with newer canonical ones
- root vs nested sidecar duplication is a significant source-of-truth risk

## I. Known Gaps / Risks / Incomplete Areas

### 1. Root App Vs Nested Sidecar Copy

Risk:

- the nested `nashboard-2.0/` directory contains extra systems not present in root
- future contributors could easily read the wrong copy and make incorrect assumptions

Impact:

- onboarding confusion
- duplicated or diverging changes
- false confidence about shipped glossary/ranking features

### 2. Glossary / Explainer / Ranking Are Not Fully Active In Root

Risk:

- project vision talks about educational stat explanations, but the active root app currently exposes only a minimal glossary endpoint

Impact:

- product/story mismatch if someone assumes the sidecar ranking system is already live

### 3. Widget Registry And Actual Implementation Are Out Of Sync

Risk:

- root registry omits several implemented MLB widgets

Impact:

- widget library does not represent the full implementation surface
- contributors can ship code that is not discoverable

### 4. Dashboard-Level Sport Handling Is Still NFL-Centered

Evidence:

- `DashboardPage` persists new widgets with a hardcoded root `sport` state of `"NFL"`

Impact:

- persisted widget metadata may not accurately reflect actual widget scope
- future cross-sport dashboard features could become harder to reason about

### 5. Watchlist And Favorites Persistence Scope Mismatch

Evidence:

- `WatchlistWidget` supports NFL/MLB/NBA flows in the UI
- `app/api/watchlist/route.ts` explicitly rejects non-NFL POSTs with "Watchlist is NFL teams only for MVP"
- `app/api/favorites/route.ts` stores favorites with `sport: "NFL"`

Impact:

- signed-in behavior is behind the UI's apparent capability
- guest and signed-in experiences can diverge in confusing ways

### 6. Setup Artifacts Are Inconsistent

Evidence:

- Docker port/credentials in `docker-compose.yml` differ from `.env.example` and `README.md`
- seed script wiring uses `prisma/seed.ts` while `prisma/seed.mjs` contains richer demo data

Impact:

- local setup confusion
- inconsistent expectations about what seeded data should exist

### 7. Contract Maturity Is Uneven Across MLB Widgets

Evidence:

- some MLB widget routes return canonical `contract`
- others return only `{ data, meta }`

Impact:

- the architecture story is stronger than its current full implementation
- future shared UI components will have to handle mixed route conventions

### 8. Team Mapping Coverage Appears Limited

Evidence:

- `lib/sports/mappings/teamMap.ts` includes a small explicit alias/provider map and then relies on deterministic fallback logic

Impact:

- cross-provider reconciliation could be fragile for edge cases, naming drift, or less common abbreviations

### 9. Route Duplication / Legacy Surface Area

Examples:

- `/api/widgets/player-card` exists alongside `/api/players/profile` and `/api/players/insights`
- `/api/search/players` exists alongside `/api/players/search`

Impact:

- higher maintenance burden
- easier to update one surface and forget another

### 10. No Browser E2E Coverage For Very Stateful Widgets

Risk:

- large interactive widgets may pass node tests but still regress in real browser interactions

Most exposed areas:

- `PlayerCardWidget`
- `WatchlistWidget`
- dashboard add/remove/persist/share flows

## J. Recommended Next Priorities

### Immediate Priorities

1. Reconcile source of truth between the active root app and the nested `nashboard-2.0/` copy.
   Reason: this is the biggest onboarding and maintenance risk in the repository.

2. Align widget exposure with widget implementation.
   Specifically: bring `lib/widgets/registry.ts`, `WidgetLibrary`, and `DashboardPage` into agreement about which widgets are real and what their canonical keys are.

3. Resolve the signed-in persistence mismatch for multi-sport watchlist and favorites.
   Reason: the UI already promises more than the DB APIs currently persist.

4. Fix local setup consistency.
   Specifically: unify `docker-compose.yml`, `.env.example`, `README.md`, and seed-script expectations.

5. Decide whether glossary/ranking is part of the active root roadmap now.
   If yes, move the sidecar implementation into the root app intentionally. If no, document clearly that the root app currently has only minimal glossary support.

### Short-Term Priorities

1. Standardize all widget routes on the canonical contract shape documented in `docs/WIDGET_DATA_CONTRACTS.md`.

2. Collapse duplicate API surfaces where possible.
   The player search/profile and watchlist-related routes are good candidates for convergence.

3. Add integration coverage around dashboard/library exposure and signed-in persistence flows.

4. Break up the largest client and provider files into smaller modules.
   Highest-value candidates are `components/widgets/WatchlistWidget.tsx`, `components/widgets/PlayerCardWidget.tsx`, and `lib/providers/index.ts`.

5. Harden team mapping and cross-provider identity resolution beyond the current limited explicit map.

### Later / Expansion Priorities

1. Bring the educational stat layer to parity with the product vision.
   That likely means a real glossary + explainer UI and, if desired, ranking support.

2. Expand sharing from backend capability to a deliberate product surface.

3. Continue MLB depth and then apply the same architectural consistency to NBA and NFL specialty widgets.

4. Add browser-level tests for the dashboard shell and the two largest widgets.

## K. Fast Handoff Summary

If a new engineer only reads one section, read this one:

- The active application is the repo root, not the nested `nashboard-2.0/` copy.
- NashBoard 2.0 is a modular sports dashboard with persisted widgets, guest fallback, and explicit beginner/advanced UX.
- The most important shared systems are the dashboard shell, shared player/team APIs, hybrid provider router, and Prisma-backed persistence.
- Player Card and Watchlist are the cross-sport anchors of the product.
- MLB is the deepest current sport vertical.
- The architecture is stronger than the final product convergence: canonical contracts, fallback policy, and health diagnostics are well thought out, but not uniformly applied everywhere.
- The biggest current repo risks are source-of-truth duplication, widget-registry mismatch, and signed-in persistence still being narrower than the UI implies.
- The root app does not yet contain a fully active stat explainer / ranking system, even though the nested sidecar copy does.
- Treat the repo as an advanced prototype that is close to production-minded engineering, but not yet fully unified.

## Appendix: Key Files Reviewed

Core config and setup:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `eslint.config.mjs`
- `.env.example`
- `README.md`
- `docs/LOCAL_SETUP.md`
- `docker-compose.yml`

App shell and persistence:

- `app/page.tsx`
- `components/dashboard/DashboardPage.tsx`
- `app/api/dashboard/route.ts`
- `app/api/dashboard/widgets/route.ts`
- `app/api/dashboard/widgets/[id]/route.ts`
- `lib/guest/guestDashboard.ts`
- `lib/guest/watchlist.ts`

Auth and DB:

- `auth.ts`
- `lib/auth.ts`
- `lib/db/prisma.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*`
- `prisma/seed.ts`
- `prisma/seed.mjs`

Shared sports data systems:

- `lib/dataMode.ts`
- `lib/providers/index.ts`
- `lib/providers/apiSports/*`
- `lib/providers/espn/*`
- `lib/providers/mlb/*`
- `lib/sports/models/types.ts`
- `lib/sports/adapters/normalizers.ts`
- `lib/sports/mappings/teamMap.ts`
- `lib/sports/resolvers/*`

Widget and API surfaces:

- `lib/widgets/registry.ts`
- `app/api/widgets/metadata/route.ts`
- `app/api/widgets/*`
- `components/widgets/*`
- `app/api/players/*`
- `app/api/teams/*`
- `app/api/watchlist/*`
- `app/api/favorites/route.ts`
- `app/api/preferences/data-mode/route.ts`
- `app/api/health/data/route.ts`
- `app/api/health/origin/route.ts`
- `app/api/glossary/route.ts`

Documentation and tests:

- `docs/PHASE_0_REPORT.md`
- `docs/PHASE_1_ARCHITECTURE.md`
- `docs/PHASE_1_REPORT.md`
- `docs/PHASE_1_5_REPORT.md`
- `docs/PHASE_2_REPORT.md`
- `docs/PHASE_2_5_REPORT.md`
- `docs/FIX_REPORT.md`
- `docs/PHASE_3A_*`
- `docs/PHASE_4A_MLB_SERIES_TRACKER.md`
- `tests/**/*.test.ts`
