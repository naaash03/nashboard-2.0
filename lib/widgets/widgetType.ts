const LEGACY_WIDGET_TYPE_ALIASES: Record<string, string> = {
  "mlb-series-tracker": "mlb_series_tracker",
  "mlb-starting-pitcher-matchup": "mlb_starting_pitcher_matchup",
};

export function canonicalizeWidgetType(widgetType: string): string {
  return LEGACY_WIDGET_TYPE_ALIASES[widgetType] ?? widgetType;
}

export function formatWidgetTypeLabel(widgetType: string): string {
  return canonicalizeWidgetType(widgetType).replaceAll("_", " ");
}
