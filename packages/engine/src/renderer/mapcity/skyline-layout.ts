/**
 * The megablocks hemming Lublin in (ADR-0067, variant B), as data: a near row of megatowers with
 * skybridges round the game's chunks, its stretch round the Nabrzeże, and a far ring of simpler
 * megablocks behind them, on top of `MEGA_SITES`. The table is generated once
 * (`skyline-layout-gen.ts`) and kept in the repo; the phone (`low`) draws none of it.
 */

/** [x, z, height, front heading in degrees (0 = +z, 90 = +x), extra ads up the front]. */
export type TowerRow = readonly [number, number, number, number, number];
/** [tower a, tower b (indices in the row), height, width]. */
export type BridgeRow = readonly [number, number, number, number];

export interface LayoutTables {
  readonly near: { readonly towers: readonly TowerRow[]; readonly bridges: readonly BridgeRow[] };
  readonly docks: { readonly towers: readonly TowerRow[]; readonly bridges: readonly BridgeRow[] };
  readonly ring: { readonly towers: readonly TowerRow[]; readonly bridges: readonly BridgeRow[] };
}

export interface TowerSpec {
  readonly x: number;
  readonly z: number;
  readonly h: number;
  /** Unit horizontal direction its front looks to. */
  readonly front: { readonly x: number; readonly z: number };
  /** Ads up its front beyond the one at its middle. */
  readonly ads: number;
}

/** A skybridge between towers `a` and `b` of its row, at height `y`. */
export interface BridgeSpec {
  readonly a: number;
  readonly b: number;
  readonly y: number;
  readonly width: number;
}

export type RowName = keyof LayoutTables;

export interface SkylineRow {
  readonly name: RowName;
  /** `body`: megatower bodies once loaded (ADR-0063); `tiers`: the procedural tiers always (the far LOD). */
  readonly lod: "body" | "tiers";
  readonly towers: readonly TowerSpec[];
  readonly bridges: readonly BridgeSpec[];
}

export interface SkylineLayout {
  readonly rows: readonly SkylineRow[];
}

const LOD: Record<RowName, SkylineRow["lod"]> = { near: "body", docks: "body", ring: "tiers" };

/** The tables as rows of tower and bridge specs. */
export const layoutOf = (t: LayoutTables): SkylineLayout => ({
  rows: (Object.keys(LOD) as RowName[]).map((name) => ({
    name,
    lod: LOD[name],
    towers: t[name].towers.map(([x, z, h, heading, ads]) => {
      const a = (heading * Math.PI) / 180;
      return { x, z, h, front: { x: Math.sin(a), z: Math.cos(a) }, ads };
    }),
    bridges: t[name].bridges.map(([a, b, y, width]) => ({ a, b, y, width })),
  })),
});

/** No megablocks: today's skyline (the phone). */
export const NO_LAYOUT: SkylineLayout = { rows: [] };
