import { hallRoofOver } from "./alchemia/alchemia-view";
import { parkingRoofOver } from "./alchemia/parking-view";
import { pavilionRoofOver } from "./metro/pavilion-roof";
import { platformRoofOver } from "./metro/platform-view";

/**
 * Whether a roof of the places built over the map is above (x, y, z), where the rain stops: the
 * metro pavilions' (G-331), over the platforms under the street (ADR-0071 stage 4), Alchemia's food
 * hall (ADR-0074 stage 1) and its P-1 (stage 4). The map's own roofs are `MapCity.roofOver`.
 */
export const builtRoofOver = (x: number, y: number, z: number): boolean =>
  pavilionRoofOver(x, y, z) || platformRoofOver(x, y, z) || parkingRoofOver(x, y, z) || hallRoofOver(x, y, z);
