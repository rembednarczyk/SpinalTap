import { type ActivityId, type GroundPoint, type StreetPropItem, type Vec3, figureVariant, measuredTreeVariant } from "@seki/core";
import type { Rect } from "../builders";
import type { CrowdSpot } from "../crowd-spot";
import { groundY } from "../lublin/terrain";
import { type Box, type Piece, box, outlined, piece } from "./plan";
import { FOUNTAIN_CENTRE, FOUNTAIN_RADIUS, PLAZA_TOP, PODIUM } from "./front-plaza";
import { modelBoxes } from "./shops";

/*
 * What stands on the square before the front (C5 of the board 1:1, 19.11), `front-plaza.ts` for the
 * podium, its stairs and the fountain: the board's food kiosks at the stairs' foot (a counter with lit
 * food under glass, sign bands round the roof, awnings sloping over the counter and one side), tables
 * under umbrellas with chairs, and the game's own furniture: drinks machines by the ramp's parapet,
 * bins, a bench, planters with a tree, a street cabinet the kiosk takes its power from (its cable
 * taped up the wall, §3), the sellers in the kiosks. Built of boxes only what the game has no model
 * of (a kiosk, an umbrella, a table, a chair), in the board's shapes. Traces of a moment ago (§5): a
 * cup steaming on a table, a carton half eaten, a chair knocked over, flyers by a kiosk.
 */

const CHUNK = "krakowskie-2-1";
const cm = (v: number): number => Math.round(v * 100) / 100;

/** The highest ground under a rectangle's corners and middle. */
const highest = (r: Rect): number => Math.max(...[[r.minX, r.minZ], [r.maxX, r.minZ], [r.minX, r.maxZ], [r.maxX, r.maxZ], [(r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2]].map(([x, z]) => groundY(x!, z!)));
const lowest = (r: Rect): number => Math.min(...[[r.minX, r.minZ], [r.maxX, r.minZ], [r.minX, r.maxZ], [r.maxX, r.maxZ]].map(([x, z]) => groundY(x!, z!)));

/** Is a point on the podium (its floor the podium's top), or on the square's ground? */
const onPodium = (x: number, z: number): boolean => x >= PODIUM.minX && x <= PODIUM.maxX && z >= PODIUM.minZ && z <= PODIUM.maxZ;
const floorAt = (x: number, z: number): number => (onPodium(x, z) ? PLAZA_TOP : groundY(x, z));

/** Which way a kiosk's counter looks (outwards). */
export type Face = "s" | "e" | "n" | "w";

export interface PlazaKiosk {
  readonly id: string;
  readonly rect: Rect;
  readonly face: Face;
  /** The side with the second awning, as seen from before the counter. */
  readonly side: "left" | "right";
  /** Its sign bands' colours, left to right along the front. */
  readonly signs: readonly ["sign-red" | "sign-amber", "sign-red" | "sign-amber"];
}

/**
 * The kiosks: one at the west stairs' foot with its counter to the street (the board's, at the
 * stairs' foot), one by the square's corner at Świętoduska with its counter to the square (the
 * board's yellow one at the corner). Both on the square's paving, clear of the stairs, the footway
 * and the green slope's foot.
 */
export const PLAZA_KIOSKS: readonly PlazaKiosk[] = [
  { id: "stairs", rect: { minX: 387.6, maxX: 390.0, minZ: -7.2, maxZ: -5.6 }, face: "s", side: "left", signs: ["sign-red", "sign-amber"] },
  { id: "corner", rect: { minX: 381.6, maxX: 383.6, minZ: -6.4, maxZ: -4.8 }, face: "e", side: "right", signs: ["sign-amber", "sign-amber"] },
];

/** A kiosk's frame: its front's length, its depth, and (u along the front left to right seen from before it, v in from the front) to the world. */
const frameOf = (k: PlazaKiosk): { readonly w: number; readonly d: number; readonly at: (u: number, v: number) => GroundPoint } => {
  const r = k.rect;
  const [wx, wz] = [r.maxX - r.minX, r.maxZ - r.minZ];
  switch (k.face) {
    case "s":
      return { w: wx, d: wz, at: (u, v) => ({ x: r.minX + u, z: r.minZ + v }) };
    case "n":
      return { w: wx, d: wz, at: (u, v) => ({ x: r.maxX - u, z: r.maxZ - v }) };
    case "e":
      return { w: wz, d: wx, at: (u, v) => ({ x: r.maxX - v, z: r.minZ + u }) };
    case "w":
      return { w: wz, d: wx, at: (u, v) => ({ x: r.minX + v, z: r.maxZ - u }) };
  }
};

/** Counter-clockwise on the map: the signed area's sign. */
const ccw = (pts: readonly GroundPoint[]): boolean => pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % pts.length]!.z - pts[(i + 1) % pts.length]!.x * p.z, 0) > 0;

