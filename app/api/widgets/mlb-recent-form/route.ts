import { createTeamWidgetRoute } from "@/lib/api/widgetRoute";
import { mlbProvider } from "@/lib/providers/mlb";

export const GET = createTeamWidgetRoute({
  routeName: "mlb-recent-form",
  errorMessage: "Failed to load MLB recent form",
  provider: (teamKey, dataMode) => mlbProvider.getRecentForm(teamKey, dataMode),
});
