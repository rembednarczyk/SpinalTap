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
const NET = paint("#24342f");
const NET_RIM = paint("#3b4f47");

/** A banner's design: the field, the building's body, its lit windows, the neon of its outline and crown, its tiers (x0, x1, top of the field's width and height, 0..1). */
interface Banner {
  readonly field: Rgba;
  readonly body: Rgba;
  readonly windows: Rgba;
  readonly neon: Rgba;
  readonly tiers: readonly (readonly [number, number, number])[];
}

/**
 * The visualisations of 2077 the developers hang on the mesh: twin towers on a podium, a stepped
 * arcology, a needle with a crown, a block of terraces. Drawn in neon on a dark field, the
 * project's line along the top (the banner's own, not a text of the catalogs).
 */
export const BANNERS: readonly Banner[] = [
  { field: glow("#0b1a3a"), body: paint("#16263f"), windows: glow("#7af2ff"), neon: glow("#38e8ff"), tiers: [[0.08, 0.92, 0.22], [0.18, 0.42, 0.86], [0.58, 0.82, 0.78]] },
  { field: glow("#2a0b2e"), body: paint("#2b1531"), windows: glow("#ff8ad8"), neon: glow("#ff45e6"), tiers: [[0.06, 0.94, 0.3], [0.16, 0.84, 0.5], [0.28, 0.72, 0.68], [0.4, 0.6, 0.86]] },
  { field: glow("#0a2a1f"), body: paint("#13302a"), windows: glow("#b8ff7a"), neon: glow("#a6ff4a"), tiers: [[0.1, 0.9, 0.2], [0.38, 0.62, 0.74], [0.46, 0.54, 0.92]] },
  { field: glow("#2e1a06"), body: paint("#33230f"), windows: glow("#ffd36b"), neon: glow("#ffb447"), tiers: [[0.06, 0.62, 0.62], [0.38, 0.94, 0.46], [0.2, 0.5, 0.8]] },
];

const FLAT = { rise: 0, length: 1 };

/** The banner `design` on the face at `z`, from x0 to x1 and y0 to y1. */
const banner = (sink: MeshSink, design: number, z: number, x0: number, x1: number, y0: number, y1: number): void => {
  const b = BANNERS[design % BANNERS.length]!;
  const [w, h] = [x1 - x0, y1 - y0];
  const X = (u: number) => x0 + w * u;
  const Y = (v: number) => y0 + h * v;
  facing(sink, FLAT, z, x0, x1, y0, y1, b.field);
  // The neon frame and the project's line along the top.
  for (const [a, c, d, e] of [
    [0, 1, 0, 0.025],
    [0, 1, 0.975, 1],
    [0, 0.012, 0, 1],
    [0.988, 1, 0, 1],
  ] as const)
    facing(sink, FLAT, z + 0.006, X(a), X(c), Y(d), Y(e), b.neon);
  facing(sink, FLAT, z + 0.006, X(0.08), X(0.56), Y(0.9), Y(0.94), b.windows);
  // The building: its tiers, each with rows of lit windows and a neon crown.
  for (const [u0, u1, top] of b.tiers) {
    facing(sink, FLAT, z + 0.004, X(u0), X(u1), Y(0.06), Y(top), b.body);
    for (let v = 0.12; v < top - 0.05; v += 0.08) facing(sink, FLAT, z + 0.008, X(u0 + 0.02), X(u1 - 0.02), Y(v), Y(v + 0.025), b.windows);
    facing(sink, FLAT, z + 0.01, X(u0), X(u1), Y(top - 0.012), Y(top), b.neon);
  }
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
