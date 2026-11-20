import type { GroundPoint, Vec3 } from "@seki/core";
import type { GroundCut } from "../../world/ground";
import type { StaticProp } from "../builders";
import { LIFT_HOLE } from "./foodhall";
import { P2 } from "./p2";
import { MALL_LEVELS } from "./mall-plan";
import { type Box, HALL, type Piece, box, piece } from "./plan";

/**
 * The lift of Alchemia (ADR-0074 §4, stage 1): T0 ↔ the food hall (-6.4) ↔ P-2 (-9.2, stage 5c), and
 * since ADR-0093 O1 on up through the gallery's P2 and P3 to its roof (north into each),
 * the mechanism of ADR-0020 (a platform, a gate and a call button at each level) in a shaft against
 * the hall's back wall beside the stairs. Its hall opening faces north into the hall, its top one
 * south onto the car park, over the back wall's top, its P-2 one east into P-2's service corridor
 * (whose west wall is the shaft's east face); above the roof the shaft is a kiosk of glass, under
 * the hall's floor a cut down to its pit. The gates fill their openings to a head over them, as on the old
 * lift (G-289), so nobody stands on a gate's top or gets into the shaft from outside.
 */

const HALF = 1.1;
const WALL = 0.1;
const OPENING = 2.3;
/** How far P-2's gate reaches into the shaft from its east face: the platform is this much short of it. */
const GATE_DEPTH = 0.2;
const LINTEL = 0.25;
const HEAD = 0.3;
const CAP = 0.15;
const PLATFORM = 0.3;
const SPEED = 2.5;
const BUTTON = { x: 0.22, y: 0.32, z: 0.22 } as const;
const BUTTON_Y = 1.2;

/** The shaft's middle: the hole in the roof less the walls. */
const C: GroundPoint = { x: (LIFT_HOLE.minX + LIFT_HOLE.maxX) / 2, z: (LIFT_HOLE.minZ + LIFT_HOLE.maxZ) / 2 };

/** A side of the shaft, where a level's opening faces. */
export type LiftSide = "n" | "s" | "e";

export interface FoodhallLift {
  readonly key: string;
  readonly centre: GroundPoint;
  readonly half: number;
  readonly wall: number;
  /** World y: the levels, lowest first (the platform's top at each), the bottom of the shaft and its head. */
  readonly levels: readonly [number, ...number[]];
  /** Which side each level opens to. */
  readonly sides: readonly LiftSide[];
  readonly base: number;
  readonly head: number;
  /** World boxes: the walls (glass above the roof), the heads over the gates, the cap. */
  readonly walls: readonly Box[];
  readonly gates: readonly Box[];
  readonly heads: readonly Box[];
  readonly cap: Box;
  readonly buttons: readonly Vec3[];
  /** Where a rider steps in at each level: a step out of the opening. */
  readonly doors: readonly Vec3[];
  /** The P-2 opening's span along the corridor's west wall (z), for the corridor's wall. */
  readonly p2Door: { readonly z0: number; readonly z1: number; readonly top: number };
}

/** The spans of [y0, y1] outside every opening [y, y + OPENING]. */
const between = (y0: number, y1: number, openings: readonly number[]): [number, number][] => {
  const out: [number, number][] = [];
  let y = y0;
  for (const o of [...openings].sort((a, b) => a - b)) {
    if (o > y + 1e-6) out.push([y, o]);
    y = Math.max(y, o + OPENING);
  }
  if (y1 > y + 1e-6) out.push([y, y1]);
  return out;
};

/**
 * A lift's shaft round `c` serving `levels`, each opening to its side (ADR-0093 O1: a level on any
 * side, as many as the building has). The west wall stands from the shaft's bottom, the others from
 * the lowest level; at P-2 (an east opening at the lowest level) the gate fills the corridor's wall.
 */
const plan = (key: string, c: GroundPoint, levels: readonly [number, ...number[]], sides: readonly LiftSide[], p2Ceiling?: number): FoodhallLift => {
  const pit = levels[0];
  const top = levels[levels.length - 1]!;
  const out = HALF + WALL;
  const base = pit - PLATFORM;
  const head = top + OPENING + LINTEL;
  const b = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => box(c.x + x0, c.x + x1, c.z + z0, c.z + z1, y0, y1);
  const opens = (side: LiftSide) => levels.filter((_, i) => sides[i] === side);
  const headOf = (y: number) => (y === top ? head : y + OPENING + HEAD);
  return {
    key,
    centre: c,
    half: HALF,
    wall: WALL,
    levels,
    sides,
    base,
    head,
    walls: [
      b(-out, -HALF, -out, out, base, head),
      ...between(pit, head, opens("e")).map(([y0, y1]) => b(HALF, out, -out, out, y0, y1)),
      // North and south stand on the lowest level's floor: under it (P-2's) the corridor's floor slab runs into the shaft's pit.
      ...between(pit, head, opens("n")).map(([y0, y1]) => b(-HALF, HALF, HALF, out, y0, y1)),
      ...between(pit, head, opens("s")).map(([y0, y1]) => b(-HALF, HALF, -out, -HALF, y0, y1)),
    ],
    // At P-2 the gate fills the corridor's wall's thickness (G-275: by a gate a tenth thick a shot from the
    // shoulder started in the empty shaft behind it), the platform stopping short of it (`GATE_DEPTH`).
    gates: levels.map((y, i) =>
      sides[i] === "e" ? b(HALF - GATE_DEPTH, out, -HALF, HALF, y, y + OPENING) : sides[i] === "n" ? b(-HALF, HALF, out, out + WALL, y, y + OPENING) : b(-HALF, HALF, -out - WALL, -out, y, y + OPENING),
    ),
    heads: levels.map((y, i) =>
      // At P-2 the corridor's ceiling is the opening's head: none of its own (zero high, left out).
      sides[i] === "e"
        ? b(out, out + WALL, -HALF, HALF, y + OPENING, Math.max(y + OPENING, p2Ceiling ?? y + OPENING))
        : sides[i] === "n"
          ? b(-HALF, HALF, out, out + WALL, y + OPENING, headOf(y))
          : b(-HALF, HALF, -out - WALL, -out, y + OPENING, headOf(y)),
    ),
    cap: b(-out, out, -out - WALL, out + WALL, head, head + CAP),
    buttons: levels.map((y, i) =>
      sides[i] === "e"
        ? { x: c.x + out + WALL + 0.35, y: y + BUTTON_Y, z: c.z + out + 0.3 }
        : sides[i] === "n"
          ? { x: c.x + out + BUTTON.x / 2, y: y + BUTTON_Y, z: c.z + out + 0.25 }
          : { x: c.x + out + BUTTON.x / 2, y: y + BUTTON_Y, z: c.z - out - 0.35 },
    ),
    doors: levels.map((y, i) => (sides[i] === "e" ? { x: c.x + out + 1.0, y, z: c.z } : sides[i] === "n" ? { x: c.x, y, z: c.z + out + 1.0 } : { x: c.x, y, z: c.z - out - 1.0 })),
    p2Door: { z0: c.z - HALF, z1: c.z + HALF, top: pit + OPENING },
  };
};

