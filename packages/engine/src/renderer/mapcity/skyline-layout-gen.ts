import { prng } from "../city-kit-data";
import type { BridgeRow, LayoutTables, TowerRow } from "./skyline-layout";

/**
 * Generator of the megablock layout around Lublin (ADR-0067, variant B), run once: its output is
 * the table in `skyline-layout-data.ts`, which the game reads (no dice at start). The test
 * `skyline-layout.test.ts` checks that the table is what this gives, and rewrites it with
 * `SKYLINE_LAYOUT=update`.
 *
 * - near: a row of towers 300–520 m tall about 270 m out of the game's main block of chunks
 *   (Krakowskie, Stare Miasto, Podzamcze), with skybridges between neighbours and ads up the front;
 * - docks: the same round the Nabrzeże on its north, east and south (the west looks at the city);
 * - ring: two rows of megablocks 360 and 600 m out, 150–350 m, simpler bodies (the far LOD).
 */

interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** The game's main block of chunks and the Nabrzeże (bounds of `LUBLIN_CHUNKS`). */
export const MAIN_BLOCK: Box = { minX: -200, maxX: 1120, minZ: -270, maxZ: 580 };
export const DOCKS_BLOCK: Box = { minX: 2300, maxX: 2700, minZ: 60, maxZ: 480 };

/** Metres between a tower's foot and any chunk, beyond the reach of its body. */
const CLEAR = 200;
/** How far a megatower body reaches out from its foot, per metre of its height (`mc-tower-d`, the widest, 0.196). */
const BODY_REACH = 0.2;
/** The same for the far ring's tiers (0.18 h wide at most, its half diagonal). */
const TIERS_REACH = 0.13;

const toBox = (b: Box, x: number, z: number): number => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ));
const toData = (x: number, z: number): number => Math.min(toBox(MAIN_BLOCK, x, z), toBox(DOCKS_BLOCK, x, z));

/** Unit direction from (x, z) to the nearest point of a box: where a tower out there looks. */
const towards = (b: Box, x: number, z: number): { x: number; z: number } => {
  const nx = Math.min(Math.max(x, b.minX), b.maxX) - x;
  const nz = Math.min(Math.max(z, b.minZ), b.maxZ) - z;
  const l = Math.hypot(nx, nz) || 1;
  return { x: nx / l, z: nz / l };
};

/** The point `s` metres along a rectangle rounded `offset` metres out of a box (from its south-west corner, east first). */
const roundedAt = (b: Box, offset: number, s: number): { x: number; z: number } => {
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const q = (Math.PI / 2) * offset;
  const arc = (cx: number, cz: number, a: number) => ({ x: cx + Math.cos(a) * offset, z: cz + Math.sin(a) * offset });
  const legs: [number, (t: number) => { x: number; z: number }][] = [
    [w, (t) => ({ x: b.minX + t, z: b.minZ - offset })],
    [q, (t) => arc(b.maxX, b.minZ, -Math.PI / 2 + t / offset)],
    [d, (t) => ({ x: b.maxX + offset, z: b.minZ + t })],
    [q, (t) => arc(b.maxX, b.maxZ, t / offset)],
    [w, (t) => ({ x: b.maxX - t, z: b.maxZ + offset })],
    [q, (t) => arc(b.minX, b.maxZ, Math.PI / 2 + t / offset)],
    [d, (t) => ({ x: b.minX - offset, z: b.maxZ - t })],
    [q, (t) => arc(b.minX, b.minZ, Math.PI + t / offset)],
  ];
  let left = s;
  for (const [len, at] of legs) {
    if (left <= len) return at(left);
    left -= len;
  }
  return legs[0]![1](0);
};

interface RowPlan {
  readonly box: Box;
  readonly offset: number;
  readonly spacing: number;
  readonly jitter: number;
  readonly seed: number;
  readonly lo: number;
  readonly hi: number;
  readonly ads: number;
  readonly reach: number;
  /** Keeps a point of the round (the docks drop the side facing the city). */
  readonly keep?: (x: number, z: number) => boolean;
}

const r1 = (v: number): number => Math.round(v * 10) / 10;

/**
 * Towers round a box `offset` metres out every `spacing` metres, jittered, each pushed out until
 * its body clears every chunk by `CLEAR`; the front looks at the box.
 */
