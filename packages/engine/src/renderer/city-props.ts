import type { Vec3 } from "@seki/core";
import { DRESS_FLAG, type MeshSink, hexColor } from "./mesh-sink";
import { type CityKitData, type GeometrySink, type KitModel, hexRgb, parseCityKit, swatchUv } from "./city-kit-data";

/**
 * Facade props from CC0 packs (ADR-0058): `city-props.glb`, baked by tools/city_kit.py on the
 * city kit's palette. A prop is never a mesh of its own: it is baked into a mesh that is already
 * drawn (a kit cell, ADR-0022, or a map city cell, ADR-0051), so it costs vertices, not draw
 * calls. Pure data and geometry, no Babylon.
 */

export interface CityProps {
  readonly models: ReadonlyMap<string, KitModel>;
  readonly swatches: CityKitData["swatches"];
  readonly grid: number;
  /** Models by the kinds they are placed as (`ac-wall`, `antenna`...), in file order. */
  readonly byStyle: ReadonlyMap<string, readonly KitModel[]>;
}

/** The phone's version of a kind: Kenney's few-dozen-triangle units. */
export const LITE = "lite";

/** Parses city-props.glb (the city kit's layout: one mesh per model, size and styles in its extras). */
export const parseCityProps = (bytes: ArrayBuffer): CityProps => {
  const data = parseCityKit(bytes);
  const byStyle = new Map<string, KitModel[]>();
  for (const m of data.models.values()) {
    for (const s of m.styles) {
      const list = byStyle.get(s) ?? [];
      list.push(m);
      byStyle.set(s, list);
    }
  }
  return { models: data.models, swatches: data.swatches, grid: data.grid, byStyle };
};

/**
 * Two props files as one (`city-props.glb` and the street furniture of `street-props.glb`, ADR-0063):
 * both are baked on the same palette, so the models keep their UVs. A file on another palette, or
 * with a model of the same key, is refused.
 */
export const mergeCityProps = (a: CityProps, b: CityProps): CityProps => {
  const names = (p: CityProps) => p.swatches.map((s) => `${s.name}:${s.color}:${s.kind}`).join(",");
  if (a.grid !== b.grid || names(a) !== names(b)) throw new Error("city props: the files are on different palettes");
  const models = new Map(a.models);
  for (const [k, m] of b.models) {
    if (models.has(k)) throw new Error(`city props: ${k} is in both files`);
    models.set(k, m);
  }
  const byStyle = new Map<string, KitModel[]>();
  for (const m of models.values()) for (const s of m.styles) byStyle.set(s, [...(byStyle.get(s) ?? []), m]);
  return { models, swatches: a.swatches, grid: a.grid, byStyle };
};

