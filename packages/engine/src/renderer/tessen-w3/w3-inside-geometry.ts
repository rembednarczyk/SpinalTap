import { SURFACE_LIFT } from "@seki/core";
import { INTERIORS, W3_INSIDE_BLOCKS, W3_LAYOUT, W3_ROW_N, W3_ROW_S, W3_Y, type W3Block } from "@seki/sim";
import { type CityKitData, GeometrySink } from "../city-kit-data";
import { KitPainter, W3_PAINT } from "./w3-kit";
import { inW3Hall } from "./w3-interior-cull";

/**
 * W-3's inside baked from the simulation's blocks (ADR-0082 §4, stage 2b), as Alchemia's is:
 * the rooms' walls, ceilings, the line, the furniture in the kit's swatches, and what only the
 * eye needs: the factory floor, the yellow stripes along the aisle and round the launch area,
 * the fluorescent strips under every ceiling, the server racks' lights, the warning lights over
 * the chamber's gate. Two sinks: `inside` (the hall's rooms and the basement, drawn near only)
 * and `outer` (the shut leaves in its facades and the culvert's mouth, always). Pure data.
 */

type Rect = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

const inRect = (r: Rect, x: number, z: number): boolean => x > r.minX && x < r.maxX && z > r.minZ && z < r.maxZ;

/** The server rooms: S at row S's east end, N at row N's (the virus's room). */
export const W3_SERVER_ROOMS: readonly Rect[] = [
  { minX: W3_LAYOUT.ROW_S_SPLITS[W3_LAYOUT.ROW_S_SPLITS.length - 1] as number, maxX: W3_ROW_S.maxX, minZ: W3_ROW_S.minZ, maxZ: W3_LAYOUT.ROW_S_ROOMS.maxZ },
  { minX: W3_LAYOUT.ROW_N_SPLITS[W3_LAYOUT.ROW_N_SPLITS.length - 1] as number, maxX: W3_ROW_N.maxX, minZ: W3_LAYOUT.ROW_N_ROOMS.minZ, maxZ: W3_ROW_N.maxZ },
];

const isRack = (b: W3Block): boolean => b.material === "metal" && Math.abs(b.size.y - 2.2) < 0.05 && W3_SERVER_ROOMS.some((r) => inRect(r, b.center.x, b.center.z));

/** A block's swatch and paint by what it is. */
const paintOf = (b: W3Block): { swatch: string; tint?: readonly [number, number, number] } => {
  const s = b.size;
  const flat = s.y <= 0.6 && s.x > 1 && s.z > 1;
  if (b.material === "metal") {
    if (Math.min(s.x, s.z) <= 0.15) return { swatch: "metal" };
    if (Math.abs(s.y - W3_LAYOUT.BELT_H) < 0.01 && s.x > 20) return { swatch: "dark" };
    if (Math.abs(s.y - W3_LAYOUT.ARM_BASE.height) < 0.01 && Math.abs(s.x - W3_LAYOUT.ARM_BASE.size) < 0.01) return { swatch: "paint", tint: W3_PAINT.graphite };
    if (isRack(b)) return { swatch: "dark" };
    if (Math.abs(s.y - 1.1) < 0.01) return { swatch: "paint", tint: W3_PAINT.olive };
    return { swatch: flat ? "trim" : "metal" };
  }
  if (flat) return b.center.y > W3_Y + 1 ? { swatch: "roof" } : { swatch: "paint", tint: W3_PAINT.floor };
  return { swatch: "paint", tint: W3_PAINT.wall };
};

const HALL = INTERIORS.filter((i) => i.id === "w3-hall").flatMap((i) => i.rooms);
const BASEMENT = INTERIORS.filter((i) => i.id === "w3-basement").flatMap((i) => i.rooms);

/**
 * The factory floor over the yard's asphalt in every ground-floor room: the asphalt is drawn
 * `SURFACE_LIFT.road` over the terrain and the feet stand on it, so the floor's top is just over that.
 */
