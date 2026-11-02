/**
 * Plain town lamps give way to Lublin's styled ones (G-259): where the city set its pastorals,
 * candelabra and wall lanterns (the deptak, the old town, Plac Zamkowy), a road lamp or a modern
 * pole beside one doubles the light point with a factory model, whichever group or OSM node it
 * came from. The styled lamp stays, the plain one goes.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import type { Pt } from "./geometry.ts";
import type { Placed } from "./props-gen.ts";

const PLAIN: ReadonlySet<StreetPropKind> = new Set(["lamp-road", "lamp-modern-pole"]);
const STYLED: ReadonlySet<StreetPropKind> = new Set(["lamp-pastoral", "lamp-candelabra", "lamp-wall-lantern"]);

/**
 * How near a styled lamp a plain one may not stand (m). Past the 7 m that merges two lamps of a
 * kind from lines, and short of the 9 m to the next plain lamp that lights another way (a pole
 * on the alley into Plac Litewski, a road lamp of Grodzka's OSM nodes by a wall lantern); the
 * doubles stood 1 to 3 m off their pastorals and the road lamps at the side streets' mouths 7 m.
 */
export const PLAIN_BY_STYLED = 8;

/** Whether a plain lamp at a point stands by any styled lamp of the plan, wherever placed in it. */
export const byStyledLamp = (placed: readonly Placed[]): ((prop: StreetPropKind, p: Pt) => boolean) => {
  const styled = placed.filter((x) => STYLED.has(x.prop)).map((x) => x.p);
  return (prop, p) => PLAIN.has(prop) && styled.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < PLAIN_BY_STYLED);
};