/** A well-mixed hash of a seed and a salt (the same position always picks the same model). */
export const propHash = (seed: number, salt = 0): number => {
  let h = Math.imul((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/** Seed of a world point (decimetres), for props placed where procedural decor stood. */
export const pointSeed = (p: Vec3): number => (Math.imul(Math.round(p.x * 10), 73856093) ^ Math.imul(Math.round(p.y * 10), 83492791) ^ Math.imul(Math.round(p.z * 10), 19349663)) >>> 0;

/**
 * A model of a kind, chosen by the seed. `lite` (phones) takes the kind's cheap version when
 * there is one; otherwise the cheap versions are left out.
 */
export const pickProp = (props: CityProps, style: string, seed: number, lite = false): KitModel | null => {
  const all = props.byStyle.get(style) ?? [];
  const cheap = all.filter((m) => m.styles.includes(LITE));
  const full = all.filter((m) => !m.styles.includes(LITE));
  const pool = lite && cheap.length > 0 ? cheap : full.length > 0 ? full : cheap;
  return pool.length > 0 ? (pool[propHash(seed) % pool.length] ?? null) : null;
};

/**
 * An air conditioner for a wall that may hold dozens: only `detailed` (0..1) of them are the
 * Quaternius units (about 900 triangles), the rest Kenney's (under a hundred). The share keeps
 * the cells' triangles in check (ADR-0058); phones get the cheap ones only.
 */
export const pickUnit = (props: CityProps, style: string, seed: number, lite: boolean, detailed: number): KitModel | null =>
  pickProp(props, style, seed, lite || (propHash(seed, 3) % 1000) / 1000 >= detailed);

/**
 * Where a model goes: the world point of its origin (the middle of its foot) and the world
 * vectors its x, y and z axes map to, scale included. Built by `facing`, so it is always a
 * proper rotation (no mirror: the winding of the faces stays).
 */
export interface PropXform {
  readonly origin: Vec3;
  readonly axes: readonly [Vec3, Vec3, Vec3];
}

const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const scaled = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const UP: Vec3 = { x: 0, y: 1, z: 0 };

/**
 * A model standing at `origin` with its front (-Z of the parsed model) towards `front` (a
 * horizontal unit vector), scaled per axis. `upright` stands its x axis up instead (a pipe run
 * turned to climb a wall).
 */
export const facing = (origin: Vec3, front: Vec3, scale: Vec3, upright = false): PropXform => {
  const az = { x: -front.x, y: 0, z: -front.z };
  if (upright) {
    const ay = cross(az, UP);
    return { origin, axes: [scaled(UP, scale.x), scaled(ay, scale.y), scaled(az, scale.z)] };
  }
  return { origin, axes: [scaled(cross(UP, az), scale.x), scaled(UP, scale.y), scaled(az, scale.z)] };
};

/**
 * A model hung on a wall: `at` is the point of the wall under the middle of its back, `out` the
 * wall's outward normal. Its back (+Z of the parsed model) touches the wall.
 */
export const onWall = (m: KitModel, at: Vec3, out: Vec3, scale: Vec3): PropXform => {
  const back = (m.size.z / 2) * scale.z;
  return facing({ x: at.x + out.x * back, y: at.y, z: at.z + out.z * back }, out, scale);
};

/** The model's vertices and normals in the world. */
export const transformProp = (m: KitModel, xf: PropXform): { positions: Float32Array; normals: Float32Array } => {
  const [ax, ay, az] = xf.axes;
  const positions = new Float32Array(m.positions.length);
  const normals = new Float32Array(m.normals.length);
  const inv = (v: Vec3) => 1 / (v.x * v.x + v.y * v.y + v.z * v.z || 1);
  const kx = inv(ax);
  const ky = inv(ay);
  const kz = inv(az);
  for (let i = 0; i < m.positions.length; i += 3) {
    const x = m.positions[i] ?? 0;
    const y = m.positions[i + 1] ?? 0;
    const z = m.positions[i + 2] ?? 0;
    positions[i] = xf.origin.x + ax.x * x + ay.x * y + az.x * z;
    positions[i + 1] = xf.origin.y + ax.y * x + ay.y * y + az.y * z;
    positions[i + 2] = xf.origin.z + ax.z * x + ay.z * y + az.z * z;
    // Normals of a scaled shape: each axis divided by its squared length, then renormalized.
    const nx = (m.normals[i] ?? 0) * kx;
    const ny = (m.normals[i + 1] ?? 0) * ky;
    const nz = (m.normals[i + 2] ?? 0) * kz;
    const wx = ax.x * nx + ay.x * ny + az.x * nz;
    const wy = ax.y * nx + ay.y * ny + az.y * nz;
    const wz = ax.z * nx + ay.z * ny + az.z * nz;
    const len = Math.hypot(wx, wy, wz) || 1;
    normals[i] = wx / len;
    normals[i + 1] = wy / len;
    normals[i + 2] = wz / len;
  }
  return { positions, normals };
};

/** Index of the palette swatch a model's UV points at. */
export const swatchAt = (props: CityProps, u: number, v: number): number => Math.min(props.grid - 1, Math.floor(u * props.grid)) + props.grid * Math.min(props.grid - 1, Math.floor(v * props.grid));

/**
 * The city kit's texture coordinates of each swatch of the props' palette, matched by name (the
 * two files share the palette, but nothing depends on its order).
 */
export const kitUvs = (props: CityProps, kit: CityKitData): readonly (readonly [number, number])[] => props.swatches.map((s) => swatchUv(kit, s.name));

/** Bakes a prop into a kit cell: kit texture, white tint. */
export const addPropToKit = (sink: GeometrySink, props: CityProps, uvs: readonly (readonly [number, number])[], m: KitModel, xf: PropXform): void => {
  const base = sink.vertexCount;
  const { positions, normals } = transformProp(m, xf);
  for (let i = 0; i < positions.length; i++) {
    sink.positions.push(positions[i] ?? 0);
    sink.normals.push(normals[i] ?? 0);
  }
  for (let i = 0; i < m.uvs.length; i += 2) {
    const uv = uvs[swatchAt(props, m.uvs[i] ?? 0, m.uvs[i + 1] ?? 0)] ?? [0, 0];
    sink.uvs.push(uv[0], uv[1]);
    sink.colors.push(1, 1, 1, 1);
  }
  for (const i of m.indices) sink.indices.push(base + i);
};

/** Bakes a prop into a map city mesh: the swatch's colour per vertex, glowing swatches self-lit. */
export const addPropToSink = (sink: MeshSink, props: CityProps, m: KitModel, xf: PropXform): void => {
  const base = sink.vertexCount;
  const { positions, normals } = transformProp(m, xf);
  const colors = props.swatches.map((s) => (s.kind === "glow" ? hexColor(s.color, DRESS_FLAG.lit) : [...hexRgb(s.color), DRESS_FLAG.solid]));
  for (let i = 0; i < positions.length; i++) {
    sink.positions.push(positions[i] ?? 0);
    sink.normals.push(normals[i] ?? 0);
  }
  for (let i = 0; i < m.uvs.length; i += 2) {
    const c = colors[swatchAt(props, m.uvs[i] ?? 0, m.uvs[i + 1] ?? 0)] ?? [0.5, 0.5, 0.5, 1];
    sink.colors.push(c[0] ?? 0, c[1] ?? 0, c[2] ?? 0, c[3] ?? 1);
    sink.uvs.push(0, 0);
    sink.uvs2.push(0, 0);
  }
  for (const i of m.indices) sink.indices.push(base + i);
};

/** Triangles of a model. */
export const triangleCount = (m: KitModel): number => m.indices.length / 3;
