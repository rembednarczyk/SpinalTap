import { PLASTER_SWATCHES } from "../../../packages/engine/src/renderer/mapcity/facade-style";
import { SWATCH } from "../../../packages/engine/src/renderer/mapcity/landmarks/kit";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { type TowerEntry, cityEntries, ownTags } from "./landmark-towers";

/**
 * Brick buildings of the map drawn in plaster (G-244): the Gothic keep, the Gothic bastion and the
 * Trinity Chapel are `building:material=brick` in OSM, bare brick in Lublin, and a wall colour
 * from a plaster palette (the facades' by use, the landmark kit's) passes them off as rendered
 * walls. Brama Krakowska's brick comes from its landmark recipe (ADR-0062).
 */

/** The plasters a wall may be drawn in: the facades' palettes by use and the landmark kit's white and beige. */
const PLASTERS: ReadonlySet<string> = new Set([...PLASTER_SWATCHES, SWATCH.plaster, SWATCH.plasterTrim, SWATCH.niche, SWATCH.beige, SWATCH.beigeNiche].map((c) => c.toLowerCase()));

/** Each building whose wall colour is a plaster's. */
export const plasteredWalls = (entries: readonly TowerEntry[]): { readonly at: string; readonly what: string }[] =>
  entries.flatMap((e) => {
    const wall = e.frame.style.plaster.toLowerCase();
    return PLASTERS.has(wall) ? [{ at: `${e.x.toFixed(0)},${e.z.toFixed(0)}`, what: `${e.id} ${e.frame.b.name ?? ""}: brick in plaster ${wall}` }] : [];
  });

/** The city's buildings and lifted parts whose own map element is `building:material=brick`, framed as the map city frames them. */
export const cityBricks = (osm: OsmData): TowerEntry[] => cityEntries((id) => ownTags(osm, id)["building:material"] === "brick", osm);
