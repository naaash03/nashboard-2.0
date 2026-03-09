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
    description: "Upcoming MLB games for a selected team.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
    stability: "stable",
    audience: "mixed",
  },
  {
    key: "mlb_pitcher_arsenal",
    name: "Pitcher Arsenal",
    description: "Pitch mix snapshot for a selected MLB pitcher.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
    stability: "experimental",
    audience: "advanced",
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

