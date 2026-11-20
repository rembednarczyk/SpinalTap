import type { GroundPoint, Vec3 } from "@seki/core";
import { ALCHEMIA_ROOF_PIECES, BED_RAISED, ROOF_PATHS, ROOF_Y, type AlchemiaBox, type AlchemiaPiece } from "@seki/sim";
import { type BoxFace, type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";
import { LAWN, band, insetConvex, lid } from "./storey-facade";

/*
 * The gallery's green roof (ADR-0093 O4) on the city kit's texture, in Alchemia's outside mesh (the
 * beds, pergolas, lanterns, services: seen from afar) and its inside one (the small things, drawn
 * near only): no mesh or draw call of its own. The beds as the board's: an edging of concrete round
 * the substrate, its top green (a lawn, a ground cover under the shrubs), a strip of green light along
 * the raised ones' edging by the ways (`docs/zasady-lokacji.md` §4: green for the ways); the ways
 * paved in pale flags, a few of them cracked or missing; the lanterns ruby, lit at night; the solar
 * panels sloping to the south. Pure data, no Babylon.
 */

type Tint = readonly [number, number, number];
const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const UP: Vec3 = { x: 0, y: 1, z: 0 };
const NO_BOTTOM: ReadonlySet<BoxFace> = new Set(["-y"]);
/** A paving flag shows only its top. */
const TOP_ONLY: ReadonlySet<BoxFace> = new Set(["-y", "+x", "-x", "+z", "-z"]);

const CONCRETE = hexRgb("#8a8c8a");
const SOIL = hexRgb("#4a3a2c");
const COVER = hexRgb("#3f7a3c");
const FLAG = hexRgb("#a3a39a");
const FLAG_DARK = hexRgb("#7c7d78");
const WOOD = hexRgb("#8a5a2e");
const TAPE = hexRgb("#9a9aa0");
const NAPKIN = hexRgb("#d8d4c8");
const FLOWERS: readonly string[] = ["#e8467a", "#f2c14a", "#b46cff", "#f2f4f6", "#ff7a3a", "#d83a3a"];
const CLOTHES: readonly string[] = ["#d84a4a", "#4a7ad8", "#e8e2d0", "#3a3a40", "#e8b84a", "#7ad8a0", "#b46cff"];
const CANS: readonly string[] = ["#c8202a", "#d0d4da", "#2a6ad0", "#e8c020"];

/** A number in [0, 1) from a box's place. */
const placeHash = (b: AlchemiaBox): number => {
  let h = Math.imul(Math.round(b.x0 * 100) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(Math.round(b.z0 * 100), 0xc2b2ae35) ^ Math.round(b.y0 * 100);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};
const pick = (list: readonly string[], b: AlchemiaBox): Tint => hexRgb(list[Math.floor(placeHash(b) * list.length)] ?? list[0]!);

const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string, tint?: Tint, skip?: ReadonlySet<BoxFace>): void => {
  sink.box({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch), tint, skip);
};

const at = (p: GroundPoint, y: number): Vec3 => ({ x: p.x, y, z: p.z });

/**
 * A bed: its edging's outer face, the rim's top between the outline and the inset one, the inner face
 * down to the substrate, the substrate's top green; a raised bed's strip of green light under the rim.
 */
const bed = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): void => {
  const pts = p.outline!;
  const { y0, y1 } = p.box;
  const raised = y1 - y0 >= BED_RAISED;
  const rim = raised ? 0.12 : 0.08;
  const inner = insetConvex(pts, rim);
  const sunk = raised ? 0.06 : 0.03;
  const paint = swatchUv(data, "paint");
  band(sink, pts, y0, y1, paint, undefined, CONCRETE);
  pts.forEach((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const [ia, ib] = [inner[i]!, inner[(i + 1) % inner.length]!];
    sink.quad(at(ia, y1), at(ib, y1), at(b, y1), at(a, y1), UP, paint, CONCRETE);
  });
  // The rim's inner face: the inset outline turned clockwise faces in.
  band(sink, [...inner].reverse(), y1 - sunk, y1, paint, undefined, CONCRETE);
  lid(sink, inner, y1 - sunk, 1, paint, raised ? COVER : LAWN);
  if (raised) band(sink, insetConvex(pts, -0.012), y1 - 0.11, y1 - 0.08, swatchUv(data, "neon-green"));
};

/** A table: its top on four legs. */
const table = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  boxOf(sink, data, { ...b, y0: b.y1 - 0.05 }, "rust");
  for (const [x, z] of [
    [b.x0 + 0.08, b.z0 + 0.08],
    [b.x1 - 0.08, b.z0 + 0.08],
    [b.x0 + 0.08, b.z1 - 0.08],
    [b.x1 - 0.08, b.z1 - 0.08],
  ] as const) boxOf(sink, data, { x0: x - 0.04, x1: x + 0.04, z0: z - 0.04, z1: z + 0.04, y0: b.y0 + 0.05, y1: b.y1 - 0.05 }, "dark", undefined, NO_BOTTOM);
};

