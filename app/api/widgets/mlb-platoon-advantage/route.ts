import { createTeamWidgetRoute } from "@/lib/api/widgetRoute";
import { mlbProvider } from "@/lib/providers/mlb";

export const GET = createTeamWidgetRoute({
  routeName: "mlb-platoon-advantage",
  errorMessage: "Failed to load MLB platoon advantage",
  provider: (teamKey, dataMode) => mlbProvider.getPlatoonAdvantage(teamKey, dataMode),
});
