import { DECAL_KINDS, SITE_KINDS, type StreetPropItem, type StreetPropKind, TREE_SPECIES, type Vec3 } from "@seki/core";
import { type BollardChain, bollardChains } from "@seki/sim";
import type { MeshSink } from "../mesh-sink";
import type { PropLight } from "./prop-lamps";
import { type CellBand, scaleOf, shapeOf, showsNear, spreadOf, treeStyleAt } from "./prop-shapes";
import { vertex } from "./sink-ops";

/**
 * Batching of the street furniture (ADR-0047), without Babylon: pieces in world space with
 * their shape and size, instance matrices grouped per kind and shape from the cells the camera
 * is close to, far trees and lamps baked into one mesh per cell, and the quads of the halos.
 */

export interface WorldProp {
  readonly prop: StreetPropKind;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly shape: number;
  readonly scale: number;
  /** Width over `scale`, across and along the piece: a tree narrowed by walls (G-814); 1 when absent. */
  readonly spread?: number;
  /** A bollard's chains to the next post or lamp of its row (G-032). */
  readonly chains?: readonly BollardChain[];
  /** A road lamp drawn as a utility pole (ADR-0063, `utility-poles.ts`). */
  readonly pole?: boolean;
  /**
   * A door's variant: its model and size (ADR-0058 stage 9, `doorLayout`); a decal's layout (stage 6,
   * `decals.ts` in `@seki/core`); a still figure's pose, seat and look (stage 8, `figureLayout`); a
   * barrier's kind, length, height, rise and material (ADR-0077, `barrierLayout`).
   */
  readonly variant?: number;
}

export const toWorld = (items: readonly StreetPropItem[], at: Vec3): WorldProp[] =>
  items.map((i) => ({
    prop: i.prop,
    x: i.x + at.x,
    y: i.y + at.y,
    z: i.z + at.z,
    yaw: i.yaw,
    shape: i.prop === "tree" ? shapeOf(i.prop, i.variant) + TREE_SPECIES * treeStyleAt(i.x + at.x, i.z + at.z) : shapeOf(i.prop, i.variant),
    scale: scaleOf(i.prop, i.variant),
    ...(spreadOf(i.prop, i.variant) < 1 ? { spread: spreadOf(i.prop, i.variant) } : {}),
    chains: bollardChains(i),
    ...(i.prop === "door" || i.prop === "figure" || i.prop === "barrier" || DECAL_KINDS.has(i.prop) || SITE_KINDS.has(i.prop) ? { variant: i.variant } : {}),
  }));

/** One instanced mesh per kind and shape. */
export const groupKey = (kind: StreetPropKind, shape: number): string => `${kind}:${shape}`;

/**
 * Writes the instance matrix of a piece at `o` (Babylon's row-vector layout): turned by yaw
 * about Y (+z towards +x), scaled (across by its spread too), moved to its foot.
 */
export const writeMatrix = (out: Float32Array | number[], o: number, p: WorldProp): void => {
  const c = Math.cos(p.yaw) * p.scale * (p.spread ?? 1);
  const s = Math.sin(p.yaw) * p.scale * (p.spread ?? 1);
  const m = [c, 0, -s, 0, 0, p.scale, 0, 0, s, 0, c, 0, p.x, p.y, p.z, 1];
  for (let i = 0; i < 16; i++) out[o + i] = m[i]!;
};

/** A local point of a model at a piece's place. */
export const placePoint = (p: WorldProp, v: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const across = p.scale * (p.spread ?? 1);
  return { x: p.x + (v.x * c + v.z * s) * across, y: p.y + v.y * p.scale, z: p.z + (-v.x * s + v.z * c) * across };
};

export interface CellPieces {
  readonly band: CellBand;
  readonly pieces: readonly WorldProp[];
}