/** A kiosk's height to its roof's underside over its floor, its counter's, the awnings' reach and drop. */
const KIOSK = { roof: 2.5, counter: 1.0, vitrine: 0.35, awning: 0.85, drop: 0.35, wall: 0.08 } as const;

/** A kiosk's sitting: the floor (its low corner) and the height its parts count from (its high one). */
const kioskBase = (k: PlazaKiosk): { readonly floor: number; readonly y: number } => ({ floor: lowest(k.rect) - 0.1, y: highest(k.rect) });

/**
 * A kiosk: its counter at the front with lit food under glass on it, walls round its back and sides,
 * posts at the counter's ends up to the roof, the roof with sign bands round its edge, an awning over
 * the counter and one over a side (drawn sloping, `awning`), inside a back counter with a hot plate
 * steaming, a menu screen and a light under the roof; cups on the counter, flyers on the ground.
 */
const kioskPieces = (k: PlazaKiosk): Piece[] => {
  const f = frameOf(k);
  const { floor, y } = kioskBase(k);
  const K = KIOSK;
  const lb = (u0: number, u1: number, v0: number, v1: number, y0: number, y1: number): Box => {
    const [a, b] = [f.at(u0, v0), f.at(u1, v1)];
    return box(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), y0, y1);
  };
  /** An awning from the edge (u0, v0)-(u1, v1) high out to the parallel edge `out` along (du, dv), sloping down. */
  const awning = (hi: readonly [number, number, number, number], du: number, dv: number): Piece => {
    const [u0, v0, u1, v1] = hi;
    const pts = [f.at(u0, v0), f.at(u1, v1), f.at(u1 + du, v1 + dv), f.at(u0 + du, v0 + dv)];
    const ordered = ccw(pts) ? pts : [pts[1]!, pts[0]!, pts[3]!, pts[2]!];
    return outlined(ordered, y + K.roof - 0.2 - K.drop, y + K.roof - 0.2, "awning", false);
  };
  const { w, d } = f;
  const t = K.wall;
  const top = y + K.roof;
  const side = k.side === "left" ? 0 : w;
  const out = k.side === "left" ? -K.awning * 0.8 : K.awning * 0.8;
  return [
    piece(lb(0, w, 0, 0.55, floor, y + K.counter), "counter", false),
    piece(lb(0.08, w - 0.08, 0.04, 0.5, y + K.counter, y + K.counter + K.vitrine), "food", false, false),
    // A strip of light along the counter's front under its top, the counter itself dark steel.
    piece(lb(0.06, w - 0.06, -0.012, 0, y + K.counter - 0.12, y + K.counter - 0.06), "sign-amber", false, false),
    piece(lb(0, t, 0.55, d, floor, top), "wall", false),
    piece(lb(w - t, w, 0.55, d, floor, top), "wall", false),
    piece(lb(t, w - t, d - t, d, floor, top), "wall", false),
    piece(lb(0, t, 0, 0.08, y + K.counter, top), "counter", false),
    piece(lb(w - t, w, 0, 0.08, y + K.counter, top), "counter", false),
    piece(lb(-0.15, w + 0.15, -0.15, d + 0.15, top, top + 0.14), "roof", false, false),
    piece(lb(-0.15, w * 0.55, -0.2, -0.15, top - 0.08, top + 0.26), k.signs[0], false, false),
    piece(lb(w * 0.55, w + 0.15, -0.2, -0.15, top - 0.08, top + 0.26), k.signs[1], false, false),
    piece(lb(k.side === "left" ? -0.2 : w + 0.15, k.side === "left" ? -0.15 : w + 0.2, -0.15, d + 0.15, top - 0.08, top + 0.26), k.signs[1], false, false),
    awning([0, 0, w, 0], 0, -K.awning),
    awning([side, 0.15, side, d - 0.15], out, 0),
    // Inside: the back counter, the hot plate steaming, the menu on the back wall, the light under the roof.
    piece(lb(0.1, w - 0.1, d - 0.5, d - t, floor, y + 0.9), "counter", false),
    piece(lb(0.25, 0.85, d - 0.45, d - 0.15, y + 0.9, y + 0.96), "lamp", false, false),
    piece(lb(0.35, 0.75, d - 0.4, d - 0.2, y + 1.05, y + 1.5), "steam", false, false),
    piece(lb(0.3, w - 0.3, d - t - 0.02, d - t, y + 1.45, y + 2.2), "display", false, false),
    piece(lb(0.2, w - 0.2, 0.7, 0.8, top - 0.06, top - 0.01), "lamp", false, false),
    // On the counter: two cups, one steaming; flyers on the paving before it.
    piece(lb(w * 0.7, w * 0.7 + 0.08, 0.1, 0.18, y + K.counter + K.vitrine, y + K.counter + K.vitrine + 0.1), "cup", false, false),
    piece(lb(w * 0.7 + 0.01, w * 0.7 + 0.07, 0.11, 0.17, y + K.counter + K.vitrine + 0.12, y + K.counter + K.vitrine + 0.4), "steam", false, false),
    piece(lb(w * 0.25, w * 0.25 + 0.08, 0.3, 0.38, y + K.counter + K.vitrine, y + K.counter + K.vitrine + 0.1), "cup", false, false),
    piece(lb(w * 0.3, w * 0.3 + 0.21, -0.9, -0.6, groundY(f.at(w * 0.3, -0.8).x, f.at(w * 0.3, -0.8).z) + 0.003, groundY(f.at(w * 0.3, -0.8).x, f.at(w * 0.3, -0.8).z) + 0.008), "paper", false, false),
    piece(lb(w * 0.75, w * 0.75 + 0.3, -1.3, -1.1, groundY(f.at(w * 0.75, -1.2).x, f.at(w * 0.75, -1.2).z) + 0.003, groundY(f.at(w * 0.75, -1.2).x, f.at(w * 0.75, -1.2).z) + 0.008), "paper", false, false),
    // Cartons stacked against its back.
    piece(lb(w - 0.7, w - 0.2, d, d + 0.4, floor, y + 0.45), "carton", false),
    piece(lb(w - 0.65, w - 0.3, d + 0.05, d + 0.35, y + 0.45, y + 0.75), "carton", false),
  ];
};

