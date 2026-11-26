import type { Mesh } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { MeshSink } from "../mesh-sink";
import { type WorldProp, bake } from "./prop-batch";
import { tree } from "./prop-green";
import { chainModel, farModel, nearModel } from "./prop-models";
import type { BakePart, SlicedBake } from "./sliced-bake";
import { FULL_LEAVES, type LeafDensity } from "./tree-plan";

/**
 * The near blocks' heaviest pieces in tiles with two levels of detail (discrete LOD by distance,
 * Luebke et al., "Level of Detail for 3D Graphics", 2002). A block's detailed mesh covers 256 m and
 * is drawn whole while the camera is within 170 m of it, so every leafy tree (6 to 9 thousand
 * triangles) and every bollard with its chain of links (some 460) was drawn at full detail up to
 * 400 m away: 8.5 million triangles a frame over the two geometry passes on Krakowskie (21.11), and
 * frames of 5 s under SwiftShader. A tile of `DETAIL_TILE` metres is drawn in full while the camera
 * is within `DETAIL_REACH` of its centre, else coarser: the trees with fewer, bigger leaves (the
 * crowns keep their outline and colour, leaf cards merged as in SpeedTree's LODs; species and style
 * stay), the bollards as on the phones (a coarser post, the chain two crossed strips).
 *
 * Both levels of every tile are baked into the block's one mesh, and the level is picked by the
 * index buffer (as terrain LODs switch index buffers over shared vertices): the block's triangles
 * are its own pieces' and, per tile, the full or the coarse range. So the block stays one draw
 * call (ADR-0050). The phones (quality `low`) keep their coarse bollards as they were; their trees
 * tile too, the phone tree in full and the far tree (a trunk and one crown, 30 triangles) coarse:
 * whole, each of the phone's 226 to 438 triangles stood up to the block's far edge, and the crown
 * rule's trees round W-3 (T-354) took its hall past the phone's budget.
 */
export const DETAIL_TILE = 64;
export const DETAIL_REACH = 110;
/** Further than the reach by this before a tile drawn in full goes coarse again (m). */
const HYSTERESIS = 10;

/** A quarter of the leaves, twice the size: some 30% of a leafy tree's triangles. */
export const MID_LEAVES: LeafDensity = { perCluster: Math.round(FULL_LEAVES.perCluster / 4), leaf: FULL_LEAVES.leaf * 2 };

/** A near block's piece baked in a detail tile. */
export const inDetailTile = (p: WorldProp, quality: RenderQuality): boolean => p.prop === "tree" || (quality !== "low" && p.prop === "bollard");

const mids = new Map<number, MeshSink>();
/** The tree of `shape` at the tiles' coarser detail (the game's original trees are cheap as they are). */
export const midTree = (shape: number): MeshSink => {
  let m = mids.get(shape);
  if (!m) mids.set(shape, (m = tree(shape, MID_LEAVES)));
  return m;
};

/** A piece into `sink` in full (`coarse` false) or at the tiles' coarser detail. */
const bakeTilePiece = (sink: MeshSink, p: WorldProp, quality: RenderQuality, coarse: boolean): void => {
  if (p.prop === "tree") return bake(sink, coarse ? (quality === "low" ? farModel("tree", p.shape)! : midTree(p.shape)) : nearModel(p.prop, p.shape, quality), p);
  const q = coarse ? "low" : quality;
  bake(sink, nearModel(p.prop, p.shape, q), p);
  for (const c of p.chains ?? []) bake(sink, chainModel(c.end, q), { ...p, yaw: c.yaw });
};

/** A tile of a block's mesh: its centre and its full and coarse ranges of the baked indices. */
export interface DetailTile {
  readonly x: number;
  readonly z: number;
  readonly full: readonly [number, number];
  readonly coarse: readonly [number, number];
}

/**
 * The tiles' parts, to bake after the block's own: per tile its pieces in full, then coarse, the
 * ranges read off `job` as they are baked. `tiles` holds them once the bake has run them; `own`
 * is where the block's own pieces end.
 */
export class TileLayout {
  readonly tiles: DetailTile[] = [];
  own = 0;
  readonly parts: BakePart[] = [];

  constructor(pieces: readonly WorldProp[], quality: RenderQuality, job: () => SlicedBake) {
    const groups = new Map<string, WorldProp[]>();
    for (const p of pieces) {
      if (!inDetailTile(p, quality)) continue;
      const key = `${Math.floor(p.x / DETAIL_TILE)}_${Math.floor(p.z / DETAIL_TILE)}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const at = () => job().indexCount;
    this.parts.push(() => (this.own = at()));
    for (const key of [...groups.keys()].sort()) {
      const list = groups.get(key)!;
      const [tx, tz] = key.split("_").map(Number) as [number, number];
      let start = 0;
      let mid = 0;
      this.parts.push(() => (start = at()));
      for (const p of list) this.parts.push((sink) => bakeTilePiece(sink, p, quality, false));
      this.parts.push(() => (mid = at()));
      for (const p of list) this.parts.push((sink) => bakeTilePiece(sink, p, quality, true));
      this.parts.push(() => {
        this.tiles.push({ x: (tx + 0.5) * DETAIL_TILE, z: (tz + 0.5) * DETAIL_TILE, full: [start, mid], coarse: [mid, at()] });
      });
    }
  }
}

/**
 * A block mesh's level per tile: its index buffer made of the block's own triangles and each tile's
 * full or coarse range, set again only when a tile changes its level.
 */
export class TileLod {
  private readonly full: boolean[];
  private set = false;

  constructor(
    private readonly mesh: Mesh,
    private readonly indices: Uint16Array | Uint32Array,
    private readonly layout: Pick<TileLayout, "tiles" | "own">,
  ) {
    this.full = layout.tiles.map(() => false);
  }

  /** The levels for the camera at `eye`; true when the index buffer changed. */
  show(eye: { readonly x: number; readonly z: number }): boolean {
    let changed = !this.set;
    this.layout.tiles.forEach((t, i) => {
      const d = Math.hypot(t.x - eye.x, t.z - eye.z);
      const full = d < DETAIL_REACH + (this.full[i] ? HYSTERESIS : 0);
      if (full !== this.full[i]) changed = true;
      this.full[i] = full;
    });
    if (!changed) return false;
    this.set = true;
    const ranges: (readonly [number, number])[] = [[0, this.layout.own], ...this.layout.tiles.map((t, i) => (this.full[i] ? t.full : t.coarse))];
    const count = ranges.reduce((n, [a, b]) => n + b - a, 0);
    const out = this.indices instanceof Uint16Array ? new Uint16Array(count) : new Uint32Array(count);
    let at = 0;
    for (const [a, b] of ranges) {
      out.set(this.indices.subarray(a, b), at);
      at += b - a;
    }
    this.mesh.setIndices(out, this.mesh.getTotalVertices());
    return true;
  }

  /** Tiles drawn in full now (debug and tests). */
  get fullTiles(): number {
    return this.full.filter(Boolean).length;
  }
}
