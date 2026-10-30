import type { StreetPropItem, StreetPropKind, Vec3 } from "@seki/core";
import { type BollardChain, bollardChains } from "@seki/sim";
import type { MeshSink } from "../mesh-sink";
import type { PropLight } from "./prop-lamps";
import { type CellBand, scaleOf, shapeOf, showsNear } from "./prop-shapes";
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
  /** A bollard's chains to the next post or lamp of its row (G-032). */
  readonly chains?: readonly BollardChain[];
}

export const toWorld = (items: readonly StreetPropItem[], at: Vec3): WorldProp[] =>
  items.map((i) => ({ prop: i.prop, x: i.x + at.x, y: i.y + at.y, z: i.z + at.z, yaw: i.yaw, shape: shapeOf(i.prop, i.variant), scale: scaleOf(i.prop, i.variant), chains: bollardChains(i) }));

/** One instanced mesh per kind and shape. */
export const groupKey = (kind: StreetPropKind, shape: number): string => `${kind}:${shape}`;

/**
 * Writes the instance matrix of a piece at `o` (Babylon's row-vector layout): turned by yaw
 * about Y (+z towards +x), scaled, moved to its foot.
 */
export const writeMatrix = (out: Float32Array | number[], o: number, p: WorldProp): void => {
  const c = Math.cos(p.yaw) * p.scale;
  const s = Math.sin(p.yaw) * p.scale;
  const m = [c, 0, -s, 0, 0, p.scale, 0, 0, s, 0, c, 0, p.x, p.y, p.z, 1];
  for (let i = 0; i < 16; i++) out[o + i] = m[i]!;
};

/** A local point of a model at a piece's place. */
export const placePoint = (p: WorldProp, v: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return { x: p.x + (v.x * c + v.z * s) * p.scale, y: p.y + v.y * p.scale, z: p.z + (-v.x * s + v.z * c) * p.scale };
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

/** Appends a model's triangles at a piece's place (the far mesh of a cell). */
export const bake = (sink: MeshSink, model: MeshSink, p: WorldProp): void => {
  const base = sink.vertexCount;
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  for (let i = 0; i < model.vertexCount; i++) {
    const at = placePoint(p, { x: model.positions[i * 3]!, y: model.positions[i * 3 + 1]!, z: model.positions[i * 3 + 2]! });
    const nx = model.normals[i * 3]!;
    const nz = model.normals[i * 3 + 2]!;
    const n = { x: nx * c + nz * s, y: model.normals[i * 3 + 1]!, z: -nx * s + nz * c };
    vertex(sink, at, n, [model.colors[i * 4]!, model.colors[i * 4 + 1]!, model.colors[i * 4 + 2]!, model.colors[i * 4 + 3]!]);
  }
  for (const i of model.indices) sink.indices.push(base + i);
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
