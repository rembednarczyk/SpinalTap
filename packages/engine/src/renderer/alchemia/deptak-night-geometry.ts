import type { Vec3 } from "@seki/core";
import { type AlchemiaBox, type AlchemiaPiece, CART_CLEAR, DEPTAK_NIGHT_CABLES, DEPTAK_NIGHT_PIECES, DEPTAK_NIGHT_STRINGS, type LanternString, stringY } from "@seki/sim";
import { type BoxFace, type CityKitData, type GeometrySink, hexRgb, swatchUv } from "../city-kit-data";

/*
 * The deptak's south end at night (22.11, `deptak-night.ts` of the simulation): the chōchin over it,
 * the yatai and its stools, in Alchemia's tiers mesh as the deptak's stalls (C7): no mesh or draw call
 * of its own. Real shapes (`docs/zasady-lokacji.md` §9): a chōchin is a paper barrel between two
 * black rims on a hook, lit red or amber; a wheel, the pot and a stool's seat are round (drawn as
 * octagons); a string sags between its ends; the noren is cloth, dark indigo with a pale band. Pure
 * data, no Babylon.
 */

type Tint = readonly [number, number, number];
const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };
const R = Math.SQRT1_2;
/** The diagonals of the level plane and of the plane across x (y, z): an octagon is a square and the square turned 45°. */
const D1: Vec3 = { x: R, y: 0, z: R };
const D2: Vec3 = { x: -R, y: 0, z: R };
const E1: Vec3 = { x: 0, y: R, z: R };
const E2: Vec3 = { x: 0, y: -R, z: R };
const NO_BOTTOM: ReadonlySet<BoxFace> = new Set(["-y"]);

const WOOD = hexRgb("#7a4a26");
const WOOD_DARK = hexRgb("#4a2c18");
const INDIGO = hexRgb("#22284a");
const PALE = hexRgb("#d8d2c0");
const CANS: readonly Tint[] = ["#c8202a", "#d0d4da", "#2a6ad0", "#e8c020"].map(hexRgb);

const NIGHT_SET: ReadonlySet<AlchemiaPiece> = new Set(DEPTAK_NIGHT_PIECES);

const centre = (b: AlchemiaBox): Vec3 => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: (b.z0 + b.z1) / 2 });
const boxOf = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox, swatch: string, tint?: Tint, skip?: ReadonlySet<BoxFace>): void => {
  sink.box(centre(b), [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, swatch), tint, skip);
};
/** An upright octagonal prism of radius r from y0 to y1 at (x, z). */
const octagon = (sink: GeometrySink, data: CityKitData, x: number, z: number, r: number, y0: number, y1: number, swatch: string, tint?: Tint): void => {
  const c = { x, y: (y0 + y1) / 2, z };
  const h = (y1 - y0) / 2;
  sink.box(c, [X, Y, Z], [r * 0.92, h, r * 0.38], swatchUv(data, swatch), tint);
  sink.box(c, [X, Y, Z], [r * 0.38, h, r * 0.92], swatchUv(data, swatch), tint);
  sink.box(c, [D1, Y, D2], [r * 0.92, h, r * 0.38], swatchUv(data, swatch), tint);
  sink.box(c, [D1, Y, D2], [r * 0.38, h, r * 0.92], swatchUv(data, swatch), tint);
};

/** A number in [0, 1) from a box's place: a lantern's colour. */
const placeHash = (b: AlchemiaBox): number => {
  let h = Math.imul(Math.round(b.x0 * 100) ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(Math.round(b.z0 * 100), 0xc2b2ae35) ^ Math.round(b.y0 * 100);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** A chōchin: the paper barrel (narrower at its ends) lit red, one in four amber, its black rims, the hook up to its string. */
const chochin = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const c = centre(b);
  const r = (b.x1 - b.x0) / 2;
  const h = b.y1 - b.y0;
  const paper = placeHash(b) < 0.25 ? "neon-amber" : "neon-red";
  const rim = 0.04;
  octagon(sink, data, c.x, c.z, r * 0.82, b.y0 + rim, b.y0 + rim + (h - 2 * rim) * 0.25, paper);
  octagon(sink, data, c.x, c.z, r, b.y0 + rim + (h - 2 * rim) * 0.25, b.y1 - rim - (h - 2 * rim) * 0.25, paper);
  octagon(sink, data, c.x, c.z, r * 0.82, b.y1 - rim - (h - 2 * rim) * 0.25, b.y1 - rim, paper);
  octagon(sink, data, c.x, c.z, r * 0.6, b.y0, b.y0 + rim, "dark");
  octagon(sink, data, c.x, c.z, r * 0.6, b.y1 - rim, b.y1, "dark");
  boxOf(sink, data, { x0: c.x - 0.006, x1: c.x + 0.006, z0: c.z - 0.006, z1: c.z + 0.006, y0: b.y1, y1: b.y1 + 0.22 }, "cable");
};

/** A wheel on the axle across x: its tyre an octagon in the plane of y and z, the hub proud of it. */
const wheel = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const c = centre(b);
  const r = (b.y1 - b.y0) / 2;
  const t = (b.x1 - b.x0) / 2;
  for (const axes of [
    [X, Y, Z],
    [X, E1, E2],
  ] as const)
    sink.box(c, axes, [t, r * 0.92, r * 0.92], swatchUv(data, "dark"));
  sink.box(c, [X, Y, Z], [t + 0.015, r * 0.25, r * 0.25], swatchUv(data, "metal"));
};

