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
    description: "Choose an NFL player from search results and track profile/stats.",
    sportCategory: "NFL",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "watchlist",
    name: "Watchlist",
    description: "NFL teams only, max 5.",
    sportCategory: "NFL",
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
    description: "Data source to be added.",
    sportCategory: "MLB",
    defaultSize: { w: 1, h: 1 },
  },
  {
    key: "mlb_pitcher_arsenal",
    name: "Pitcher Arsenal",
    description: "Data source to be added.",
    sportCategory: "MLB",
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

