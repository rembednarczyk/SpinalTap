import type { Vec3 } from "@seki/core";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import type { CityProps } from "../city-props";
import { type DroneTemplate, boxDrone, propsDrone } from "./drone-models";
import { PATROL_SCALE } from "./patrol-flight";

/**
 * The low patrol's geometry (ADR-0058 stage 7b): the patrol drone of `drone-props.glb` (or its
 * boxes) at `PATROL_SCALE`, its red and blue light bar included, and its searchlight after it: a
 * pool of light on the paving on the kit's emissive swatch, so no light of the scene and no other
 * material. No rays down to it: opaque and inked by the outline pass, thin blades read as poles
 * under the drone, not as light. The pool is drawn a unit under the foot and a unit wide; the
 * views put it on the paving each frame, wider the higher the drone.
 * Pure data, no Babylon.
 */

export interface PatrolTemplate extends DroneTemplate {
  /** The first vertex of the searchlight's pool. */
  readonly beam: number;
}

/** The pool's swatch: the cold white of the lit windows. */
const BEAM_SWATCH = "win-white";
/** Segments of the pool. */
const POOL = 16;
const UP: Vec3 = { x: 0, y: 1, z: 0 };

/** A template scaled about its foot, with the searchlight's pool after it. */
const withBeam = (data: CityKitData, t: DroneTemplate): PatrolTemplate => {
  const sink = new GeometrySink();
  for (let i = 0; i < t.positions.length; i++) sink.positions.push((t.positions[i] as number) * PATROL_SCALE);
  sink.normals.push(...t.normals);
  sink.uvs.push(...t.uvs);
  sink.colors.push(...t.colors);
  sink.indices.push(...t.indices);
  const beam = sink.vertexCount;
  const uv = swatchUv(data, BEAM_SWATCH);
  const rim = (k: number): Vec3 => ({ x: Math.sin((k / POOL) * 2 * Math.PI), y: -1, z: Math.cos((k / POOL) * 2 * Math.PI) });
  // A fan of triangles (quads with two corners as one) facing up.
  for (let k = 0; k < POOL; k++) sink.quad({ x: 0, y: -1, z: 0 }, rim(k), rim(k + 1), rim(k + 1), UP, uv);
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

/** The low patrol near (the props' model when there is one) and far (its boxes), each with its searchlight's pool. */
export const patrolTemplates = (data: CityKitData, props: CityProps | null): { readonly near: PatrolTemplate; readonly far: PatrolTemplate } => {
  const far = boxDrone(data, "patrol");
  return { near: withBeam(data, (props && propsDrone(data, props, "patrol")) ?? far), far: withBeam(data, far) };
};