export const FLOOR_TOP = SURFACE_LIFT.road + 0.012;
const floors = (k: KitPainter): void => {
  for (const r of HALL) if (Math.abs(r.bottom - W3_Y) < 0.01) k.box(r.minX, r.maxX, W3_Y + 0.02, W3_Y + FLOOR_TOP, r.minZ, r.maxZ, "paint", W3_PAINT.floor);
};

/** Yellow dashes along the aisle's edges and round the chamber's launch area. */
const stripes = (k: KitPainter): void => {
  const y0 = W3_Y + FLOOR_TOP;
  const y1 = y0 + 0.008;
  const { AISLE, BELT_X } = W3_LAYOUT;
  for (let x = BELT_X.minX - 2; x < BELT_X.maxX + 2; x += 2) {
    for (const z of [AISLE.minZ + 0.15, AISLE.maxZ - 0.15]) k.box(x, x + 1.2, y0, y1, z - 0.1, z + 0.1, "paint", W3_PAINT.yellow);
  }
  const pad = { minX: 2553, maxX: 2567, minZ: 411, maxZ: 425 };
  for (let u = 0; u < 14; u += 2) {
    k.box(pad.minX + u, pad.minX + u + 1.2, y0, y1, pad.minZ, pad.minZ + 0.2, "paint", W3_PAINT.yellow);
    k.box(pad.minX + u, pad.minX + u + 1.2, y0, y1, pad.maxZ - 0.2, pad.maxZ, "paint", W3_PAINT.yellow);
    k.box(pad.minX, pad.minX + 0.2, y0, y1, pad.minZ + u, pad.minZ + u + 1.2, "paint", W3_PAINT.yellow);
    k.box(pad.maxX - 0.2, pad.maxX, y0, y1, pad.minZ + u, pad.minZ + u + 1.2, "paint", W3_PAINT.yellow);
  }
};

/** Fluorescent strips under a room's ceiling along its longer side, a row every `every` metres across. */
const strips = (k: KitPainter, r: { minX: number; maxX: number; minZ: number; maxZ: number; top: number; bottom: number }): void => {
  const w = r.maxX - r.minX;
  const d = r.maxZ - r.minZ;
  // Not in the openings through the walls (thin boxes of the interior's rooms) nor in the culvert.
  if (w < 1.5 || d < 1.5 || w * d < 4 || r.top - r.bottom < 2) return;
  const high = r.top - r.bottom > 8;
  const y1 = high ? r.top - 2.5 : r.top - 0.03;
  const along = w >= d ? "x" : "z";
  const [a0, a1, b0, b1] = along === "x" ? [r.minX, r.maxX, r.minZ, r.maxZ] : [r.minZ, r.maxZ, r.minX, r.maxX];
  const every = high ? 5 : 4;
  const rows = Math.max(1, Math.round((b1 - b0) / every));
  for (let i = 0; i < rows; i++) {
    const b = b0 + ((b1 - b0) * (i + 0.5)) / rows;
    for (let a = a0 + 0.6; a < a1 - 0.6; a += 6.6) {
      const end = Math.min(a + 6, a1 - 0.6);
      if (end - a < 0.8) continue;
      if (along === "x") k.box(a, end, y1 - 0.1, y1, b - 0.12, b + 0.12, "win-white");
      else k.box(b - 0.12, b + 0.12, y1 - 0.1, y1, a, end, "win-white");
    }
  }
};

/** The racks' status lights on both long faces, teal and green in a fixed pattern. */
const rackLights = (k: KitPainter, b: W3Block): void => {
  const alongX = b.size.x > b.size.z;
  const len = alongX ? b.size.x : b.size.z;
  const half = (alongX ? b.size.z : b.size.x) / 2;
  const cols = Math.floor(len / 0.6);
  for (let c = 0; c < cols; c++) {
    for (let row = 0; row < 5; row++) {
      const u = (alongX ? b.center.x : b.center.z) - len / 2 + 0.3 + c * 0.6;
      const y = b.center.y - b.size.y / 2 + 0.4 + row * 0.35;
      const swatch = (c * 7 + row * 3) % 5 === 0 ? "neon-green" : "win-teal";
      for (const side of [-1, 1]) {
        const v = (alongX ? b.center.z : b.center.x) + side * (half + 0.005);
        if (alongX) k.box(u - 0.2, u + 0.2, y, y + 0.06, v - 0.01, v + 0.01, swatch);
        else k.box(v - 0.01, v + 0.01, y, y + 0.06, u - 0.2, u + 0.2, swatch);
      }
    }
  }
};

