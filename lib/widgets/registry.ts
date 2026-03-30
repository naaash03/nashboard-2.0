export type WidgetSport = "NFL" | "NBA" | "MLB" | "UTILITIES";

export type WidgetDefinition = {
  key: string;
  name: string;
  description: string;
  sportCategory: WidgetSport;
  defaultSize: { w: number; h: number };
  stability?: "stable" | "experimental" | "admin";
  audience?: "beginner" | "advanced" | "mixed";
};

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    key: "tonights_slate",
    name: "Tonight's Slate",
    description: "Today-first slate with offseason-safe next-slate fallback.",
    sportCategory: "NFL",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "player_card",
    name: "Player Card",
    description: "Player identity card with reliable profile fields and optional advanced insights.",
    sportCategory: "UTILITIES",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "watchlist",
    name: "Watchlist",
    description: "Track teams and players with prioritized live, recent, and next-game context.",
    sportCategory: "UTILITIES",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "rb_vs_dline",
    name: "RB vs D-Line",
    description: "Expected RB and run-defense matchup context.",
    sportCategory: "NFL",
    defaultSize: { w: 1, h: 1 },
    stability: "experimental",
    audience: "advanced",
  },
  {
    key: "mlb_next_7_games",
    name: "MLB Next 7 Games",
    description: "Upcoming 7-game schedule for any MLB team via MLB Stats API.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "mlb_pitcher_arsenal",
    name: "Pitcher Arsenal",
    description: "Pitch-type breakdown with velocity and spin rate for a selected pitcher.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
    stability: "experimental",
    audience: "advanced",
  },
  {
    key: "mlb_series_tracker",
    name: "Series Tracker",
    description: "Current or upcoming series context with game-by-game results.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_starting_pitcher_matchup",
    name: "Starting Pitcher Matchup",
    description: "Probable starters with season stats for a team's next scheduled game.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_season_stats",
    name: "Season Stats Explorer",
    description: "Year-by-year hitting or pitching stats for a player, or team stats for a season.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_platoon_advantage",
    name: "Platoon Advantage",
    description: "Analyzes pitcher platoon splits to identify home/away matchup advantages.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_recent_form",
    name: "Recent Form Rating",
    description: "Hot/Warm/Cool/Cold rating based on last 7, 14, and 30-day win percentages.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_bullpen_fatigue",
    name: "Bullpen Fatigue Tracker",
    description: "Tracks active bullpen pitcher availability and fatigue based on recent appearances.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_run_expectancy",
    name: "Run Expectancy (RE24)",
    description: "Interactive RE24 matrix — click any base/out state to see expected runs and scoring probability.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb-starting-pitcher-matchup",
    name: "MLB Starting Pitcher Matchup",
    description: "Pregame pitching edge card for the next MLB matchup.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
    stability: "experimental",
    audience: "mixed",
  },
  {
    key: "mlb-series-tracker",
    name: "MLB Series Tracker",
    description: "Track active and upcoming MLB series with beginner summary and advanced timeline analytics.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
    stability: "experimental",
    audience: "mixed",
  },
  {
    key: "nba_tonights_slate",
    name: "NBA Tonight's Slate",
    description: "Today-first NBA slate using ESPN scoreboard data.",
    sportCategory: "NBA",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "nba_standings",
    name: "NBA Standings",
    description: "East/West standings snapshot with beginner/advanced depth.",
    sportCategory: "NBA",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "data_health",
    name: "Data Health",
    description: "Operational summary with optional provider diagnostics in advanced mode.",
    sportCategory: "UTILITIES",
    defaultSize: { w: 1, h: 1 },
    stability: "admin",
    audience: "advanced",
  },
];

