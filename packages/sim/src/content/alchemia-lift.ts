import type { GroundPoint, Vec3, ViewDescriptor } from "@seki/core";
import type { StaticProp } from "./builders";
import type { PrismDef } from "../world/prism";
import { ALCHEMIA_LIFT_SITE, ALCHEMIA_MODULES, type PlacedAlchemiaModule, alchemiaPoint } from "./alchemia";
import { surfaceY } from "./lublin/terrain";

/**
 * The lift of Alchemia to the hall's roof (G-284, G-289; ADR-0063 stage 5): a glazed shaft on
 * `ALCHEMIA_LIFT_SITE` behind the hall, its cage the lift mechanism of ADR-0020 (a platform, a gate
 * at each level and a call button at each), a footbridge from its top across to the roof, and on the
 * roof a terrace fenced in glass for the stages to come (Rin and the stalls off al. Tysiąclecia):
 * the way up and the way down, with no edge to walk off.
 *
 * The platform is a box of the world's axes (the moving solids of ADR-0020 are boxes), so the shaft
 * stands square to the world, turned some 17° from the hall's back wall, inside the site's 3 m square.
 * Its bottom opening faces north to the open square, its top one south, onto the bridge. The bridge
 * lands on the roof's raised back slab (0.36 m over the roof, as drawn), the lift's top level, and the
 * terrace is the back of the roof between the drawn box on its west side, the overhang over the
 * outside stair on its east side and the low box in front of the name ALCHEMIA, about 3.6 × 4.2 m
 * (none of them is solid: all of them stay outside the screens). Its screens and the bridge's are glass to a
 * handrail and taut lit wires over it to 2.6 m over the slab: no step, jump or pull-up takes a body
 * over or onto them. The gates are 1.8 m, over a jump and a step, so nobody jumps into the shaft. The engine draws the shaft, the bridge and the screens (`renderer/alchemia/lift-bake`);
 * the platform, the gates and the buttons are entities with views of their own, as at the market.
 */

/** Heights over the hall's floor (alchemia-props.glb, measured off its faces): its roof's raised back slab. */
const ROOF_SLAB = 11.87;
/** The drawn roof under the slab (`ALCHEMIA_HALL_ROOF`). */
const ROOF = 11.51;
/** The terrace in the hall's frame (glTF metres): between its screens' middle lines, from the roof's back edge to the box in front of the name (z -0.25). */
const TERRACE = { x0: -2.14, x1: 1.49, back: -4.55, slabEnd: -2.55, front: -0.3 } as const;

/** Half the platform's side, the walls' and the screens' thickness, metres. */
const HALF = 1.1;
const WALL = 0.1;
const SCREEN = 0.08;
/**
 * The gates stand this high over their levels: a jump lifts the feet 1.23 m and a step takes them
 * 0.45 m more. The screens stand higher, out of a pull-up's reach from a jump (1.23 m and 1.3 m
 * more, `MANTLE_REACH`): a screen is thin, but along its line a pull-up would end on its top.
 */
const GATE = 1.8;
const FENCE = 2.6;
/** The doors' openings, the lintel over the top one and the cap over the shaft (its walls out of a pull-up's reach too). */
const OPENING = 2.3;
const LINTEL = 0.25;
const CAP = 0.15;
/** The sill outside the bottom opening: how far it reaches out of the north wall, its rise over the paving. */
const SILL = 0.65;
const SILL_RISE = 0.2;
/** Blocks under the paving reach this far into it, as the plinths do. */
const SINK = 0.3;
const PLATFORM = 0.3;
const LIFT_SPEED = 2.5;
/** A call button: its size, its height over its level, its reach from the cage (`BUTTON_REACH`). */
const BUTTON = { x: 0.22, y: 0.32, z: 0.22 } as const;
const BUTTON_Y = 1.2;

const HALL: PlacedAlchemiaModule = ALCHEMIA_MODULES[0]!;
const C = ALCHEMIA_LIFT_SITE.centre;

/** A line of a screen in the world, its floor and its top (world y). */
export interface AlchemiaScreen {
  readonly a: GroundPoint;
  readonly b: GroundPoint;
  readonly floor: number;
  readonly top: number;
}

/** A box of the world's axes, offsets from the shaft's middle, world y. */
export interface LiftBox {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly y0: number;
  readonly y1: number;
}

