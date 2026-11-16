import { SITE_SCAFFOLD, siteScaffoldLayout } from "@seki/core";
import { MeshSink, type Rgba } from "../../mesh-sink";
import type { RenderQuality } from "../../../npr/quality";
import { glow, paint, tube, v3 } from "../prop-kit";
import { HAZARD, STEEL, facing, slab } from "./site-slab";

/**
 * The scaffold along a neighbour's wall (ADR-0087 step 5, stage 2) in its own frame: local +x
 * along the wall, centred on the foot, from the wall's side at z 0 to `SITE_SCAFFOLD.depth` into
 * the site, following the ground's rise. Standards every bay, ledgers and a deck every lift, the
 * debris mesh over its face to the site and on it the developer's neon banner of the building of
 * 2077 (`BANNERS`, the design from the seed). The phones (`low`) go without the mesh: the banner
 * hangs on the tubes.
 */

const DECK = paint("#7a6a4f");
const NET = paint("#3d5a4f");
const NET_RIM = paint("#56756a");

/** A banner's design: the sky, the ground, the building's body, its lit windows, the neon of its edges and crown, its tiers (x0, x1, top of the field's width and height, 0..1). */
interface Banner {
  readonly sky: Rgba;
  readonly ground: Rgba;
  readonly body: Rgba;
  readonly windows: Rgba;
  readonly neon: Rgba;
  readonly tiers: readonly (readonly [number, number, number])[];
}

/**
 * The visualisations of 2077 the developers hang on the mesh: twin towers on a podium, a stepped
 * arcology, a needle on a plinth, terraces. A lit building with a grid of windows and neon edges
 * on a night sky, the developer's logo line along the top (bars, not a text of the catalogs).
 */
export const BANNERS: readonly Banner[] = [
  { sky: glow("#081430"), ground: glow("#10243a"), body: glow("#1f4f86"), windows: glow("#9ff6ff"), neon: glow("#38e8ff"), tiers: [[0.06, 0.94, 0.24], [0.16, 0.42, 0.84], [0.58, 0.84, 0.74]] },
  { sky: glow("#1c0824"), ground: glow("#2a1030"), body: glow("#6a2470"), windows: glow("#ffb0e6"), neon: glow("#ff45e6"), tiers: [[0.06, 0.94, 0.3], [0.16, 0.84, 0.5], [0.28, 0.72, 0.68], [0.4, 0.6, 0.86]] },
  { sky: glow("#06201a"), ground: glow("#0c2e22"), body: glow("#1f6a4c"), windows: glow("#d0ff9a"), neon: glow("#a6ff4a"), tiers: [[0.12, 0.88, 0.2], [0.38, 0.62, 0.72], [0.46, 0.54, 0.9]] },
  { sky: glow("#22140a"), ground: glow("#33200e"), body: glow("#7a4a16"), windows: glow("#ffe08a"), neon: glow("#ffb447"), tiers: [[0.06, 0.6, 0.6], [0.4, 0.94, 0.44], [0.2, 0.46, 0.82]] },
];

const FLAT = { rise: 0, length: 1 };

/** Is the window in column i, row j of a tier lit (about two in three)? */
const lit = (design: number, tier: number, i: number, j: number): boolean => ((Math.imul(i + 1, 73856093) ^ Math.imul(j + 1, 19349663) ^ Math.imul(design * 7 + tier + 1, 83492791)) >>> 0) % 100 < 64;

