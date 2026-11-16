import { Color3, type Mesh, MeshClass, type Scene, StandardMaterial, VertexData } from "../babylon";
import { FLASH_POOL, type FlashSize, MuzzleState, type Point, SMOKE_POOL } from "./muzzle-state";

/** The flame's two flat colours: the outer tongue and the pale core over it (NPR, no gradient). */
const FLAME_OUTER = Color3.FromHexString("#ff7a1f");
const FLAME_CORE = Color3.FromHexString("#fff1b0");
/** Reduced flashes: the flame's colours this much darker. */
const REDUCED_GLOW = 0.55;
/** Smoke grey by day and at night (unlit, so the night's is darker, not glowing in the dark). */
const SMOKE_DAY: readonly [number, number, number] = [0.86, 0.86, 0.88];
const SMOKE_NIGHT: readonly [number, number, number] = [0.58, 0.59, 0.66];
/** A puff's edge this much darker than its middle: drawn smoke, readable on a lit street and on a dark one. */
const PUFF_RIM = 0.45;

/**
 * One side of a flame tongue in its plane: `u` along the barrel (0 at the muzzle, 1 at the tip),
 * `v` across (to 0.5, the flame's half width), jagged like a drawn muzzle flash.
 */
const TONGUE: readonly (readonly [number, number])[] = [
  [0, 0.05],
  [0.12, 0.3],
  [0.24, 0.17],
  [0.42, 0.5],
  [0.55, 0.22],
  [0.78, 0.3],
  [1, 0],
];

/** The flame's geometry at unit size: positions, triangles and flat vertex colours. */
interface Shape {
  readonly positions: number[];
  readonly indices: number[];
  readonly colors: number[];
}

/** A fan of triangles from `centre` round a closed outline, in one colour. */
const fan = (shape: Shape, centre: readonly [number, number, number], ring: readonly (readonly [number, number, number])[], color: Color3): void => {
  const base = shape.positions.length / 3;
  for (const p of [centre, ...ring]) {
    shape.positions.push(p[0], p[1], p[2]);
    shape.colors.push(color.r, color.g, color.b, 1);
  }
  for (let i = 0; i < ring.length; i++) shape.indices.push(base, base + 1 + i, base + 1 + ((i + 1) % ring.length));
};

/**
 * The flame at unit size along +Z: three tongues crossing on the barrel's axis (seen from the
 * side) and a star round the muzzle (seen from the front or behind), each an orange shape with a
 * paler core laid a hair in front of it on both faces, so every view sees two flat bands.
 */
export const flameShape = (): Shape => {
  const shape: Shape = { positions: [], indices: [], colors: [] };
  const outline = (k: { u: number; v: number }) => [...TONGUE.map(([u, v]) => [u * k.u, v * k.v] as const), ...[...TONGUE].reverse().map(([u, v]) => [u * k.u, -v * k.v] as const)];
  const outer = outline({ u: 1, v: 1 });
  const core = outline({ u: 0.62, v: 0.5 });
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    // In the plane through the axis at angle a; the plane's normal is (-s, c, 0).
    const at = (u: number, v: number, off: number) => [v * c - off * s, v * s + off * c, u] as const;
    fan(shape, at(0.34, 0, 0), outer.map(([u, v]) => at(u, v, 0)), FLAME_OUTER);
    for (const off of [-0.02, 0.02]) fan(shape, at(0.22, 0, off), core.map(([u, v]) => at(u, v, off)), FLAME_CORE);
  }
  const star = (outerR: number, innerR: number, z: number) =>
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / 5 + 0.3;
      return [Math.cos(a) * r, Math.sin(a) * r, z] as const;
    });
  fan(shape, [0, 0, 0.06], star(0.5, 0.2, 0.06), FLAME_OUTER);
  for (const z of [0.045, 0.075]) fan(shape, [0, 0, z], star(0.27, 0.11, z), FLAME_CORE);
  return shape;
};

/**
 * A puff at unit size facing -Z: a flat middle out to `inner` of its radius, darkening to the rim
 * (vertex colours, multiplied by each puff's grey and opacity).
 */
export const puffShape = (sides = 9, inner = 0.36): Shape => {
  const shape: Shape = { positions: [0, 0, 0], indices: [], colors: [1, 1, 1, 1] };
  for (const [r, c] of [
    [inner, 1],
    [0.5, PUFF_RIM],
  ] as const) {
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      shape.positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      shape.colors.push(c, c, c, 1);
    }
  }
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    shape.indices.push(0, 1 + i, 1 + j);
    shape.indices.push(1 + i, 1 + sides + i, 1 + sides + j, 1 + i, 1 + sides + j, 1 + j);
  }
  return shape;
};