/** Red lights over the chamber's gate from the hall, amber over the wagon airlock's mouth; orange pipes under the hall's ceiling. */
const warnings = (k: KitPainter): void => {
  const gate = W3_LAYOUT.CHAMBER_GATE_W;
  const x = 2548 - W3_LAYOUT.WALL - 0.12;
  for (const z of [gate.minZ - 0.6, gate.maxZ + 0.6]) k.box(x, x + 0.12, W3_Y + gate.height + 0.2, W3_Y + gate.height + 0.6, z - 0.2, z + 0.2, "neon-red");
  k.box(x, x + 0.1, W3_Y + gate.height + 0.1, W3_Y + gate.height + 0.25, gate.minZ, gate.maxZ, "paint", W3_PAINT.yellow);
  const wx = 2510 + W3_LAYOUT.WALL + 0.02;
  for (const z of [413.6, 422.4]) k.box(wx, wx + 0.12, W3_Y + W3_LAYOUT.WAGON_OPENING + 0.2, W3_Y + W3_LAYOUT.WAGON_OPENING + 0.6, z - 0.2, z + 0.2, "neon-amber");
  for (const z of [407.4, 428.6]) k.beam({ x: 2510.5, y: W3_Y + 13.6, z }, { x: 2547.5, y: W3_Y + 13.6, z }, 0.35, "paint", W3_PAINT.orange);
};

/**
 * The assembly hall's walls as on picture 02: steel columns every 6 m up to the crane's tracks and
 * an olive band along their foot. The stations' screens move with the job: the line's mesh draws them.
 */
const hallDress = (k: KitPainter): void => {
  const t = W3_LAYOUT.WALL;
  const south = 406 + t;
  const north = 430 - t;
  for (let x = 2513; x < 2547; x += 6) {
    k.box(x - 0.25, x + 0.25, W3_Y, W3_Y + W3_LAYOUT.CRANE_TRACK - 0.5, south, south + 0.35, "paint", W3_PAINT.graphite);
    k.box(x - 0.25, x + 0.25, W3_Y, W3_Y + W3_LAYOUT.CRANE_TRACK, north - 0.35, north, "paint", W3_PAINT.graphite);
  }
  for (const [z0, z1] of [
    [south, south + 0.03],
    [north - 0.03, north],
  ] as const) {
    k.box(2510 + t, 2548 - t, W3_Y + FLOOR_TOP, W3_Y + 1.3, z0, z1, "paint", W3_PAINT.olive);
  }
};

/** The inside (near only) and the outer pieces (always) of W-3's hall. */
export const w3InsideGeometry = (data: CityKitData, blocks: readonly W3Block[] = W3_INSIDE_BLOCKS): { readonly inside: GeometrySink; readonly outer: GeometrySink } => {
  const inside = new KitPainter(new GeometrySink(), data);
  const outer = new KitPainter(new GeometrySink(), data);
  for (const b of blocks) {
    const k = inW3Hall(b.center) ? inside : outer;
    const p = paintOf(b);
    const { x, y, z } = b.size;
    k.box(b.center.x - x / 2, b.center.x + x / 2, b.center.y - y / 2, b.center.y + y / 2, b.center.z - z / 2, b.center.z + z / 2, p.swatch, p.tint);
    if (isRack(b)) rackLights(inside, b);
  }
  floors(inside);
  stripes(inside);
  hallDress(inside);
  for (const r of [...HALL, ...BASEMENT]) strips(inside, r);
  warnings(inside);
  return { inside: inside.sink, outer: outer.sink };
};