/** The banner `design` on the face at `z`, from x0 to x1 and y0 to y1; each layer a few millimetres before the last. */
const banner = (sink: MeshSink, design: number, z: number, x0: number, x1: number, y0: number, y1: number): void => {
  const b = BANNERS[design % BANNERS.length]!;
  const [w, h] = [x1 - x0, y1 - y0];
  const X = (u: number) => x0 + w * u;
  const Y = (v: number) => y0 + h * v;
  const at = (layer: number, u0: number, u1: number, v0: number, v1: number, c: Rgba) => facing(sink, FLAT, z + 0.004 * layer, X(u0), X(u1), Y(v0), Y(v1), c);
  at(0, 0, 1, 0.08, 1, b.sky);
  at(0, 0, 1, 0, 0.08, b.ground);
  // The developer's logo line: a mark and a word of bars.
  at(1, 0.06, 0.1, 0.9, 0.95, b.neon);
  for (let k = 0; k < 6; k++) at(1, 0.13 + k * 0.05, 0.16 + k * 0.05, 0.905, 0.945, b.windows);
  // The building: its tiers back to front, each a lit body, a grid of windows and neon edges and crown.
  b.tiers.forEach(([u0, u1, top], t) => {
    const layer = 2 + 3 * t;
    at(layer, u0, u1, 0.06, top, b.body);
    const [cols, rows] = [Math.max(2, Math.round((u1 - u0) / 0.045)), Math.max(1, Math.floor((top - 0.12) / 0.055))];
    const cw = (u1 - u0 - 0.03) / cols;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if (lit(design, t, i, j)) at(layer + 1, u0 + 0.015 + i * cw + cw * 0.22, u0 + 0.015 + (i + 1) * cw - cw * 0.22, 0.1 + j * 0.055, 0.1 + j * 0.055 + 0.028, b.windows);
    at(layer + 2, u0, u1, top - 0.012, top, b.neon);
    at(layer + 2, u0, u0 + 0.008, 0.06, top, b.neon);
    at(layer + 2, u1 - 0.008, u1, 0.06, top, b.neon);
  });
  // A mast with its light over the tallest tier.
  const [m0, m1, mt] = b.tiers.reduce((a, c) => (c[2] > a[2] ? c : a));
  const mid = (m0 + m1) / 2;
  at(2 + 3 * b.tiers.length, mid - 0.004, mid + 0.004, mt, Math.min(0.97, mt + 0.08), b.neon);
};

/** A scaffold of a variant (`siteScaffoldLayout`) for a quality. */
export const scaffoldModel = (variant: number, quality: RenderQuality): MeshSink => {
  const s = siteScaffoldLayout(variant);
  const sink = new MeshSink();
  const slope = { rise: s.rise, length: s.length };
  const hl = s.length / 2;
  const d = SITE_SCAFFOLD.depth;
  const y = (x: number, h: number) => (s.rise * x) / Math.max(s.length, 1e-6) + h;
  const bays = Math.max(1, Math.round(s.length / SITE_SCAFFOLD.bay));
  const lifts = Math.max(1, Math.floor(s.height / SITE_SCAFFOLD.lift));
  const tubeRow = (z: number, color: Rgba) => {
    for (let k = 0; k <= bays; k++) {
      const x = -hl + (s.length * k) / bays;
      tube(sink, v3(x, y(x, -0.3), z), v3(x, y(x, s.height), z), 0.03, color, 4);
    }
    for (let l = 1; l <= lifts; l++) tube(sink, v3(-hl, y(-hl, l * SITE_SCAFFOLD.lift), z), v3(hl, y(hl, l * SITE_SCAFFOLD.lift), z), 0.025, color, 4);
  };
  tubeRow(0.1, STEEL);
  tubeRow(d - 0.1, STEEL);
  // The decks, a toe board in hazard yellow on each.
  for (let l = 1; l <= lifts; l++) {
    const h = l * SITE_SCAFFOLD.lift;
    slab(sink, slope, -hl, hl, 0.1, d - 0.1, h - 0.05, h, DECK);
    slab(sink, slope, -hl, hl, d - 0.14, d - 0.1, h, h + 0.15, HAZARD);
  }
  const z = d + 0.02;
  if (quality !== "low") {
    facing(sink, slope, z, -hl, hl, 0.3, s.height, NET);
    for (let l = 1; l <= lifts; l++) facing(sink, slope, z + 0.003, -hl, hl, l * SITE_SCAFFOLD.lift - 0.06, l * SITE_SCAFFOLD.lift + 0.06, NET_RIM);
  }
  // The banner, level, in the middle of the face: as wide as the scaffold less a bay, at most 14 m.
  const bw = Math.min(s.length - 1, 14);
  const bh = Math.min(s.height * 0.6, bw * 0.62);
  const b0 = Math.max(1.2, s.height * 0.3) + Math.abs(s.rise) / 2;
  if (bw > 2 && b0 + bh <= s.height) banner(sink, s.banner, z + 0.01, -bw / 2, bw / 2, b0, b0 + bh);
  return sink;
};