/** The geometry of a shape on a new mesh. */
const meshOf = (name: string, shape: Shape, scene: Scene): Mesh => {
  const mesh = new MeshClass(name, scene);
  const data = new VertexData();
  data.positions = shape.positions;
  data.indices = shape.indices;
  data.colors = shape.colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(shape.positions, shape.indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  return mesh;
};

/** The camera's axes in the world, for the smoke's billboards. */
export interface ViewAxes {
  readonly right: Point;
  readonly up: Point;
  readonly forward: Point;
}

/**
 * Muzzle flashes and smoke in the world (`MuzzleState`): every flame is a thin instance of one
 * mesh and every puff one of another, so a burst of any length costs at most two draw calls, and
 * none once the smoke is gone. Flames are opaque flat colours (the line art inks their edge on
 * High); puffs are flat grey discs, see-through, facing the camera.
 */
export class MuzzleFx {
  readonly state = new MuzzleState();
  readonly flame: Mesh;
  readonly smoke: Mesh;
  private readonly flameMaterial: StandardMaterial;
  private readonly flameMatrices = new Float32Array(16 * FLASH_POOL);
  private readonly puffMatrices = new Float32Array(16 * SMOKE_POOL);
  private readonly puffColors = new Float32Array(4 * SMOKE_POOL);
  private tint: [number, number, number] = [...SMOKE_NIGHT];

  constructor(scene: Scene) {
    this.flame = meshOf("fx-muzzle-flame", flameShape(), scene);
    this.flameMaterial = new StandardMaterial("fx-muzzle-flame", scene);
    this.flameMaterial.disableLighting = true;
    this.flameMaterial.emissiveColor = Color3.White();
    this.flameMaterial.backFaceCulling = false;
    this.flame.material = this.flameMaterial;
    this.smoke = meshOf("fx-muzzle-smoke", puffShape(), scene);
    const smokeMaterial = new StandardMaterial("fx-muzzle-smoke", scene);
    smokeMaterial.disableLighting = true;
    smokeMaterial.emissiveColor = Color3.White();
    smokeMaterial.backFaceCulling = false;
    smokeMaterial.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    smokeMaterial.disableDepthWrite = true;
    this.smoke.material = smokeMaterial;
    this.flame.thinInstanceSetBuffer("matrix", this.flameMatrices, 16, false);
    this.smoke.thinInstanceSetBuffer("matrix", this.puffMatrices, 16, false);
    this.smoke.thinInstanceSetBuffer("color", this.puffColors, 4, false);
    for (const m of [this.flame, this.smoke]) {
      // Never none: a material readied with no instances keeps its defines without the
      // instances' colour (the puffs drew opaque white), so one zero-sized instance stays.
      m.thinInstanceCount = 1;
      m.isPickable = false;
      // The instances are all over the city; the mesh itself sits at the origin.
      m.alwaysSelectAsActiveMesh = true;
      m.setEnabled(false);
      // Compiled now, not on the first shot: a flame lives three frames, a shader may take more. As
      // thin instances: else the puffs' vertex colours meet the instance colour undeclared (no INSTANCES).
      m.material?.forceCompilation(m, undefined, { useInstances: true });
    }
  }

  fire(shooter: number, at: Point, dir: Point, size: FlashSize): void {
    this.state.fire(shooter, at, dir, size);
  }

  /** Reduced flashes (ADR-0028): a smaller, darker flame. */
  setReduced(on: boolean): void {
    this.state.reduced = on;
    this.flameMaterial.emissiveColor = on ? new Color3(REDUCED_GLOW, REDUCED_GLOW, REDUCED_GLOW) : Color3.White();
  }

  /** The smoke's grey for the time of day (0 night .. 1 day). */
  setDaylight(daylight: number): void {
    const d = Math.max(0, Math.min(1, daylight));
    for (let i = 0; i < 3; i++) this.tint[i] = (SMOKE_NIGHT[i] as number) + ((SMOKE_DAY[i] as number) - (SMOKE_NIGHT[i] as number)) * d;
  }

  /** One frame (`MuzzleState.update`), then the instances: flames where the muzzles are, puffs facing `view`. */
  update(dt: number, place: (shooter: number, at: Point, dir: Point) => void, view: ViewAxes): void {
    this.state.update(dt, place);
    const flames = this.state.writeFlashes(this.flameMatrices);
    const puffs = this.state.writePuffs(this.puffMatrices, this.puffColors, view, this.tint);
    this.show(this.flame, flames, ["matrix"]);
    this.show(this.smoke, puffs, ["matrix", "color"]);
  }

  private show(mesh: Mesh, count: number, buffers: readonly string[]): void {
    // Disabled rather than no instances (see the constructor).
    if (count === 0) {
      if (mesh.isEnabled()) mesh.setEnabled(false);
      return;
    }
    mesh.thinInstanceCount = count;
    for (const b of buffers) mesh.thinInstanceBufferUpdated(b);
    if (!mesh.isEnabled()) mesh.setEnabled(true);
  }
}
