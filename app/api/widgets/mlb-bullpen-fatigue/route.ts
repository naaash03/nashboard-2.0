import { createTeamWidgetRoute } from "@/lib/api/widgetRoute";
import { mlbProvider } from "@/lib/providers/mlb";

export const GET = createTeamWidgetRoute({
  routeName: "mlb-bullpen-fatigue",
  errorMessage: "Failed to load MLB bullpen fatigue",
  provider: (teamKey, dataMode) => mlbProvider.getBullpenFatigue(teamKey, dataMode),
});
