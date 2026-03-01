export type WidgetSport = "NFL" | "NBA" | "MLB" | "UTILITIES";

export type WidgetDefinition = {
  key: string;
  name: string;
  description: string;
  sportCategory: WidgetSport;
  defaultSize: { w: number; h: number };
};

export const WIDGET_DEFINITIONS: WidgetDefinition[] = [
  {
    key: "tonights_slate",
    name: "Tonight's Slate",
    description: "Today-first slate with offseason-safe next-slate fallback.",
    sportCategory: "NFL",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "player_card",
    name: "Player Card",
    description: "Choose a player from search results and track profile/stats.",
    sportCategory: "UTILITIES",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "watchlist",
    name: "Watchlist",
    description: "Teams watchlist (MVP: NFL only), max 5.",
    sportCategory: "UTILITIES",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "rb_vs_dline",
    name: "RB vs D-Line",
    description: "Expected RB and run-defense matchup context.",
    sportCategory: "NFL",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_next_7_games",
    name: "MLB Next 7 Games",
    description: "Upcoming MLB games for a selected team.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_pitcher_arsenal",
    name: "Pitcher Arsenal",
    description: "Pitch mix snapshot for a selected MLB pitcher.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "nba_tonights_slate",
    name: "NBA Tonight's Slate",
    description: "Today-first NBA slate using ESPN scoreboard data.",
    sportCategory: "NBA",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "nba_standings",
    name: "NBA Standings",
    description: "East/West standings snapshot with beginner/advanced depth.",
    sportCategory: "NBA",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "data_health",
    name: "Data Health",
    description: "Provider mode, cache, and latest fetch diagnostics.",
    sportCategory: "UTILITIES",
    defaultSize: { w: 1, h: 1 },
  },
];