/** A stool: its round seat on four splayed legs, a rail between them. */
const stool = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const c = centre(b);
  const r = (b.x1 - b.x0) / 2;
  octagon(sink, data, c.x, c.z, r, b.y1 - 0.04, b.y1, "paint", WOOD);
  for (const [dx, dz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    const [x, z] = [c.x + dx * r * 0.55, c.z + dz * r * 0.55];
    boxOf(sink, data, { x0: x - 0.015, x1: x + 0.015, z0: z - 0.015, z1: z + 0.015, y0: b.y0, y1: b.y1 - 0.04 }, "metal", undefined, NO_BOTTOM);
  }
  boxOf(sink, data, { x0: c.x - r * 0.55, x1: c.x + r * 0.55, z0: c.z - 0.01, z1: c.z + 0.01, y0: b.y0 + 0.18, y1: b.y0 + 0.2 }, "metal");
};

/** The cart's body over its wheels (its solid reaches the ground): its planks (dark seams every 0.2 m along it), a darker plinth. */
const cartBody = (sink: GeometrySink, data: CityKitData, solid: AlchemiaBox): void => {
  const b = { ...solid, y0: solid.y0 + CART_CLEAR };
  boxOf(sink, data, b, "paint", WOOD);
  boxOf(sink, data, { ...b, x0: b.x0 - 0.005, x1: b.x1 + 0.005, z0: b.z0 - 0.005, z1: b.z1 + 0.005, y1: b.y0 + 0.08 }, "paint", WOOD_DARK);
  for (let y = b.y0 + 0.2; y < b.y1 - 0.05; y += 0.2)
    boxOf(sink, data, { x0: b.x0 - 0.006, x1: b.x1 + 0.006, z0: b.z0 - 0.006, z1: b.z1 + 0.006, y0: y, y1: y + 0.012 }, "paint", WOOD_DARK);
};

/** A noren's cloth: indigo, a pale band a third down where its name is dyed. */
const noren = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  boxOf(sink, data, b, "paint", INDIGO);
  const h = b.y1 - b.y0;
  boxOf(sink, data, { ...b, x0: b.x0 - 0.003, x1: b.x1 + 0.003, z0: b.z0 + 0.04, z1: b.z1 - 0.04, y0: b.y1 - h * 0.45, y1: b.y1 - h * 0.3 }, "paint", PALE);
};

/** Steam: three thin wisps rising from the box's foot, staggered and leaning, thinning upwards (never a block). */
const steam = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  const c = centre(b);
  const h = b.y1 - b.y0;
  const w = (b.x1 - b.x0) / 2;
  for (const [k, dx, dz, lean] of [
    [0, -0.4, 0, 0.12],
    [1, 0.3, 0.25, -0.1],
    [2, 0, -0.3, 0.06],
  ] as const) {
    const top = b.y0 + h * (0.7 + 0.15 * k);
    for (let y = b.y0 + 0.02 * k, i = 0; y < top; y += 0.06, i++) {
      const t = (y - b.y0) / h;
      const r = 0.012 * (1 - t * 0.6);
      const x = c.x + dx * w + lean * t;
      boxOf(sink, data, { x0: x - r, x1: x + r, z0: c.z + dz * w - r, z1: c.z + dz * w + r, y0: y, y1: Math.min(top, y + 0.045) }, "win-white");
    }
  }
};

/**
 * A lightbox (the menu on the roof, the standing sign): lit, a dark frame round it, its words as dark
 * strokes on both faces (across its long face; down the standing sign, its letters one under another).
 */