/** Instance matrices per group of everything the cells show in detail. */
export const collectInstances = (cells: Iterable<CellPieces>): Map<string, Float32Array> => {
  const lists = new Map<string, WorldProp[]>();
  for (const cell of cells) {
    for (const p of cell.pieces) {
      if (!showsNear(p.prop, cell.band)) continue;
      const k = groupKey(p.prop, p.shape);
      const l = lists.get(k);
      if (l) l.push(p);
      else lists.set(k, [p]);
    }
  }
  const out = new Map<string, Float32Array>();
  for (const [k, l] of lists) {
    const m = new Float32Array(l.length * 16);
    l.forEach((p, i) => writeMatrix(m, i * 16, p));
    out.set(k, m);
  }
  return out;
};

/** Pieces per kind among instance matrices (stats and tests). */
export const countByKind = (groups: ReadonlyMap<string, Float32Array>): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, m] of groups) {
    const kind = k.slice(0, k.lastIndexOf(":"));
    out[kind] = (out[kind] ?? 0) + m.length / 16;
  }
  return out;
};

/**
 * Appends a model's triangles at a piece's place (the far mesh of a cell, the near blocks), its UVs
 * zero. The same numbers as `placePoint` per vertex, in one tight loop: a near block bakes some
 * hundred thousand vertices in a frame.
 */
export const bake = (sink: MeshSink, model: MeshSink, p: WorldProp): void => {
  const base = sink.vertexCount;
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  const k = p.scale;
  // A narrowed piece is squeezed across by its spread; its normals lean out by the inverse.
  const w = p.spread ?? 1;
  const across = k * w;
  const { positions: mp, normals: mn, colors: mc } = model;
  const { positions, normals, colors, uvs, uvs2 } = sink;
  const n = model.vertexCount;
  for (let i = 0; i < n; i++) {
    const x = mp[i * 3]!;
    const z = mp[i * 3 + 2]!;
    positions.push(p.x + (x * c + z * s) * across, p.y + mp[i * 3 + 1]! * k, p.z + (-x * s + z * c) * across);
    const nx = mn[i * 3]! / w;
    const ny = mn[i * 3 + 1]!;
    const nz = mn[i * 3 + 2]! / w;
    const r = w === 1 ? 1 : 1 / Math.hypot(nx, ny, nz);
    normals.push((nx * c + nz * s) * r, ny * r, (-nx * s + nz * c) * r);
    colors.push(mc[i * 4]!, mc[i * 4 + 1]!, mc[i * 4 + 2]!, mc[i * 4 + 3]!);
    uvs.push(0, 0);
    uvs2.push(0, 0);
  }
  const indices = sink.indices;
  for (const i of model.indices) indices.push(base + i);
};

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Halo kinds read by the halo shader from uv2.y. */
export const HALO_KIND = { sprite: 0, pool: 1 } as const;

/**
 * The halos of a piece's lights: a camera-facing sprite at each light (the shader spreads the
 * corners from uv) and a soft pool on the ground under lamps that light the pavement.
 */
export const planHalos = (sink: MeshSink, p: WorldProp, lights: readonly PropLight[]): void => {
  for (const l of lights) {
    const at = placePoint(p, l.at);
    const [r, g, b] = hex(l.color);
    const corners: [number, number][] = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const up = { x: 0, y: 1, z: 0 };
    const quad = (center: { x: number; y: number; z: number }, size: number, kind: number) => {
      const ids = corners.map((uv) => vertex(sink, center, up, [r, g, b, 1], uv, [size, kind]));
      sink.indices.push(ids[0]!, ids[1]!, ids[2]!, ids[0]!, ids[2]!, ids[3]!);
    };
    quad(at, l.size * p.scale, HALO_KIND.sprite);
    if (l.pool) quad({ x: at.x, y: p.y + 0.24, z: at.z }, Math.min(2.5 + (at.y - p.y) * 0.6, 7.5), HALO_KIND.pool);
  }
};

/** The lights of a piece that pool on the street, as the wet street mirrors them (ADR-0084): where each hangs and its colour. */
export const poolLights = (p: WorldProp, lights: readonly PropLight[]): { x: number; y: number; z: number; color: [number, number, number] }[] =>
  lights.filter((l) => l.pool).map((l) => ({ ...placePoint(p, l.at), color: hex(l.color) }));