export interface AlchemiaLiftPlan {
  readonly key: string;
  readonly centre: GroundPoint;
  /** Half the platform's side; the walls stand outside it, `wall` thick. */
  readonly half: number;
  readonly wall: number;
  /** World y: the bottom of the shaft's walls, the levels (the platform's top at each) and the shaft's head and cap. */
  readonly base: number;
  readonly levels: readonly [number, number];
  readonly opening: number;
  readonly head: number;
  readonly cap: number;
  /** The shaft's walls, the sill, the pocket the top gate sinks into and the bridge's deck. */
  readonly walls: readonly LiftBox[];
  readonly sill: LiftBox;
  readonly pocket: LiftBox;
  readonly deck: LiftBox;
  /** The bridge's deck as drawn: from the shaft's top opening to the roof's back edge (world, counter-clockwise). */
  readonly bridge: readonly GroundPoint[];
  /** The gates at the bottom (north) and the top (south) openings, closed. */
  readonly gates: readonly [LiftBox, LiftBox];
  readonly buttons: readonly [Vec3, Vec3];
  /** The bridge's sides and the terrace's fence. */
  readonly screens: readonly AlchemiaScreen[];
  /** The roof's back slab inside the terrace (the hall's frame as world corners), its top and bottom. */
  readonly slab: { readonly corners: readonly GroundPoint[]; readonly top: number; readonly bottom: number };
}

const hallY = (h: number): number => HALL.floor + h;
const at = (x: number, z: number): GroundPoint => alchemiaPoint(HALL, x, z);
/** The model frame of the hall from a world point: the inverse of `alchemiaPoint`. */
const local = (p: GroundPoint): GroundPoint => {
  const fx = Math.sin(HALL.yaw);
  const fz = Math.cos(HALL.yaw);
  const dx = p.x - HALL.x;
  const dz = p.z - HALL.z;
  return { x: -dx * fz + dz * fx, z: dx * fx + dz * fz };
};

/** World z of the roof's back edge at world x (a straight line of the hall's frame). */
const edgeZ = (x: number): number => {
  const a = at(-5, TERRACE.back);
  const b = at(5, TERRACE.back);
  return a.z + ((x - a.x) * (b.z - a.z)) / (b.x - a.x);
};

const box = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): LiftBox => ({ x0, x1, z0, z1, y0, y1 });

const plan = (): AlchemiaLiftPlan => {
  const out = HALF + WALL;
  const sillOut = HALF + SILL;
  const paving: number[] = [];
  for (let x = -out; x <= out + 1e-9; x += 0.4) for (let z = -out; z <= sillOut + 1e-9; z += 0.4) paving.push(surfaceY(C.x + x, C.z + z));
  const ground = Math.max(...paving) + SILL_RISE;
  const base = Math.min(...paving) - SINK;
  const top = hallY(ROOF_SLAB);
  const head = top + OPENING + LINTEL;
  const west = edgeZ(C.x - out);
  const east = edgeZ(C.x + out);
  // The deck runs from the platform's edge to past the roof's edge on both sides: onto the slab, as high.
  const far = Math.min(west, east) - 0.1 - C.z;
  const fence = top + FENCE;
  const roof = hallY(ROOF);
  const side = (x: number, edge: number): AlchemiaScreen => ({ a: { x: C.x + x, z: C.z - out }, b: { x: C.x + x, z: edge }, floor: top - PLATFORM, top: fence });
  const fenceLine = (x0: number, z0: number, x1: number, z1: number): AlchemiaScreen => ({ a: at(x0, z0), b: at(x1, z1), floor: roof, top: fence });
  // The back edge of the terrace on either side of the bridge, a little into the bridge's screens.
  const bw = local({ x: C.x - out, z: west }).x + 0.05;
  const be = local({ x: C.x + out, z: east }).x - 0.05;
  const backZ = TERRACE.back + SCREEN / 2;
  return {
    key: "alchemia-lift",
    centre: C,
    half: HALF,
    wall: WALL,
    base,
    levels: [ground, top],
    opening: OPENING,
    head,
    cap: head + CAP,
    walls: [
      box(-out, -HALF, -out, out, base, head),
      box(HALF, out, -out, out, base, head),
      box(-HALF, HALF, HALF, out, ground + OPENING, head),
      box(-HALF, HALF, -out, -HALF, base, top),
      box(-HALF, HALF, -out, -HALF, top + OPENING, head),
      box(-out, out, -out, out, head, head + CAP),
    ],
    sill: box(-HALF, HALF, HALF, sillOut, base, ground),
    pocket: box(-HALF - 0.05, HALF + 0.05, -out - 0.13, -out + 0.02, top - GATE - 0.15, top - PLATFORM),
    deck: box(-out, out, far, -HALF, top - PLATFORM, top),
    bridge: [
      { x: C.x - out, z: C.z - HALF },
      { x: C.x - out, z: west },
      { x: C.x + out, z: east },
      { x: C.x + out, z: C.z - HALF },
    ],
    gates: [box(-HALF, HALF, out, out + WALL, ground, ground + GATE), box(-HALF, HALF, -out - WALL, -out, top, top + GATE)],
    buttons: [
      { x: C.x - out - BUTTON.x / 2, y: ground + BUTTON_Y, z: C.z + HALF - 0.3 },
      { x: C.x - out + WALL / 2 + SCREEN / 2 + BUTTON.x / 2, y: top + BUTTON_Y, z: C.z - out - 0.6 },
    ],
    screens: [
      side(-out + WALL / 2, west),
      side(out - WALL / 2, east),
      fenceLine(TERRACE.x0, TERRACE.back, TERRACE.x0, TERRACE.front),
      fenceLine(TERRACE.x1, TERRACE.back, TERRACE.x1, TERRACE.front),
      fenceLine(TERRACE.x0, TERRACE.front, TERRACE.x1, TERRACE.front),
      fenceLine(TERRACE.x0, backZ, bw, backZ),
      fenceLine(be, backZ, TERRACE.x1, backZ),
    ],
    slab: {
      corners: [at(TERRACE.x0, TERRACE.back), at(TERRACE.x0, TERRACE.slabEnd), at(TERRACE.x1, TERRACE.slabEnd), at(TERRACE.x1, TERRACE.back)],
      top,
      bottom: roof,
    },
  };
};