/** The lift as the simulation has it and the engine draws it. */
export const ALCHEMIA_LIFT: FoodhallLift = plan(
  "alchemia-lift",
  C,
  [P2.floor, HALL.floor, HALL.roof, MALL_LEVELS.p2, MALL_LEVELS.p3, MALL_LEVELS.roof],
  ["e", "n", "s", "n", "n", "n"],
  P2.ceiling,
);

/**
 * The gallery's second lift (ADR-0093 O1) in its north-east core, beside the stairs: from P1 to the
 * roof, opening south onto the gallery's east side. P0's corner under it is Oyaji's shop (O3 moves it).
 */
export const ALCHEMIA_LIFT_NE: FoodhallLift = plan(
  "alchemia-lift-ne",
  { x: 430.2, z: 53.2 },
  [HALL.roof, MALL_LEVELS.p2, MALL_LEVELS.p3, MALL_LEVELS.roof],
  ["s", "s", "s", "s"],
);

/** The shaft under the hall's floor, dug down to its pit (stage 5c): the platform goes down to P-2 through it. */
export const LIFT_SHAFT_CUT: GroundCut = (() => {
  const l = ALCHEMIA_LIFT;
  const r = l.half + l.wall;
  return { bounds: { minX: l.centre.x - r, maxX: l.centre.x + r, minZ: l.centre.z - r, maxZ: l.centre.z + r }, floor: l.base };
})();

/**
 * The shaft's pieces: steel under the hall's roof, glass over it (in the gallery and the kiosk on the
 * roof, drawn near), the heads and the cap.
 */
export const liftPieces = (p: FoodhallLift = ALCHEMIA_LIFT): Piece[] => [
  ...p.walls.flatMap((w) =>
    w.y1 <= HALL.roof || w.y0 >= HALL.roof
      ? [piece(w, w.y0 >= HALL.roof ? "glass" : "wall", w.y0 >= HALL.roof)]
      : [piece({ ...w, y1: HALL.roof }, "wall", true), piece({ ...w, y0: HALL.roof }, "glass", false)],
  ),
  ...p.heads.filter((h) => h.y1 - h.y0 > 0.01).map((h) => piece(h, "frame", false)),
  piece(p.cap, "roof", false),
];

const block = (b: Box, material: "metal" | "glass"): Pick<StaticProp, "center" | "view" | "solid"> => ({
  center: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 },
  view: { kind: "block", size: { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }, material },
  solid: true,
});

/** The moving parts of a lift (ADR-0020): the platform (resting at `rest`), a gate at each level and a call button at each. */
export const liftMechanism = (p: FoodhallLift, rest: number): StaticProp[] => {
  const low = p.levels[rest] ?? p.levels[0];
  const platform = box(p.centre.x - HALF, p.centre.x + HALF - GATE_DEPTH, p.centre.z - HALF, p.centre.z + HALF, low - PLATFORM, low);
  return [
    { ...block(platform, "metal"), mechanism: { kind: "platform", key: p.key, levels: p.levels, speed: SPEED } },
    ...p.gates.map((g, level): StaticProp => ({ ...block(g, "glass"), mechanism: { kind: "gate", elevator: p.key, level, travel: OPENING } })),
    // Static: drawn merged with the interiors' blocks (ADR-0038), one draw call for them all (stage 5c added P-2's).
    ...p.buttons.map((at, level): StaticProp => ({ center: at, view: { kind: "block", size: BUTTON, material: "glass", interior: true }, solid: false, mechanism: { kind: "button", elevator: p.key, level } })),
  ];
};

/** The food hall's lift: the platform starts at the hall's floor (its second level), as before stage 5c. */
export const ALCHEMIA_LIFT_MECHANISM: readonly StaticProp[] = liftMechanism(ALCHEMIA_LIFT, 1);
/** The north-east core's: at P1. */
export const ALCHEMIA_LIFT_NE_MECHANISM: readonly StaticProp[] = liftMechanism(ALCHEMIA_LIFT_NE, 0);