/** A row of solar panels: legs at its corners, the panel sloping up to the north (its face to the south). */
const panel = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const low = b.y0 + 0.35;
  for (const [x, z, top] of [
    [b.x0 + 0.1, b.z0 + 0.1, low],
    [b.x1 - 0.1, b.z0 + 0.1, low],
    [b.x0 + 0.1, b.z1 - 0.1, b.y1],
    [b.x1 - 0.1, b.z1 - 0.1, b.y1],
  ] as const) boxOf(sink, data, { x0: x - 0.04, x1: x + 0.04, z0: z - 0.04, z1: z + 0.04, y0: b.y0 + 0.05, y1: top }, "metal", undefined, NO_BOTTOM);
  const [dy, dz] = [b.y1 - low, b.z1 - b.z0];
  const len = Math.hypot(dy, dz);
  const along: Vec3 = { x: 0, y: dy / len, z: dz / len };
  const normal: Vec3 = { x: 0, y: dz / len, z: -dy / len };
  sink.box({ x: (b.x0 + b.x1) / 2, y: (low + b.y1) / 2, z: (b.z0 + b.z1) / 2 }, [X, normal, along], [(b.x1 - b.x0) / 2, 0.025, len / 2], swatchUv(data, "glass-blue"));
};

/** The camping chair in its box, facing west (its back on the east): legs, seat, back, armrests. */
const chair = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const y = b.y0 + 0.05;
  for (const [x, z] of [
    [b.x0 + 0.05, b.z0 + 0.05],
    [b.x1 - 0.05, b.z0 + 0.05],
    [b.x0 + 0.05, b.z1 - 0.05],
    [b.x1 - 0.05, b.z1 - 0.05],
  ] as const) boxOf(sink, data, { x0: x - 0.02, x1: x + 0.02, z0: z - 0.02, z1: z + 0.02, y0: y, y1: y + 0.6 }, "metal", undefined, NO_BOTTOM);
  boxOf(sink, data, { x0: b.x0 + 0.03, x1: b.x1 - 0.03, z0: b.z0 + 0.03, z1: b.z1 - 0.03, y0: y + 0.36, y1: y + 0.42 }, "fabric-teal");
  boxOf(sink, data, { x0: b.x1 - 0.08, x1: b.x1 - 0.02, z0: b.z0 + 0.03, z1: b.z1 - 0.03, y0: y + 0.42, y1: b.y1 }, "fabric-teal");
  for (const z of [b.z0 + 0.02, b.z1 - 0.06]) boxOf(sink, data, { x0: b.x0 + 0.04, x1: b.x1 - 0.04, z0: z, z1: z + 0.04, y0: y + 0.58, y1: y + 0.62 }, "dark");
};

/** A crate of the residents' garden: its boards and the soil in it. */
const crate = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  boxOf(sink, data, { ...b, y0: b.y0 + 0.05 }, "paint", WOOD, NO_BOTTOM);
  boxOf(sink, data, { x0: b.x0 + 0.04, x1: b.x1 - 0.04, z0: b.z0 + 0.04, z1: b.z1 - 0.04, y0: b.y1, y1: b.y1 + 0.005 }, "paint", SOIL, TOP_ONLY);
};

/** A fan of the air handler: its grille and the cross of its guard. */
const fan = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  boxOf(sink, data, b, "ac-grille", undefined, NO_BOTTOM);
  const [mx, mz] = [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
  boxOf(sink, data, { ...b, y0: b.y1, y1: b.y1 + 0.02, z0: mz - 0.03, z1: mz + 0.03 }, "metal", undefined, NO_BOTTOM);
  boxOf(sink, data, { ...b, y0: b.y1, y1: b.y1 + 0.02, x0: mx - 0.03, x1: mx + 0.03 }, "metal", undefined, NO_BOTTOM);
};

/** The diagonals of an octagonal prism's second box (a box turned an eighth). */
const D1: Vec3 = { x: Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };
const D2: Vec3 = { x: -Math.SQRT1_2, y: 0, z: Math.SQRT1_2 };

/**
 * A paper lantern (chōchin): its ruby paper an octagon of two boxes, an eighth turned to each other,
 * so it reads round; black rims top and bottom, its cord up to the rafter.
 */
