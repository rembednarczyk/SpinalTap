import type { StreetPropItem } from "../../../packages/core/src";
import {
  ALCHEMIA_CENTRE,
  ALCHEMIA_CUTS,
  ALCHEMIA_PIECES,
  ALCHEMIA_PROPS,
  ALCHEMIA_ROOF_PROPS,
  ARKADY_PAVEMENT_PROP,
  ARKADY_PIECES,
  C7_PROPS,
  FRONT_GREEN_PROPS,
  FRONT_PLANTER_SOLIDS,
  FRONT_PLAZA_PROPS,
  P1_PIECES,
  P1_RAMP_PROPS,
  P2_CUTTING_PIECES,
  PAVILION_PROPS,
  type AlchemiaPiece,
  arkadyPoint,
  plazaCafeSolids,
} from "../../../packages/sim/src/content/alchemia";
import { modelBoxes } from "../../../packages/sim/src/content/alchemia/shops";
import type { StaticProp } from "../../../packages/sim/src/content/builders";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { METRO_CUTS } from "../../../packages/sim/src/content/metro";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { makePrism, prismsAt } from "../../../packages/sim/src/world/prism";
import { type FootPiece, type OffGroundWorld, alchemiaOffGround, boxPiece } from "./alchemia-ground";
import { drawnPaving } from "./pool-paving";

/** How far round Alchemia's middle its pieces' supports are read (m): its plot and the Arkady's. */
const RADIUS = 160;

/** A piece of Alchemia's world axes as a footprint; null for one of no volume. */
const footOf = (p: AlchemiaPiece): FootPiece | null => {
  const b = p.box;
  if (!(b.y1 > b.y0) || !(b.x1 > b.x0) || !(b.z1 > b.z0)) return null;
  const pts = p.outline ?? [{ x: b.x0, z: b.z0 }, { x: b.x1, z: b.z0 }, { x: b.x1, z: b.z1 }, { x: b.x0, z: b.z1 }];
  return { prism: makePrism(pts, b.y0, b.y1), kind: p.kind };
};

/** A piece of the Arkady's frame (along, across) in the world's axes. */
const arkadyFoot = (p: AlchemiaPiece): FootPiece | null => {
  const b = p.box;
  if (!(b.y1 > b.y0) || !(b.x1 > b.x0) || !(b.z1 > b.z0)) return null;
  return { prism: makePrism([arkadyPoint(b.x0, b.z0), arkadyPoint(b.x1, b.z0), arkadyPoint(b.x1, b.z1), arkadyPoint(b.x0, b.z1)], b.y0, b.y1), kind: `arkady ${p.kind}` };
};

const some = <T>(list: readonly (T | null)[]): T[] => list.filter((x): x is T => x !== null);

/** A static prop's prisms as footprints. */
const propFeet = (props: readonly StaticProp[], kind: string): FootPiece[] => props.flatMap((p) => (p.prisms ? prismsAt(p.prisms, p.center).map((prism) => ({ prism, kind })) : []));

/** Inside a cut the terrain is dug out: no ground drawn or walked there. */
const CUTS = [...ALCHEMIA_CUTS, ...METRO_CUTS];
const inCut = (x: number, z: number): boolean => CUTS.some((c) => x >= c.bounds.minX && x <= c.bounds.maxX && z >= c.bounds.minZ && z <= c.bounds.maxZ);

/** The game's models Alchemia places outside: the front's green, its square's, the deptak's sellers and crates, the terraces' people, the green roof's. */
const MODELS: readonly StreetPropItem[] = [...FRONT_GREEN_PROPS, ...FRONT_PLAZA_PROPS, ...C7_PROPS, ...ALCHEMIA_ROOF_PROPS];

/**
 * The game's planters drawn (not solids of the street's furniture): 1.2 m square, 0.6 m over the foot
 * (`FRONT_PLANTER_SOLIDS`'s measure), a tree or a shrub standing in one 0.45 m over its foot.
 */
const PLANTER = { half: 0.6, top: 0.6 } as const;
const planterFeet = (items: readonly StreetPropItem[]): FootPiece[] =>
  items.flatMap((p) => (p.prop === "planter" && p.y !== undefined ? [boxPiece(p.x - PLANTER.half, p.x + PLANTER.half, p.z - PLANTER.half, p.z + PLANTER.half, p.y - 0.05, p.y + PLANTER.top, "planter")] : []));

/** The map's solids round Alchemia but its own: its buildings, the street's game blocks (drawn as they are solid). */
const otherSolids = (): FootPiece[] => {
  const own = new Set<StaticProp>(ALCHEMIA_PROPS);
  const c = ALCHEMIA_CENTRE;
  return WORLD_CHUNKS.flatMap((ch) => [...ch.props, ...(ch.rooms ?? [])])
    .filter((p) => p.solid && !own.has(p) && Math.hypot(p.center.x - c.x, p.center.z - c.z) < RADIUS)
    .flatMap((p) => propFeet([p], "map"));
};

/** The drawn pieces outside, on the drawn ground (the map's paving draped on the terrain, else the terrain), held by drawn pieces. */
export const drawnOffGround = (): OffGroundWorld => {
  const paving = drawnPaving(WORLD_SCENERY, groundY);
  const drawn = [...ALCHEMIA_PIECES, ...P1_PIECES, ...P2_CUTTING_PIECES];
  const outside = drawn.filter((p) => !p.inside);
  const arkady = some(ARKADY_PIECES.filter((p) => !p.inside).map(arkadyFoot));
  return {
    pieces: [...some(outside.map(footOf)), ...arkady],
    models: [...some(modelBoxes(MODELS).map(footOf)).map((f) => ({ ...f, kind: "model" })), ...planterFeet(MODELS)],
    supports: [...some(drawn.filter((p) => p.inside).map(footOf)), ...some(ARKADY_PIECES.filter((p) => p.inside).map(arkadyFoot)), ...propFeet(PAVILION_PROPS, "pavilion"), ...otherSolids()],
    ground: (x, z) => (inCut(x, z) ? null : (paving(x, z) ?? groundY(x, z))),
  };
};

/** The solids outside not drawn as they are (the café's tables and chairs, the terraces' planters, the pavilion, P-1's ramp, the Arkady's pavement), on the walked ground. */
export const solidOffGround = (): OffGroundWorld => ({
  pieces: [...some([...plazaCafeSolids(), ...FRONT_PLANTER_SOLIDS].map(footOf)), ...propFeet([...PAVILION_PROPS, ...P1_RAMP_PROPS, ARKADY_PAVEMENT_PROP], "solid")],
  models: [],
  supports: [...propFeet(ALCHEMIA_PROPS, "solid"), ...otherSolids()],
  ground: (x, z) => (inCut(x, z) ? null : groundY(x, z)),
});

/** `alchemia-off-ground` in the game: the drawn pieces and models, then the solids not drawn as they are. */
export const alchemiaOffGroundInGame = () => [...alchemiaOffGround(drawnOffGround()), ...alchemiaOffGround(solidOffGround())];