/** Where a kiosk's seller stands (inside, between its counters) and its customers (before the counter), facing each other. */
export const kioskSpots = (k: PlazaKiosk): { readonly seller: Vec3; readonly customers: readonly Vec3[]; readonly yaw: number } => {
  const f = frameOf(k);
  const at = (u: number, v: number): Vec3 => {
    const p = f.at(u, v);
    return { x: cm(p.x), y: cm(groundY(p.x, p.z)), z: cm(p.z) };
  };
  const yaw = { s: Math.PI, n: 0, e: Math.PI / 2, w: -Math.PI / 2 }[k.face];
  return { seller: { ...at(f.w * 0.45, 0.95), y: cm(kioskBase(k).floor + 0.1) }, customers: [at(f.w * 0.3, -0.65), at(f.w * 0.75, -0.75)], yaw };
};

/** A café table: where, its chairs' sides (`x-`, `x+`, `z-`, `z+`), whether its umbrella is up, a chair knocked over beside it. */
export interface CafeTable {
  readonly x: number;
  readonly z: number;
  readonly chairs: readonly ("x-" | "x+" | "z-" | "z+")[];
  readonly knocked?: true;
}

/** Two tables east of the fountain by the drinks machines, one west of it, one at the kiosks' end of the square. */
export const CAFE_TABLES: readonly CafeTable[] = [
  { x: 403.4, z: -6.2, chairs: ["x-", "x+"], knocked: true },
  { x: 403.4, z: -3.8, chairs: ["x-", "x+"] },
  { x: 395.8, z: -4.6, chairs: ["x-", "x+"] },
  { x: 385.4, z: -3.2, chairs: ["x-", "x+"] },
];

