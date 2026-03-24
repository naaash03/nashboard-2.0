import { shapeTonightsSlate } from "@/lib/templates/tonightsSlate";
import type { Mode, SlateGame } from "@/lib/providers/types";

export function shapeNbaTonightsSlate(games: SlateGame[], mode: Mode) {
  return shapeTonightsSlate(games, mode);
}
