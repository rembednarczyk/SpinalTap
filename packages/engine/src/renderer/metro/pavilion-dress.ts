import type { RenderQuality } from "../../npr/quality";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type PavilionFrame, frameBox, placeHash, pylonSide, rod } from "./pavilion-frame";

/**
 * What makes a pavilion an entrance of the metro (ADR-0071 stage 3): the pylon at the opening's
 * corner with a cube on top and the letter "M" on its four faces in the game's own neon tubes,
 * a plate under the cube for the entrance's letter, the departures screen over the opening, the
 * lights under the eaves and the roof, and the 2077 layer: a camera over the opening and
 * stickers on the glass. The letter is drawn here, not copied: two uprights and a V reaching
 * under the middle, in the line's amber (`#ffbf4a`, the map's line), not Warsaw's red.
 */

export const LINE_AMBER = "#ffbf4a";
const AMBER: Rgba = hexColor(LINE_AMBER, DRESS_FLAG.lit);
const DARK = hexColor("#17191e");
const STEEL = hexColor("#2b2f36");
const SCREEN_BACK: Rgba = hexColor("#0b2433", DRESS_FLAG.lit);
const SCREEN_ROWS: readonly Rgba[] = [AMBER, hexColor("#36c5ff", DRESS_FLAG.lit)];
const EAVE_LIGHT: Rgba = hexColor("#fff0d0", DRESS_FLAG.lit);
const ROOF_LIGHT: Rgba = hexColor("#e8f4ff", DRESS_FLAG.lit);
const LENS: Rgba = hexColor("#ff3048", DRESS_FLAG.lit);
const STICKERS: readonly Rgba[] = ["#ff2e88", "#00e5ff", "#ffd400", "#f4f1ea", "#b46cff"].map((c) => hexColor(c));

/** The pylon: its footprint in the opening's corner, its height over the street and its cube. */
export const PYLON = { size: 0.5, height: 4.2, cube: 0.8 } as const;
/** The plate under the cube, for the entrance's letter. */
export const PYLON_PLATE = { bottom: 2.55, top: 2.95 } as const;

/** Where the pylon stands: (u, w) of its middle in the pavilion's frame. */
export const pylonAt = (f: PavilionFrame): { u: number; w: number } => ({ u: PYLON.size / 2 - 0.03, w: pylonSide(f.e) * (f.half - PYLON.size / 2 + 0.05) });

const add = (a: Vec, b: Vec, k: number): Vec => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const UP: Vec = { x: 0, y: 1, z: 0 };

/** The letter on one face of the cube, `n` its outward normal, in tubes `t` thick. */
const letterM = (sink: MeshSink, centre: Vec, n: Vec, size: number): void => {
  // The viewer's right on a face looking along -n (left-handed, y up).
  const right: Vec = { x: -n.z, y: 0, z: n.x };
  const c = add(centre, n, size / 2 + 0.03);
  const w = size * 0.31;
  const h = size * 0.3;
  const at = (x: number, y: number): Vec => add(add(c, right, x), UP, y);
  const [bl, tl, v, tr, br] = [at(-w, -h), at(-w, h), at(0, -h * 0.15), at(w, h), at(w, -h)];
  const t = size * 0.075;
  rod(sink, bl, tl, t, AMBER);
  rod(sink, tl, v, t, AMBER);
  rod(sink, v, tr, t, AMBER);
  rod(sink, tr, br, t, AMBER);
};

