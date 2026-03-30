# NashBoard 2.0

Sports analytics dashboard — NFL/NBA/MLB widgets, beginner/advanced modes.
Built for casual fans. Think sports Bloomberg terminal.

## Stack
Next.js 16, React 19, TypeScript, Prisma 7 + PostgreSQL, 
NextAuth v5, Tailwind v4, Vitest

## Free Data Sources (no API keys needed)
- ESPN unofficial API — NFL and NBA
  Base: https://site.api.espn.com/apis/site/v2/sports/
  NBA standings: https://site.web.api.espn.com/apis/v2/sports/basketball/nba/standings?region=us&lang=en&contentorigin=espn
- MLB Stats API — https://statsapi.mlb.com/api/v1
- Fixture fallback in tests/fixtures/

## Architecture Rules
- Every widget: API route → provider → template → component
- fetchMlbJson / fetchEspnJson with multi-layer cache
  (memory → DB CachedResponse → disk fixture)
- DataMode: live/fixture via query param → cookie → env
- Beginner/Advanced mode affects backend payload AND frontend display
- toWidgetPayload() contract on every API response
- resolveDataModeFromRequest() on every route

## Current Widget Inventory

### NFL (lib/providers/espn/nfl.ts)
- tonights_slate — ESPN scoreboard
- player_card — ESPN athlete
- watchlist — team tracking
- rb_vs_dline — RB matchup

### NBA (lib/providers/espn/nba.ts)
- nba_tonights_slate — ESPN scoreboard
- nba_standings — ESPN standings
- nba_next_7_games — team schedule (IN PROGRESS)
- nba_recent_form — weighted W-L (IN PROGRESS)
- nba_offensive_defensive_breakdown — team comparison (IN PROGRESS)
- nba_playoff_picture — seeding context (IN PROGRESS)

### MLB (lib/providers/mlb/index.ts + lib/providers/mlb/client.ts)
ALL CONFIRMED WORKING WITH LIVE DATA:
- mlb_next_7_games — statsapi schedule
- mlb_pitcher_arsenal — pitch mix (needs 2025 fallback)
- mlb_series_tracker — series context
- mlb_starting_pitcher_matchup — pregame pitchers
- mlb_season_stats — year-by-year player/team stats
- mlb_platoon_advantage — handedness splits
- mlb_recent_form — weighted W-L
- mlb_bullpen_fatigue — relief pitcher availability
- mlb_run_expectancy — RE24 static matrix
- mlb_recent_results — last 3 games (new endpoint)

### Utilities
- data_health — provider diagnostics

## MLB Team Keys
NYM, NYY, LAD, BOS, CHC, HOU, ATL, PHI, SDP, SFG, 
STL, MIL, CIN, PIT, COL, ARI, SEA, TEX, OAK, MIN,
CLE, DET, KCR, CHW, TBR, BAL, WSN, MIA, TOR, LAA

## NBA Team IDs
ATL=1, BOS=2, NOP=3, CHI=4, CLE=5, DAL=6, DEN=7, 
DET=8, GSW=9, HOU=10, IND=11, LAC=12, LAL=13, 
MIA=14, MIL=15, MIN=16, BKN=17, NYK=18, ORL=19, 
PHI=20, PHX=21, POR=22, SAC=23, SAS=24, OKC=25, 
UTA=26, WAS=27, TOR=28, MEM=29, CHA=30

## Current Season Context
- MLB: 2026 Regular Season started March 26 2026
- NBA: 2025-26 season ~75% done, playoffs April 2026
- NFL: Offseason

## Known Issues / In Progress
- MLB pitcher arsenal: needs 2025 season fallback when 2026 empty
- NBA widgets: 4 new widgets partially built, may have conflicts
- Widget Library: needs scrollable category rows (not flat grid)
- Stat Explainer popup: planned but not started
- Recurring merge conflicts: always run git grep for markers after edits

## Key File Locations
- Widget registry: lib/widgets/registry.ts
- Dashboard component: components/dashboard/DashboardPage.tsx
- Widget Library UI: components/widgets/WidgetLibrary.tsx
- ESPN client: lib/providers/espn/client.ts
- MLB client: lib/providers/mlb/client.ts
- MLB provider: lib/providers/mlb/index.ts
- Fixture files: tests/fixtures/espn/ and tests/fixtures/mlb/

## Development Rules
- Always read target files before editing
- Never leave git conflict markers in files
- Run git grep -n '<<<<<<<' after any merge work
- Commit after every working feature
- Stay 100% free APIs only
- Test with NYM (MLB) and NYK (NBA) as default teams

