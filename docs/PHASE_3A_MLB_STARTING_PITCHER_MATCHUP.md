# Phase 3A - MLB Starting Pitcher Matchup

## Purpose
`mlb-starting-pitcher-matchup` is a pregame pitching scouting card for MLB games.  
It answers: who the probable starters are and which starter has a rule-based edge.

## Data Sources
- Primary: API-Sports (`games`, `teams`, `players/statistics`)
- Fallback: ESPN MLB scoreboard probable starters
- Fixture mode: deterministic files under `tests/fixtures/apiSports/mlb` and `tests/fixtures/espn/scoreboard`

Source strategy:
- Use APISports first.
- If game resolves but one or both starters are missing, attempt ESPN fallback.
- If both providers cannot supply probable starters, return `partial`.
- If game context cannot be resolved, return `failed`.
- Never fabricate probable starters.

## Route Contract
Route: `/api/widgets/mlb-starting-pitcher-matchup`

Query params:
- `sport=mlb`
- `teamKey`
- `gameId` (optional override)
- `mode=beginner|advanced`
- `dataMode=live|fixture`
- `cacheBust`

Response shape:
- `data`: normalized UI data (`game`, `pitchers`, `edge`, `state`, `selectableGames`)
- `meta`: resolver metadata (`sourceUsed`, `fallbackUsed`, `state`, `warning`, `notes`)
- `contract`: standardized NashBoard `WidgetPayload`
- `error`: nullable string

## Resolution Model
Team-first game selection with game override:
1. If `gameId` is provided and matched, use it.
2. Otherwise prefer today's game (live first, then scheduled).
3. Otherwise choose next scheduled game.
4. Advanced mode exposes `selectableGames` dropdown options.

Once selected, widget logic runs against that single `gameId`.

## Edge Logic
Rule-based weighted comparison:
- ERA: 25%
- WHIP: 20%
- K/9: 15%
- BB/9: 15%
- HR/9: 10%
- Recent form (3-start ERA): 15%

Output:
- Beginner: one-line edge summary (`Edge: <team> starter`) or neutral.
- Advanced: overall edge plus category winners.
- If available data is too sparse, edge is neutral.

## UI States
- Loading: `Loading matchup...`
- Empty: `No upcoming MLB game found`
- Partial: `Game found, probable starters not posted yet`
- Failed: `Failed to load pitching matchup`

## Future Expansion Hooks
- Add park-factor and weather adjustment as optional advanced layers.
- Add batter handedness matchup quality using lineup context.
- Add last-3-start quality trend sparkline when consistent logs are available.
- Add confidence scoring by source freshness and cross-provider agreement.