const TABLE = { r: 0.4, top: 0.76, chair: 0.62, seat: 0.45, back: 0.9, canopy: 1.1, rim: 2.05, apex: 2.45 } as const;

/** An octagon round (x, z), counter-clockwise. */
const octagon = (x: number, z: number, r: number): GroundPoint[] => Array.from({ length: 8 }, (_, i) => ({ x: x + r * Math.cos((i * Math.PI) / 4 + Math.PI / 8), z: z + r * Math.sin((i * Math.PI) / 4 + Math.PI / 8) }));

const CHAIR_DIR = { "x-": [-1, 0], "x+": [1, 0], "z-": [0, -1], "z+": [0, 1] } as const;

/** A chair a seat's height, legs, a back on its far side from the table: drawn; its solid is its seat's footprint. */
const chair = (cx: number, cz: number, dx: number, dz: number, y: number): Piece[] => {
  const h = 0.21;
  const out: Piece[] = [piece(box(cx - h, cx + h, cz - h, cz + h, y + TABLE.seat - 0.04, y + TABLE.seat), "chair", false, false)];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) out.push(piece(box(cx + sx * (h - 0.03) - 0.015, cx + sx * (h - 0.03) + 0.015, cz + sz * (h - 0.03) - 0.015, cz + sz * (h - 0.03) + 0.015, y, y + TABLE.seat - 0.04), "frame", false, false));
  const [bx, bz] = [cx + dx * (h - 0.02), cz + dz * (h - 0.02)];
  out.push(piece(box(dx === 0 ? cx - h : bx - 0.02, dx === 0 ? cx + h : bx + 0.02, dz === 0 ? cz - h : bz - 0.02, dz === 0 ? cz + h : bz + 0.02, y + TABLE.seat, y + TABLE.back), "chair", false, false));
  return out;
};

/** A table: its round top on a column, its umbrella over it (a canopy the engine draws as a cone), a lamp under it; its chairs; a cup steaming and a carton on it. */
const tablePieces = (t: CafeTable, k: number): Piece[] => {
  const y = floorAt(t.x, t.z);
  const out: Piece[] = [
    outlined(octagon(t.x, t.z, TABLE.r), y + TABLE.top - 0.04, y + TABLE.top, "table", false),
    piece(box(t.x - 0.03, t.x + 0.03, t.z - 0.03, t.z + 0.03, y, y + TABLE.top - 0.04), "frame", false, false),
    outlined(octagon(t.x, t.z, 0.22), y, y + 0.03, "frame", false),
    piece(box(t.x - 0.025, t.x + 0.025, t.z - 0.025, t.z + 0.025, y + TABLE.top, y + TABLE.apex), "column", false, false),
    outlined(octagon(t.x, t.z, TABLE.canopy), y + TABLE.rim, y + TABLE.apex, "umbrella", false),
    piece(box(t.x - 0.12, t.x + 0.12, t.z - 0.12, t.z + 0.12, y + TABLE.rim - 0.1, y + TABLE.rim - 0.02), "lamp", false, false),
    // A cup steaming on it (its sitter got up a moment ago), every other table a carton of food.
    piece(box(t.x + 0.1, t.x + 0.18, t.z - 0.05, t.z + 0.03, y + TABLE.top, y + TABLE.top + 0.1), "cup", false, false),
    piece(box(t.x + 0.125, t.x + 0.155, t.z - 0.025, t.z + 0.005, y + TABLE.top + 0.12, y + TABLE.top + 0.24), "steam", false, false),
  ];
  if (k % 2 === 0) out.push(piece(box(t.x - 0.22, t.x - 0.04, t.z - 0.12, t.z + 0.06, y + TABLE.top, y + TABLE.top + 0.07), "carton", false, false));
  for (const c of t.chairs) {
    const [dx, dz] = CHAIR_DIR[c];
    out.push(...chair(t.x + dx * TABLE.chair, t.z + dz * TABLE.chair, dx, dz, y));
  }
  if (t.knocked) {
    // A chair on its back south of the table, its seat upright: somebody left in a hurry.
    const [cx, cz] = [t.x + 0.5, t.z - 0.95];
    out.push(piece(box(cx - 0.21, cx + 0.21, cz - 0.45, cz, y, y + 0.04), "chair", false, false));
    out.push(piece(box(cx - 0.21, cx + 0.21, cz, cz + 0.04, y, y + 0.42), "chair", false, false));
  }
  return out;
};