const lantern = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const c = { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 };
  const r = (b.x1 - b.x0) / 2;
  const h = (b.y1 - b.y0) / 2 - 0.03;
  const red = swatchUv(data, "neon-red");
  sink.box(c, [X, Y, Z], [r * 0.92, h, r * 0.92], red);
  sink.box(c, [D1, Y, D2], [r * 0.92, h, r * 0.92], red);
  for (const y of [b.y0 + 0.015, b.y1 - 0.015]) sink.box({ ...c, y }, [X, Y, Z], [r * 0.6, 0.015, r * 0.6], swatchUv(data, "dark"));
  boxOf(sink, data, { x0: c.x - 0.006, x1: c.x + 0.006, z0: c.z - 0.006, z1: c.z + 0.006, y0: b.y1, y1: b.y1 + 0.25 }, "cable");
};

/** Leaves in several greens (the kit's paint tinted, as `LEAF` of the storeys' curtains): a clump's shade by its place. */
const LEAVES: readonly string[] = ["#4f9a58", "#3f7a3c", "#5aa04a", "#2f6a3a", "#6a9a3a", "#467640"];

/** A number in [0, 1) from a point and a salt. */
const pointHash = (x: number, y: number, z: number, salt: number): number => {
  const h = Math.sin(x * 12.9898 + y * 39.346 + z * 78.233 + salt * 11.135) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * A clump of leaves (or a head of flowers) on the ground at `c`: an irregular low dome, its rim and
 * crown points pushed in and out by the hash, its crown leaning to one side, flat-shaded so the ink
 * draws its facets. No bottom (it sits on the soil or hangs against what carries it).
 */
const clump = (sink: GeometrySink, uv: readonly [number, number], c: Vec3, r: number, h: number, tint: Tint): void => {
  const segs = 5;
  const lean = { x: (pointHash(c.x, c.y, c.z, 1) - 0.5) * r * 0.7, z: (pointHash(c.x, c.y, c.z, 2) - 0.5) * r * 0.7 };
  const turn = pointHash(c.x, c.y, c.z, 3) * Math.PI * 2;
  const ring = (k: number, rr: number, y: number, salt: number): Vec3 => {
    const a = turn + (k / segs) * Math.PI * 2;
    const j = 0.75 + 0.45 * pointHash(c.x, c.z, k, salt);
    const shift = y > c.y ? 1 : 0;
    return { x: c.x + Math.cos(a) * rr * j + lean.x * 0.6 * shift, y: y + (pointHash(c.z, c.x, k, salt + 7) - 0.5) * h * 0.25, z: c.z + Math.sin(a) * rr * j + lean.z * 0.6 * shift };
  };
  const low = Array.from({ length: segs }, (_, k) => ring(k, r, c.y, 4));
  const mid = Array.from({ length: segs }, (_, k) => ring(k + 0.5, r * 0.75, c.y + h * 0.6, 5));
  const top: Vec3 = { x: c.x + lean.x, y: c.y + h, z: c.z + lean.z };
  const out = (a: Vec3, b: Vec3, d: Vec3): Vec3 => {
    const m = { x: (a.x + b.x + d.x) / 3 - c.x, y: (a.y + b.y + d.y) / 3 - c.y + 0.2 * h, z: (a.z + b.z + d.z) / 3 - c.z };
    const l = Math.hypot(m.x, m.y, m.z) || 1;
    return { x: m.x / l, y: m.y / l, z: m.z / l };
  };
  for (let k = 0; k < segs; k++) {
    const [a, b] = [low[k]!, low[(k + 1) % segs]!];
    const [m0, m1] = [mid[(k + segs - 1) % segs]!, mid[k]!];
    sink.quad(a, b, m1, m0, out(a, b, m1), uv, tint);
    sink.quad(m1, mid[(k + 1) % segs]!, top, top, out(m1, mid[(k + 1) % segs]!, top), uv, tint);
  }
};

/**
 * A piece of the roof's greenery (leaves in a crate, climbers on a rafter or down a post, a tuft of
 * flowers in a bed) as clumps filling its box along its longest side: never the box itself (the
 * user's decision: no square plants).
 */
const greenery = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, flower: boolean): void => {
  const uv = swatchUv(data, "paint");
  const [w, h, d] = [b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0];
  const tint = (x: number, y: number, z: number): Tint => (flower ? pick(FLOWERS, b) : hexRgb(LEAVES[Math.floor(pointHash(x, y, z, 9) * LEAVES.length)]!));
  if (h > Math.max(w, d) * 1.5) {
    // Down a post: clumps stacked round it, a little apart, each a different green.
    const r = Math.max(w, d) / 2;
    for (let y = b.y0; y < b.y1 - 0.05; y += r * 1.6) {
      const c = { x: (b.x0 + b.x1) / 2 + (pointHash(b.x0, y, b.z0, 6) - 0.5) * r * 0.5, y, z: (b.z0 + b.z1) / 2 + (pointHash(b.z0, y, b.x0, 6) - 0.5) * r * 0.5 };
      clump(sink, uv, c, r * 1.1, Math.min(r * 1.8, b.y1 - y), tint(c.x, c.y, c.z));
    }
    return;
  }
  const alongX = w >= d;
  const [len, short] = alongX ? [w, d] : [d, w];
  const n = Math.max(1, Math.round(len / (short * 1.1)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = alongX ? b.x0 + w * t : (b.x0 + b.x1) / 2;
    const z = alongX ? (b.z0 + b.z1) / 2 : b.z0 + d * t;
    const r = (short / 2) * (0.85 + 0.35 * pointHash(x, b.y0, z, 8));
    clump(sink, uv, { x, y: b.y0, z }, r, h * (0.75 + 0.35 * pointHash(z, b.y0, x, 8)), tint(x, b.y0, z));
  }
};

/** A plain box by kind: its swatch, and its tint (by the hash of its place where the kind has many colours). */
const LOOK: Readonly<Partial<Record<AlchemiaPiece["kind"], (b: AlchemiaBox) => readonly [string, Tint?]>>> = {
  pergola: () => ["rust"],
  laundry: (b) => ["paint", pick(CLOTHES, b)],
  can: (b) => ["paint", pick(CANS, b)],
  paper: (b) => ["paint", b.y1 - b.y0 > 0.02 ? TAPE : NAPKIN],
  machine: (b) => [b.y1 - b.y0 > 1 ? "ac" : "dark"],
  duct: () => ["ac"],
  mast: () => ["metal"],
  pipe: () => ["pipe"],
  cable: () => ["cable"],
  carton: () => ["fabric-amber"],
  cup: () => ["ac"],
  steam: () => ["win-white"],
  water: () => ["glass-blue"],
  error: () => ["neon-red"],
  beacon: () => ["neon-red"],
  display: () => ["win-teal"],
};

const ROOF_SET: ReadonlySet<AlchemiaPiece> = new Set(ALCHEMIA_ROOF_PIECES);

/** One of the green roof's pieces drawn by its kind: false for a piece of somewhere else. */
export const roofPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): boolean => {
  if (!ROOF_SET.has(p)) return false;
  const b = p.box;
  if ((p.kind === "planter" || p.kind === "lawn") && p.outline) bed(sink, data, p);
  else if (p.kind === "table") table(sink, data, b);
  else if (p.kind === "panel") panel(sink, data, b);
  else if (p.kind === "chair") chair(sink, data, b);
  else if (p.kind === "crate") crate(sink, data, b);
  else if (p.kind === "fan") fan(sink, data, b);
  else if (p.kind === "lantern") lantern(sink, data, b);
  else if (p.kind === "green" || p.kind === "flower") greenery(sink, data, b, p.kind === "flower");
  else {
    const [swatch, tint] = LOOK[p.kind]?.(b) ?? ["trim-light"];
    boxOf(sink, data, b, swatch, tint, b.y0 <= ROOF_Y + 0.01 ? NO_BOTTOM : undefined);
  }
  return true;
};

