import type { Vec3 } from "@seki/core";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import type { CityProps } from "../city-props";
import { type DroneTemplate, boxDrone, propsDrone } from "./drone-models";
import { PATROL_SCALE } from "./patrol-flight";

/**
 * The low patrol's geometry (ADR-0058 stage 7b): the patrol drone of `drone-props.glb` (or its
 * boxes) at `PATROL_SCALE`, its red and blue light bar included, and its searchlight after it: thin
 * rays from its belly to a pool of light on the paving, all on the kit's emissive swatch, so no
 * light of the scene and no other material. The searchlight is drawn for a unit drop (its apex at
 * the foot, the pool a unit under it, a unit wide); the views stretch it to the paving each frame.
 * Pure data, no Babylon.
 */

export interface PatrolTemplate extends DroneTemplate {
  /** The first vertex of the searchlight. */
  readonly beam: number;
}

/** The searchlight's swatch: the cold white of the lit windows. */
const BEAM_SWATCH = "win-white";
/** Rays and segments of the pool, and a ray's width at the paving (a unit drop). */
const RAYS = 6;
const POOL = 16;
const RAY_WIDTH = 0.03;
const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** A template scaled about its foot, with the searchlight after it. */
const withBeam = (data: CityKitData, t: DroneTemplate): PatrolTemplate => {
  const sink = new GeometrySink();
  for (let i = 0; i < t.positions.length; i++) sink.positions.push((t.positions[i] as number) * PATROL_SCALE);
  sink.normals.push(...t.normals);
  sink.uvs.push(...t.uvs);
  sink.colors.push(...t.colors);
  sink.indices.push(...t.indices);
  const beam = sink.vertexCount;
  const uv = swatchUv(data, BEAM_SWATCH);
  const rim = (k: number, r = 1): Vec3 => ({ x: Math.sin((k / POOL) * 2 * Math.PI) * r, y: -1, z: Math.cos((k / POOL) * 2 * Math.PI) * r });
  // The pool: a fan of triangles (quads with two corners as one) facing up.
  for (let k = 0; k < POOL; k++) sink.quad({ x: 0, y: -1, z: 0 }, rim(k), rim(k + 1), rim(k + 1), UP, uv);
  // The rays: thin upright blades from the apex to the pool's rim, both faces.
  for (let k = 0; k < RAYS; k++) {
    const a = (k / RAYS) * 2 * Math.PI;
    const side = { x: Math.cos(a) * RAY_WIDTH, z: -Math.sin(a) * RAY_WIDTH };
    const foot = { x: Math.sin(a) * 0.92, z: Math.cos(a) * 0.92 };
    const top = (s: number): Vec3 => ({ x: side.x * s * 0.1, y: 0, z: side.z * s * 0.1 });
    const low = (s: number): Vec3 => ({ x: foot.x + side.x * s, y: -1, z: foot.z + side.z * s });
    const n = { x: Math.sin(a + Math.PI / 2), y: 0, z: Math.cos(a + Math.PI / 2) };
    sink.quad(top(-1), top(1), low(1), low(-1), n, uv);
    sink.quad(top(1), top(-1), low(-1), low(1), { x: -n.x, y: 0, z: -n.z }, uv);
  }
  return {
    positions: Float32Array.from(sink.positions),
    normals: Float32Array.from(sink.normals),
    uvs: Float32Array.from(sink.uvs),
    colors: Float32Array.from(sink.colors),
    indices: Uint32Array.from(sink.indices),
    vertexCount: sink.vertexCount,
    beam,
  };
};

/** The low patrol near (the props' model when there is one) and far (its boxes), each with its searchlight. */
export const patrolTemplates = (data: CityKitData, props: CityProps | null): { readonly near: PatrolTemplate; readonly far: PatrolTemplate } => {
  const far = boxDrone(data, "patrol");
  return { near: withBeam(data, (props && propsDrone(data, props, "patrol")) ?? far), far: withBeam(data, far) };
};
