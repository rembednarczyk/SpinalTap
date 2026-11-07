import type { GroundPoint, Vec3 } from "@seki/core";
import type { StaticProp } from "../builders";
import { LIFT_HOLE } from "./foodhall";
import { type Box, HALL, type Piece, box, piece } from "./plan";

/**
 * The lift of Alchemia (ADR-0074 §4, stage 1): T0 ↔ the food hall (-6.4), the mechanism of
 * ADR-0020 (a platform, a gate and a call button at each level) in a shaft against the hall's
 * back wall beside the stairs. Its bottom opening faces north into the hall, its top one south
 * onto the car park, over the back wall's top; above the roof the shaft is a kiosk of glass.
 * Stage 5 adds a stop at P-2. The gates fill their openings to a head over them, as on the old
 * lift (G-289), so nobody stands on a gate's top or gets into the shaft from outside.
 */

const HALF = 1.1;
const WALL = 0.1;
const OPENING = 2.3;
const LINTEL = 0.25;
const HEAD = 0.3;
const CAP = 0.15;
const PLATFORM = 0.3;
const SPEED = 2.5;
const BUTTON = { x: 0.22, y: 0.32, z: 0.22 } as const;
const BUTTON_Y = 1.2;

/** The shaft's middle: the hole in the roof less the walls. */
const C: GroundPoint = { x: (LIFT_HOLE.minX + LIFT_HOLE.maxX) / 2, z: (LIFT_HOLE.minZ + LIFT_HOLE.maxZ) / 2 };

export interface FoodhallLift {
  readonly key: string;
  readonly centre: GroundPoint;
  readonly half: number;
  readonly wall: number;
  /** World y: the levels (the platform's top at each), the bottom of the shaft and its head. */
  readonly levels: readonly [number, number];
  readonly base: number;
  readonly head: number;
  /** World boxes: the walls (glass above the roof), the heads over the gates, the cap. */
  readonly walls: readonly Box[];
  readonly gates: readonly [Box, Box];
  readonly heads: readonly [Box, Box];
  readonly cap: Box;
  readonly buttons: readonly [Vec3, Vec3];
  /** Where a rider steps in at each level: a step out of the opening. */
  readonly doors: readonly [Vec3, Vec3];
}

const plan = (): FoodhallLift => {
  const [low, top] = [HALL.floor, HALL.roof];
  const out = HALF + WALL;
  const base = low - PLATFORM;
  const head = top + OPENING + LINTEL;
  const b = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number): Box => box(C.x + x0, C.x + x1, C.z + z0, C.z + z1, y0, y1);
  return {
    key: "alchemia-lift",
    centre: C,
    half: HALF,
    wall: WALL,
    levels: [low, top],
    base,
    head,
    walls: [
      b(-out, -HALF, -out, out, base, head),
      b(HALF, out, -out, out, base, head),
      // North: open at the hall's floor; south: open at the roof.
      b(-HALF, HALF, HALF, out, low + OPENING, head),
      b(-HALF, HALF, -out, -HALF, base, top),
      b(-HALF, HALF, -out, -HALF, top + OPENING, head),
    ],
    gates: [b(-HALF, HALF, out, out + WALL, low, low + OPENING), b(-HALF, HALF, -out - WALL, -out, top, top + OPENING)],
    heads: [b(-HALF, HALF, out, out + WALL, low + OPENING, low + OPENING + HEAD), b(-HALF, HALF, -out - WALL, -out, top + OPENING, head)],
    cap: b(-out, out, -out - WALL, out + WALL, head, head + CAP),
    buttons: [
      { x: C.x + out + BUTTON.x / 2, y: low + BUTTON_Y, z: C.z + out + 0.25 },
      { x: C.x + out + BUTTON.x / 2, y: top + BUTTON_Y, z: C.z - out - 0.35 },
    ],
    doors: [
      { x: C.x, y: low, z: C.z + out + 1.0 },
      { x: C.x, y: top, z: C.z - out - 1.0 },
    ],
  };
};

/** The lift as the simulation has it and the engine draws it. */
export const ALCHEMIA_LIFT: FoodhallLift = plan();

/** The shaft's pieces: walls of glass over the roof, steel below it, the heads and the cap. */
export const liftPieces = (p: FoodhallLift = ALCHEMIA_LIFT): Piece[] => [
  ...p.walls.flatMap((w) =>
    w.y1 <= HALL.roof || w.y0 >= HALL.roof
      ? [piece(w, w.y0 >= HALL.roof ? "glass" : "wall", w.y0 >= HALL.roof)]
      : [piece({ ...w, y1: HALL.roof }, "wall", true), piece({ ...w, y0: HALL.roof }, "glass", false)],
  ),
  ...p.heads.map((h) => piece(h, "frame", false)),
  piece(p.cap, "roof", false),
];

const block = (b: Box, material: "metal" | "glass"): Pick<StaticProp, "center" | "view" | "solid"> => ({
  center: { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 },
  view: { kind: "block", size: { x: b.x1 - b.x0, y: b.y1 - b.y0, z: b.z1 - b.z0 }, material },
  solid: true,
});

/** The moving parts (ADR-0020): the platform, a gate at each level and a call button at each. */
export const ALCHEMIA_LIFT_MECHANISM: readonly StaticProp[] = (() => {
  const p = ALCHEMIA_LIFT;
  const [low] = p.levels;
  const platform = box(p.centre.x - HALF, p.centre.x + HALF, p.centre.z - HALF, p.centre.z + HALF, low - PLATFORM, low);
  return [
    { ...block(platform, "metal"), mechanism: { kind: "platform", key: p.key, levels: p.levels, speed: SPEED } },
    ...p.gates.map((g, level): StaticProp => ({ ...block(g, "glass"), mechanism: { kind: "gate", elevator: p.key, level, travel: OPENING } })),
    ...p.buttons.map((at, level): StaticProp => ({ center: at, view: { kind: "block", size: BUTTON, material: "glass" }, solid: false, mechanism: { kind: "button", elevator: p.key, level } })),
  ];
})();