const bakePylon = (sink: MeshSink, f: PavilionFrame): void => {
  const p = pylonAt(f);
  const half = PYLON.size / 2;
  const cubeBottom = f.street + PYLON.height - PYLON.cube;
  frameBox(sink, f, [p.u - half, p.u + half], [p.w - half, p.w + half], [f.street - 0.05, cubeBottom], STEEL);
  const centre = f.at(p.u, p.w, cubeBottom + PYLON.cube / 2);
  sink.box(centre, PYLON.cube, PYLON.cube, PYLON.cube, DARK);
  for (const n of [f.inward, f.across]) for (const k of [-1, 1]) letterM(sink, centre, { x: n.x * k, y: 0, z: n.z * k }, PYLON.cube);
  // The plate on the pylon's street face, an amber line over it; the letter itself is in the signs' mesh.
  const face = p.u - half;
  frameBox(sink, f, [face - 0.03, face], [p.w - half + 0.02, p.w + half - 0.02], [f.street + PYLON_PLATE.bottom, f.street + PYLON_PLATE.top], DARK);
  frameBox(sink, f, [face - 0.035, face], [p.w - half + 0.02, p.w + half - 0.02], [f.street + PYLON_PLATE.top, f.street + PYLON_PLATE.top + 0.03], AMBER);
};

/** The departures over the opening on the lintel: rows of the line's amber and the minutes in cyan (no text: the hall's 2077 screen). */
const bakeScreen = (sink: MeshSink, f: PavilionFrame): void => {
  const s = f.street;
  frameBox(sink, f, [-0.05, 0], [-0.95, 0.95], [s + 2.58, s + 3.0], SCREEN_BACK);
  for (let r = 0; r < 3; r++) {
    const y = s + 2.67 + r * 0.12;
    const long = 0.55 + 0.45 * placeHash(f.e, r);
    frameBox(sink, f, [-0.056, -0.05], [-0.85, -0.85 + long], [y - 0.025, y + 0.025], SCREEN_ROWS[0]!);
    frameBox(sink, f, [-0.056, -0.05], [0.6, 0.82], [y - 0.025, y + 0.025], SCREEN_ROWS[1]!);
  }
};

/** Warm lights under the eaves before the opening, cool strips under the roof over the stairs and the hall. */
const bakeLights = (sink: MeshSink, f: PavilionFrame): void => {
  frameBox(sink, f, [-0.5, -0.1], [-1, 1], [f.top - 0.012, f.top - 0.002], EAVE_LIGHT, true);
  for (const w of [-0.6, 0.6]) frameBox(sink, f, [0.6, f.length - 0.6], [w - 0.06, w + 0.06], [f.top - 0.012, f.top - 0.002], ROOF_LIGHT, true);
};

/** The 2077 layer: a camera over the opening, stickers on the glass by it (none on the phone). */
const bakeStreetLayer = (sink: MeshSink, f: PavilionFrame, quality: RenderQuality): void => {
  const w = -pylonSide(f.e) * 1.0;
  const y = f.street + 3.0;
  frameBox(sink, f, [-0.22, 0], [w - 0.06, w + 0.06], [y - 0.05, y + 0.05], STEEL, true);
  frameBox(sink, f, [-0.25, -0.22], [w - 0.025, w + 0.025], [y - 0.025, y + 0.025], LENS);
  if (quality === "low") return;
  for (let i = 0; i < 4; i++) {
    const k = placeHash(f.e, 10 + i) < 0.5 ? -1 : 1;
    const u = 0.4 + placeHash(f.e, 20 + i) * 2.2;
    const h = 0.12 + placeHash(f.e, 30 + i) * 0.18;
    const y0 = f.street + 0.85 + placeHash(f.e, 40 + i) * 0.9;
    const color = STICKERS[Math.floor(placeHash(f.e, 50 + i) * STICKERS.length)] ?? STICKERS[0]!;
    frameBox(sink, f, [u, u + h * (0.8 + placeHash(f.e, 60 + i) * 0.6)], [k * f.half, k * (f.half + 0.01)], [y0, y0 + h], color);
  }
};

/** The pylon, the screen, the lights and the 2077 layer of one pavilion. */
export const bakePavilionDress = (sink: MeshSink, f: PavilionFrame, quality: RenderQuality): void => {
  bakePylon(sink, f);
  bakeScreen(sink, f);
  bakeLights(sink, f);
  bakeStreetLayer(sink, f, quality);
};
