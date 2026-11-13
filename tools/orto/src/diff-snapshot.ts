/**
 * The map of one git ref for `diff.ts` (`pnpm orto:diff`), without a build: the import's chunks
 * (`packages/sim/src/content/lublin/*.generated.ts`), the game's shaped terrain (`SHAPED_TERRAIN`)
 * and the bridges' decks with the flights hung off them (`GROUND_DECKS`), read through Vite's
 * module runner as `game.ts` reads the scan's checks. A ref other than `HEAD` is unpacked by
 * `git archive` (only `packages/core`, `packages/sim` and `tsconfig.base.json`, no `node_modules`:
 * the map's modules import nothing but `@seki/core`, aliased to the unpacked source).
 */
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runnerImport } from "vite";
import type * as Decks from "../../../packages/sim/src/content/lublin/decks.ts";
import type * as Sites from "../../../packages/sim/src/content/lublin/sites.ts";
import type * as Terrain from "../../../packages/sim/src/content/lublin/terrain.ts";
import { type Pt, type Rect } from "../../osm-import/src/geometry.ts";
import { flatRing } from "./overlay.ts";

export interface Grid2 {
  readonly originX: number;
  readonly originZ: number;
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly heights: readonly number[];
}

export interface SnapPiece {
  readonly surface: string;
  readonly ring: readonly Pt[];
}

export interface SnapChunk {
  readonly id: string;
  readonly bounds: Rect;
  /** Ground pieces in the import's order: a later one is drawn over an earlier one. */
  readonly ground: readonly SnapPiece[];
  readonly buildings: readonly (readonly Pt[])[];
  /** The import's terrain (the NMT on the chunk's grid) and the game's, pads, ramps and decks applied. */
  readonly nmt: Grid2;
  readonly shaped: Grid2;
}

export interface SnapDeck {
  readonly a: Pt;
  readonly b: Pt;
  readonly ya: number;
  readonly yb: number;
  readonly box: Rect;
  readonly flight: boolean;
  /** The deck's outline area (m²). */
  readonly area: number;
}

export interface MapSnapshot {
  readonly ref: string;
  readonly sha: string;
  readonly chunks: readonly SnapChunk[];
  readonly decks: readonly SnapDeck[];
}

const ringArea = (r: readonly Pt[]): number => {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += r[j]!.x * r[i]!.z - r[i]!.x * r[j]!.z;
  return Math.abs(s) / 2;
};

const git = (cwd: string, args: readonly string[]): string => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr.trim()}`);
  return r.stdout.trim();
};

/** The paths a ref's map needs. */
const PATHS = ["tsconfig.base.json", "packages/core", "packages/sim"] as const;

/**
 * The sources of `ref` to read the map from: the current checkout itself for `HEAD` (uncommitted
 * changes included), else `<work>/orto-diff-<tag>-<sha8>` from `git archive`. `remove` deletes it.
 */
export const unpackRef = (root: string, ref: string, work: string, tag: string): { readonly sha: string; readonly dir: string; readonly remove: () => void } => {
  const sha = git(root, ["rev-parse", "--verify", `${ref}^{commit}`]);
  if (ref === "HEAD") return { sha, dir: root, remove: () => undefined };
  mkdirSync(work, { recursive: true });
  const dir = join(work, `orto-diff-${tag}-${sha.slice(0, 8)}`);
  const remove = () => rmSync(dir, { recursive: true, force: true });
  remove();
  mkdirSync(dir);
  const tar = join(work, `orto-diff-${tag}-${sha.slice(0, 8)}.tar`);
  try {
    git(root, ["archive", "--format=tar", "-o", tar, sha, ...PATHS]);
    const r = spawnSync("tar", ["-xf", tar, "-C", dir], { encoding: "utf8" });
    if (r.status !== 0) throw new Error(`tar -xf ${tar}: ${r.stderr.trim()}`);
  } catch (e) {
    remove();
    throw e;
  } finally {
    rmSync(tar, { force: true });
  }
  return { sha, dir, remove };
};

const grid = (g: Grid2): Grid2 => ({ originX: g.originX, originZ: g.originZ, cell: g.cell, cols: g.cols, rows: g.rows, heights: [...g.heights] });

/** Reads the map of the sources in `dir` (see `unpackRef`). */
export const snapshotOf = async (dir: string, ref: string, sha: string): Promise<MapSnapshot> => {
  const lublin = join(dir, "packages/sim/src/content/lublin");
  if (!existsSync(join(lublin, "terrain.ts"))) throw new Error(`${ref}: no packages/sim/src/content/lublin/terrain.ts`);
  const opts = { root: dir, configFile: false as const, logLevel: "warn" as const, resolve: { alias: { "@seki/core": join(dir, "packages/core/src/index.ts") } } };
  const sites = (await runnerImport<typeof Sites>(join(lublin, "sites.ts"), opts)).module;
  const terrain = (await runnerImport<typeof Terrain>(join(lublin, "terrain.ts"), opts)).module;
  const decks = (await runnerImport<typeof Decks>(join(lublin, "decks.ts"), opts)).module;
  const chunks: SnapChunk[] = sites.MAP_CHUNKS.map((c) => ({
    id: c.id,
    bounds: { minX: c.bounds.minX, minZ: c.bounds.minZ, maxX: c.bounds.maxX, maxZ: c.bounds.maxZ },
    ground: c.ground.map((g) => ({ surface: g.surface, ring: flatRing(g.outline) })),
    buildings: c.buildings.map((b) => flatRing(b.outline, b.x, b.z)),
    nmt: grid(c.terrain),
    shaped: grid(terrain.SHAPED_TERRAIN.get(c.id) ?? c.terrain),
  }));
  // A flight hung off a bridge is in every chunk it reaches: once.
  const seen = new Set<string>();
  const out: SnapDeck[] = [];
  for (const list of decks.GROUND_DECKS.values())
    for (const d of list) {
      const deck = { a: { x: d.a.x, z: d.a.z }, b: { x: d.b.x, z: d.b.z }, ya: d.ya, yb: d.yb, box: { ...d.box }, flight: d.flight === true, area: ringArea(d.ring) };
      const key = JSON.stringify(deck);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(deck);
    }
  return { ref, sha, chunks, decks: out };
};