/** The solids of a table and its chairs (not drawn: the drawn parts are thinner): the top's octagon to the floor, a chair's seat's footprint. */
const tableSolids = (t: CafeTable): Piece[] => {
  const y = floorAt(t.x, t.z);
  const out: Piece[] = [outlined(octagon(t.x, t.z, TABLE.r), y - 0.05, y + TABLE.top, "table")];
  for (const c of t.chairs) {
    const [dx, dz] = CHAIR_DIR[c];
    const [cx, cz] = [t.x + dx * TABLE.chair, t.z + dz * TABLE.chair];
    out.push(piece(box(cx - 0.21, cx + 0.21, cz - 0.21, cz + 0.21, y - 0.05, y + TABLE.seat), "chair", true));
  }
  if (t.knocked) out.push(piece(box(t.x + 0.29, t.x + 0.71, t.z - 1.4, t.z - 0.91, y - 0.05, y + 0.42), "chair", true));
  return out;
};

/** The street cabinet behind the stairs' kiosk and the cable from it taped up the kiosk's back to its roof (§3). */
const CABINET: GroundPoint = { x: 386.9, z: -5.3 };
const cable = (): Piece[] => {
  const k = PLAZA_KIOSKS[0]!;
  const { y } = kioskBase(k);
  const g = groundY(CABINET.x, CABINET.z);
  return [
    piece(box(CABINET.x - 0.02, CABINET.x + 0.02, CABINET.z - 0.02, CABINET.z + 0.02, g + 1.15, y + KIOSK.roof + 0.3), "cable", false, false),
    piece(box(CABINET.x - 0.02, k.rect.minX, CABINET.z - 0.02, CABINET.z + 0.02, y + KIOSK.roof + 0.28, y + KIOSK.roof + 0.32), "cable", false, false),
  ];
};

/** Every drawn piece of the square's kiosks and café. */
export const plazaCafePieces = (): Piece[] => [...PLAZA_KIOSKS.flatMap(kioskPieces), ...CAFE_TABLES.flatMap(tablePieces), ...cable()];

const item = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant = 0, y = floorAt(x, z)): StreetPropItem => ({ prop, x, y, z, yaw, variant });

/** A seller standing in a kiosk, facing out over the counter (a still figure of the game's, as the gallery's shops' sellers). */
const seller = (k: PlazaKiosk, look: number): StreetPropItem => {
  const s = kioskSpots(k);
  return item("figure", s.seller.x, s.seller.z, s.yaw, figureVariant({ pose: look % 2 === 0 ? "stand" : "hips", body: look % 2 === 0 ? "b" : "a", seat: 0, look }), s.seller.y);
};

/**
 * The game's models on the square: two drinks machines against the ramp's parapet facing the
 * podium, bins by the kiosks and the tables, a bench at the green slope's foot, planters by the
 * arcade's piers and one with a tree between the kiosks, the street cabinet, the kiosks' sellers and
 * a planter on the stairs' kiosk's roof (the board's).
 */
