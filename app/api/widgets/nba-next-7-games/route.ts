import { createTeamWidgetRoute } from "@/lib/api/widgetRoute";
import { getNextGames } from "@/lib/providers/espn/nba";

export const GET = createTeamWidgetRoute({
  routeName: "nba-next-7-games",
  errorMessage: "Failed to load NBA next 7 games",
  primaryProvider: "espn",
  provider: (teamKey, dataMode) => getNextGames(teamKey, 7, dataMode),
});