/** The flags' size along x and z, the joint between them. */
const FLAG_X = 0.9;
const FLAG_Z = 0.6;
const JOINT = 0.035;

/**
 * The paved ways (`ROOF_PATHS`): pale flags a hand over the slab, their tops only, in a running bond;
 * by the hash one in some thirty a darker patch and one in some fifty missing (§3: the roof is not
 * kept up as it was built).
 */
export const roofPaving = (sink: GeometrySink, data: CityKitData): void => {
  const y = ROOF_Y + 0.012;
  const paint = swatchUv(data, "paint");
  for (const r of ROOF_PATHS) {
    let row = 0;
    for (let z = r.z0; z < r.z1 - 0.05; z += FLAG_Z, row++) {
      const z1 = Math.min(z + FLAG_Z, r.z1);
      for (let x = r.x0 - (row % 2) * (FLAG_X / 2); x < r.x1 - 0.05; x += FLAG_X) {
        const [x0, x1] = [Math.max(x, r.x0), Math.min(x + FLAG_X, r.x1)];
        if (x1 - x0 < 0.1) continue;
        const b = { x0: x0 + JOINT / 2, x1: x1 - JOINT / 2, z0: z + JOINT / 2, z1: z1 - JOINT / 2, y0: y - 0.01, y1: y };
        const h = placeHash(b);
        if (h < 0.02) continue;
        sink.quad(at({ x: b.x0, z: b.z1 }, y), at({ x: b.x1, z: b.z1 }, y), at({ x: b.x1, z: b.z0 }, y), at({ x: b.x0, z: b.z0 }, y), UP, paint, h < 0.055 ? FLAG_DARK : FLAG);
      }
    }
  }
};