const lightbox = (sink: GeometrySink, data: CityKitData, b: AlchemiaBox): void => {
  boxOf(sink, data, b, "win-warm");
  const [w, d, h] = [b.x1 - b.x0, b.z1 - b.z0, b.y1 - b.y0];
  boxOf(sink, data, { x0: b.x0 - 0.01, x1: b.x1 + 0.01, z0: b.z0 - 0.01, z1: b.z1 + 0.01, y0: b.y1 - 0.02, y1: b.y1 + 0.01 }, "dark");
  boxOf(sink, data, { x0: b.x0 - 0.01, x1: b.x1 + 0.01, z0: b.z0 - 0.01, z1: b.z1 + 0.01, y0: b.y0 - 0.01, y1: b.y0 + 0.02 }, "dark");
  const upright = h > Math.max(w, d) * 1.5;
  const alongZ = d >= w;
  const proud = 0.006;
  if (upright) {
    for (let y = b.y1 - 0.12; y > b.y0 + 0.1; y -= 0.16) {
      const s = 0.045;
      const face = alongZ ? { x0: b.x0 - proud, x1: b.x1 + proud, z0: (b.z0 + b.z1) / 2 - s, z1: (b.z0 + b.z1) / 2 + s } : { z0: b.z0 - proud, z1: b.z1 + proud, x0: (b.x0 + b.x1) / 2 - s, x1: (b.x0 + b.x1) / 2 + s };
      boxOf(sink, data, { ...face, y0: y - 0.05, y1: y + 0.04 }, "dark");
    }
    return;
  }
  const len = alongZ ? d : w;
  for (let k = 0; k < 3; k++) {
    const y = b.y1 - h * (0.3 + 0.22 * k);
    const [a0, a1] = [0.08 + 0.05 * (k % 2), len - 0.08 - 0.12 * k];
    const span = alongZ ? { z0: b.z0 + a0, z1: b.z0 + a1, x0: b.x0 - proud, x1: b.x1 + proud } : { x0: b.x0 + a0, x1: b.x0 + a1, z0: b.z0 - proud, z1: b.z1 + proud };
    boxOf(sink, data, { ...span, y0: y - 0.025, y1: y + 0.02 }, "dark");
  }
};

/** One of the deptak's night pieces drawn by its kind: false for a piece of somewhere else, or one drawn as Alchemia's plain boxes. */
export const deptakNightPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): boolean => {
  if (!NIGHT_SET.has(p)) return false;
  const b = p.box;
  if (p.kind === "lantern") chochin(sink, data, b);
  else if (p.kind === "machine") wheel(sink, data, b);
  else if (p.kind === "chair") stool(sink, data, b);
  else if (p.kind === "counter") cartBody(sink, data, b);
  else if (p.kind === "bench" || p.kind === "roof" || p.kind === "mast") boxOf(sink, data, b, "paint", WOOD_DARK);
  else if (p.kind === "awning") noren(sink, data, b);
  else if (p.kind === "pipe") octagon(sink, data, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, (b.x1 - b.x0) / 2, b.y0, b.y1, "metal");
  else if (p.kind === "can") boxOf(sink, data, b, "paint", CANS[Math.floor(placeHash(b) * CANS.length)]);
  else if (p.kind === "crate") boxOf(sink, data, b, "paint", hexRgb("#2a6a3a"), NO_BOTTOM);
  else if (p.kind === "steam") steam(sink, data, b);
  else if (p.kind === "lightbox") lightbox(sink, data, b);
  else return false;
  return true;
};

/** Segments a string is drawn in (its sag a parabola, `stringY`). */
const SEGMENTS = 16;

/** A sagging cable from `a` to `b` (its ends' line along x), 1.2 cm thick. */
const cable = (sink: GeometrySink, data: CityKitData, s: LanternString): void => {
  const uv = swatchUv(data, "cable");
  for (let i = 0; i < SEGMENTS; i++) {
    const [xa, xb] = [s.a.x + ((s.b.x - s.a.x) * i) / SEGMENTS, s.a.x + ((s.b.x - s.a.x) * (i + 1)) / SEGMENTS];
    const [ya, yb] = [stringY(s, xa), stringY(s, xb)];
    const len = Math.hypot(xb - xa, yb - ya);
    const along: Vec3 = { x: (xb - xa) / len, y: (yb - ya) / len, z: 0 };
    const up: Vec3 = { x: -along.y, y: along.x, z: 0 };
    sink.box({ x: (xa + xb) / 2, y: (ya + yb) / 2, z: s.a.z }, [along, up, Z], [len / 2 + 0.004, 0.006, 0.006], uv);
  }
};

/** The lanterns' strings over the deptak and the cart's power cable. */
export const deptakNightStrings = (sink: GeometrySink, data: CityKitData): void => {
  for (const s of [...DEPTAK_NIGHT_STRINGS, ...DEPTAK_NIGHT_CABLES]) cable(sink, data, s);
};