const towersOf = (p: RowPlan): TowerRow[] => {
  const rand = prng(p.seed);
  const heights = prng(p.seed ^ 0x77);
  const w = p.box.maxX - p.box.minX;
  const d = p.box.maxZ - p.box.minZ;
  const perimeter = 2 * (w + d) + 2 * Math.PI * p.offset;
  const n = Math.round(perimeter / p.spacing);
  const out: TowerRow[] = [];
  for (let i = 0; i < n; i++) {
    let { x, z } = roundedAt(p.box, p.offset, ((i + rand() * 0.4) / n) * perimeter);
    const t = towards(p.box, x, z);
    const radial = (rand() - 0.3) * p.jitter;
    const lateral = (rand() - 0.5) * p.jitter * 0.5;
    x += -t.x * radial + t.z * lateral;
    z += -t.z * radial - t.x * lateral;
    const h = Math.round(p.lo + heights() * (p.hi - p.lo));
    if (p.keep && !p.keep(x, z)) continue;
    // Out along the line to the box until the body clears the data.
    for (let k = 0; k < 40 && toData(x, z) - p.reach * h < CLEAR; k++) {
      x -= t.x * 10;
      z -= t.z * 10;
    }
    const f = towards(p.box, x, z);
    out.push([r1(x), r1(z), h, r1((Math.atan2(f.x, f.z) * 180) / Math.PI), p.ads]);
  }
  return out;
};

/** Skybridges between neighbours of a row (they come round in order), at three heights at most. */
const bridgesOf = (towers: readonly TowerRow[], seed: number, closed: boolean): BridgeRow[] => {
  const rand = prng(seed);
  const out: BridgeRow[] = [];
  const count = closed ? towers.length : towers.length - 1;
  for (let a = 0; a < count; a++) {
    const b = (a + 1) % towers.length;
    const [ax, az, ah] = towers[a]!;
    const [bx, bz, bh] = towers[b]!;
    if (Math.hypot(ax - bx, az - bz) > 260) continue;
    const top = Math.min(ah, bh);
    for (const f of [0.28, 0.52, 0.74]) {
      if (rand() < 0.75) out.push([a, b, r1(top * (f + (rand() - 0.5) * 0.06)), r1(8 + rand() * 8)]);
    }
  }
  return out;
};

const NEAR: RowPlan = { box: MAIN_BLOCK, offset: 270, spacing: 120, jitter: 120, seed: 303, lo: 300, hi: 520, ads: 3, reach: BODY_REACH };
/** North, east and south of the Nabrzeże: what lies west of its chunks faces the city. */
const DOCKS: RowPlan = {
  box: DOCKS_BLOCK,
  offset: 270,
  spacing: 150,
  jitter: 100,
  seed: 505,
  lo: 280,
  hi: 460,
  ads: 2,
  reach: BODY_REACH,
  keep: (x) => x > DOCKS_BLOCK.minX - 120,
};
const RING: readonly RowPlan[] = [
  { box: MAIN_BLOCK, offset: 360, spacing: 165, jitter: 120, seed: 101, lo: 150, hi: 250, ads: 0, reach: TIERS_REACH },
  { box: MAIN_BLOCK, offset: 600, spacing: 180, jitter: 120, seed: 202, lo: 230, hi: 350, ads: 0, reach: TIERS_REACH },
];

/** The whole layout, the same on every run. */
export const generateLayout = (): LayoutTables => {
  const near = towersOf(NEAR);
  // The docks row starts at its south-west corner: it is open there, so no bridge closes it.
  const docks = towersOf(DOCKS);
  return {
    near: { towers: near, bridges: bridgesOf(near, 404, true) },
    docks: { towers: docks, bridges: bridgesOf(docks, 606, false) },
    ring: { towers: RING.flatMap(towersOf), bridges: [] },
  };
};

/** The data file's source for a layout (what `SKYLINE_LAYOUT=update` writes). */
export const layoutSource = (t: LayoutTables): string => {
  const rows = (xs: readonly (readonly number[])[]): string => xs.map((r) => `      [${r.join(", ")}],\n`).join("");
  const row = (name: keyof LayoutTables): string =>
    `  ${name}: {\n    towers: [\n${rows(t[name].towers)}    ],\n    bridges: [\n${rows(t[name].bridges)}    ],\n  },\n`;
  return [
    'import type { LayoutTables } from "./skyline-layout";\n\n',
    "/**\n",
    " * The megablocks round Lublin (ADR-0067), generated by `skyline-layout-gen.ts`; do not edit by hand\n",
    " * (`SKYLINE_LAYOUT=update npx vitest run packages/engine/test/skyline-layout.test.ts`).\n",
    " * Towers: [x, z, height, front heading in degrees (0 = +z, 90 = +x), extra ads]; bridges: [tower a, tower b, height, width].\n",
    " */\n",
    "export const LAYOUT_TABLES: LayoutTables = {\n",
    row("near"),
    row("docks"),
    row("ring"),
    "};\n",
  ].join("");
};