export const FRONT_PLAZA_PROPS: readonly StreetPropItem[] = [
  item("vending-machine", 409.25, -4.3, -Math.PI / 2, 0),
  item("vending-machine", 409.25, -3.2, -Math.PI / 2, 1),
  item("waste-bin", 409.3, -5.4, -Math.PI / 2, 1),
  item("waste-bin", 401.9, -2.6, 0, 2),
  item("waste-bin", 386.95, -6.5, Math.PI, 0),
  item("waste-bin", 384.3, -4.0, Math.PI / 2, 3),
  item("bench", 390.4, -2.65, Math.PI, 1),
  item("planter", 397.22, -2.55, 0, 3),
  item("planter", 402.92, -2.55, 0, 5),
  item("planter", 385.6, -7.6, 0, 2),
  item("tree", 385.6, -7.6, 1.3, measuredTreeVariant(7, 6.5), groundY(385.6, -7.6) + 0.45),
  item("street-cabinet", CABINET.x, CABINET.z, -Math.PI / 2, 0),
  ...PLAZA_KIOSKS.map((k, i) => seller(k, 3 + i * 5)),
  item("planter", 388.3, -6.1, 0, 4, kioskBase(PLAZA_KIOSKS[0]!).y + KIOSK.roof + 0.14),
];

/** The square's solids: the drawn ones of the kiosks and café, the tables' and chairs' footprints, the game's models' boxes (not the sellers, inside the kiosks). */
export const plazaCafeSolids = (): Piece[] => [
  ...CAFE_TABLES.flatMap(tableSolids),
  ...modelBoxes(FRONT_PLAZA_PROPS.filter((p) => p.prop !== "figure" && p.y < floorAt(p.x, p.z) + 1)),
];

const spot = (at: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]], group?: string): CrowdSpot => (group ? { chunk: CHUNK, at, yaw, does, group } : { chunk: CHUNK, at, yaw, does });

/** One sitting on the fountain's rim at `a` round it, facing out. */
const rimSitter = (a: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => {
  const r = FOUNTAIN_RADIUS + 0.2;
  return spot({ x: cm(FOUNTAIN_CENTRE.x + r * Math.cos(a)), y: PLAZA_TOP, z: cm(FOUNTAIN_CENTRE.z + r * Math.sin(a)) }, Math.atan2(Math.cos(a), Math.sin(a)), does);
};

/**
 * The square's still crowd (ADR-0060): customers queueing at the kiosks' counters, sitters on the
 * café's chairs facing their tables and on the fountain's rim, one at the drinks machines.
 */
export const PLAZA_CROWD: readonly CrowdSpot[] = [
  ...PLAZA_KIOSKS.flatMap((k) => {
    const s = kioskSpots(k);
    return s.customers.map((c, i) => spot(c, s.yaw + Math.PI, i === 0 ? ["talk"] : ["phone", "eat"], `plaza-kiosk-${k.id}`));
  }),
  ...CAFE_TABLES.flatMap((t, k) =>
    t.chairs.map((c) => {
      const [dx, dz] = CHAIR_DIR[c];
      const at = { x: t.x + dx * TABLE.chair, y: floorAt(t.x, t.z), z: t.z + dz * TABLE.chair };
      return spot(at, Math.atan2(-dx, -dz), k % 2 === 0 ? ["sit", "eat"] : ["sit", "drink"], `plaza-table-${k}`);
    }),
  ),
  rimSitter(Math.atan2(-0.53, -0.85), ["sit", "phone"]),
  spot({ x: 408.3, y: PLAZA_TOP, z: -3.75 }, Math.PI / 2, ["phone"]),
];

/** What of the square's furniture stands in plan: the kiosks, the tables with their chairs (the map's furniture keeps clear of them). */
export const PLAZA_FOOTPRINTS: readonly Rect[] = [
  ...PLAZA_KIOSKS.map((k) => k.rect),
  ...CAFE_TABLES.map((t) => ({ minX: t.x - 0.9, maxX: t.x + 0.9, minZ: t.z - 0.9, maxZ: t.z + 0.9 })),
];
