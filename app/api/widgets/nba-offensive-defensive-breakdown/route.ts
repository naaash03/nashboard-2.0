import { createTeamWidgetRoute } from "@/lib/api/widgetRoute";
import { getTeamStatProfile } from "@/lib/providers/espn/nba";

export const GET = createTeamWidgetRoute({
  routeName: "nba-offensive-defensive-breakdown",
  errorMessage: "Failed to load NBA offensive/defensive breakdown",
  primaryProvider: "espn",
  provider: (teamKey, dataMode) => getTeamStatProfile(teamKey, dataMode),
});