/** The lift's plan in the world: what the simulation makes solid and the engine draws. */
export const ALCHEMIA_LIFT: AlchemiaLiftPlan = plan();

/**
 * The roof terrace (for the next stages: Rin and the stalls off al. Tysiąclecia): its corners
 * inside the screens, world, and its floors, the roof and the slab at its back where the bridge lands.
 */
export const ALCHEMIA_TERRACE: { readonly corners: readonly GroundPoint[]; readonly roof: number; readonly slab: number } = {
  corners: [
    at(TERRACE.x0 + SCREEN / 2, TERRACE.back),
    at(TERRACE.x0 + SCREEN / 2, TERRACE.front - SCREEN / 2),
    at(TERRACE.x1 - SCREEN / 2, TERRACE.front - SCREEN / 2),
    at(TERRACE.x1 - SCREEN / 2, TERRACE.back),
  ],
  roof: hallY(ROOF),
  slab: hallY(ROOF_SLAB),
};

/** The four corners of a screen's line `t` thick, around it. */
export const screenCorners = (s: AlchemiaScreen, t: number = SCREEN): GroundPoint[] => {
  const dx = s.b.x - s.a.x;
  const dz = s.b.z - s.a.z;
  const n = Math.hypot(dx, dz) || 1;
  const ox = (-dz / n) * (t / 2);
  const oz = (dx / n) * (t / 2);
  return [
    { x: s.a.x - ox, z: s.a.z - oz },
    { x: s.b.x - ox, z: s.b.z - oz },
    { x: s.b.x + ox, z: s.b.z + oz },
    { x: s.a.x + ox, z: s.a.z + oz },
  ];
};

/** Seen nowhere as an entity: the engine draws the shaft, the bridge and the screens (`scenery`). */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

/** The static solid of the lift, its middle at the shaft's foot. */
const structure = (p: AlchemiaLiftPlan): StaticProp => {
  const y = p.base;
  const rel = (q: GroundPoint): GroundPoint => ({ x: q.x - p.centre.x, z: q.z - p.centre.z });
  const boxPrism = (b: LiftBox): PrismDef => ({
    points: [
      { x: b.x0, z: b.z0 },
      { x: b.x1, z: b.z0 },
      { x: b.x1, z: b.z1 },
      { x: b.x0, z: b.z1 },
    ],
    bottom: b.y0 - y,
    top: b.y1 - y,
  });
  return {
    center: { x: p.centre.x, y, z: p.centre.z },
    view: NO_VIEW,
    solid: true,
    prisms: [
      ...[...p.walls, p.sill, p.pocket, p.deck].map(boxPrism),
      ...p.screens.map((s): PrismDef => ({ points: screenCorners(s).map(rel), bottom: s.floor - y, top: s.top - y })),
      { points: p.slab.corners.map(rel), bottom: p.slab.bottom - y, top: p.slab.top - y },
    ],
    scenery: true,
  };
};

const block = (b: LiftBox, material: "metal" | "glass"): Pick<StaticProp, "center" | "view" | "solid"> => ({
  center: { x: C.x + (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: C.z + (b.z0 + b.z1) / 2 },
  view: { kind: "block", size: { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }, material },
  solid: true,
});

/** The moving parts (ADR-0020): the platform, a gate at each level and a call button at each. */
const mechanism = (p: AlchemiaLiftPlan): StaticProp[] => {
  const [ground] = p.levels;
  return [
    { ...block(box(-HALF, HALF, -HALF, HALF, ground - PLATFORM, ground), "metal"), mechanism: { kind: "platform", key: p.key, levels: p.levels, speed: LIFT_SPEED } },
    ...p.gates.map((g, level): StaticProp => ({ ...block(g, "glass"), mechanism: { kind: "gate", elevator: p.key, level, travel: GATE } })),
    ...p.buttons.map((at, level): StaticProp => ({ center: at, view: { kind: "block", size: BUTTON, material: "glass" }, solid: false, mechanism: { kind: "button", elevator: p.key, level } })),
  ];
};

/** Every prop of the lift, after the hall's and the stalls' in the plot's chunk (their ids stay). */
export const ALCHEMIA_LIFT_PROPS: readonly StaticProp[] = [structure(ALCHEMIA_LIFT), ...mechanism(ALCHEMIA_LIFT)];
