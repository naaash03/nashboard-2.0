import { createTeamWidgetRoute } from "@/lib/api/widgetRoute";
import { getRecentForm } from "@/lib/providers/espn/nba";

export const GET = createTeamWidgetRoute({
  routeName: "nba-recent-form",
  errorMessage: "Failed to load NBA recent form",
  primaryProvider: "espn",
  provider: (teamKey, dataMode) => getRecentForm(teamKey, 10, dataMode),
});
