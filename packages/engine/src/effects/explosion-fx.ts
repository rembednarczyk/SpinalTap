import { Color3, type GlowLayer, type Mesh, type Scene, StandardMaterial } from "../babylon";
import { type BlastView, ExplosionState, MAX_BLASTS, PER_BLAST, SIMPLE_BLAST } from "./explosion-state";
import type { Point } from "./muzzle-state";
import { type Shape, fan, meshOf, puffShape } from "./muzzle-fx";

/** The fireball's flat colours: the orange rim and the pale core over it (NPR, no gradient). */
const FIRE_RIM = Color3.FromHexString("#ff7a1f");
const FIRE_CORE = Color3.FromHexString("#fff1b0");
/** Blast smoke, darker than a muzzle's: by day and at night (unlit, so the night's is not glowing). */
const SMOKE_DAY: readonly [number, number, number] = [0.42, 0.41, 0.4];
const SMOKE_NIGHT: readonly [number, number, number] = [0.3, 0.3, 0.34];

/** A star of `points` tips from `outer` to `inner` of the unit, at depth `z` (towards the camera below 0). */
const star = (points: number, outer: number, inner: number, z: number, turn: number): [number, number, number][] =>
  Array.from({ length: points * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points + turn;
    return [Math.cos(a) * r, Math.sin(a) * r, z];
  });

/** A fireball puff at unit size facing -Z: a jagged orange star with a pale core laid in front of it. */
export const fireShape = (): Shape => {
  const shape: Shape = { positions: [], indices: [], colors: [] };
  fan(shape, [0, 0, 0], star(7, 0.5, 0.34, 0, 0.2), FIRE_RIM);
  fan(shape, [0, 0, -0.02], star(5, 0.3, 0.2, -0.02, 0.5), FIRE_CORE);
  return shape;
};

/** A unit cube, the debris' chunk (scaled flat by its instance). */
export const chunkShape = (): Shape => {
  const positions: number[] = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) positions.push(x, y, z);
  // Corners: index = 4x + 2y + z over the bits; two triangles a face.
  const faces = [
    [0, 1, 3, 2],
    [4, 6, 7, 5],
    [0, 4, 5, 1],
    [2, 3, 7, 6],
    [0, 2, 6, 4],
    [1, 5, 7, 3],
  ];
  const indices = faces.flatMap(([a, b, c, d]) => [a, b, c, a, c, d] as number[]);
  return { positions, indices, colors: Array.from({ length: 8 * 4 }, () => 1) };
};

const unlit = (name: string, scene: Scene, blend: boolean): StandardMaterial => {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.emissiveColor = Color3.White();
  m.backFaceCulling = false;
  if (blend) {
    m.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    m.disableDepthWrite = true;
  }
  return m;
};

interface Layer {
  readonly mesh: Mesh;
  readonly matrices: Float32Array;
  readonly colors: Float32Array;
}

/**
 * Blasts in the world (`ExplosionState`, ADR-0082 stage 3c): every fireball puff is a thin instance
 * of one mesh, every smoke puff of another and every chunk of debris of a third, so a blast costs at
 * most three draw calls while it shows and none once it is over: the meshes are off at rest. The
 * fireball and the debris are opaque flat colours (the line art inks their edges on High), the smoke
 * flat grey discs, see-through, darker at the rim. Without particles (low and medium quality) there
 * is no debris mesh at all.
 */
export class ExplosionFx {
  readonly state: ExplosionState;
  private readonly fire: Layer;
  private readonly smoke: Layer;
  private readonly debris: Layer | null;
  private tint: [number, number, number] = [...SMOKE_NIGHT];

  constructor(scene: Scene, particles: boolean, glow?: GlowLayer) {
    this.state = new ExplosionState(particles);
    const per = particles ? PER_BLAST : SIMPLE_BLAST;
    this.fire = this.layer(scene, "fx-blast-fire", fireShape(), unlit("fx-blast-fire", scene, false), per.fire);
    this.smoke = this.layer(scene, "fx-blast-smoke", puffShape(11, 0.4), unlit("fx-blast-smoke", scene, true), per.smoke);
    this.debris = per.debris > 0 ? this.layer(scene, "fx-blast-debris", chunkShape(), unlit("fx-blast-debris", scene, false), per.debris) : null;
    glow?.addIncludedOnlyMesh(this.fire.mesh);
  }

  private layer(scene: Scene, name: string, shape: Shape, material: StandardMaterial, per: number): Layer {
    const mesh = meshOf(name, shape, scene);
    mesh.material = material;
    const matrices = new Float32Array(16 * MAX_BLASTS * per);
    const colors = new Float32Array(4 * MAX_BLASTS * per);
    mesh.thinInstanceSetBuffer("matrix", matrices, 16, false);
    mesh.thinInstanceSetBuffer("color", colors, 4, false);
    // Never none (as `MuzzleFx`): a material readied with no instances loses the instances' colour.
    mesh.thinInstanceCount = 1;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    // Compiled now, not on the blast's first frame, as thin instances.
    material.forceCompilation(mesh, undefined, { useInstances: true });
    return { mesh, matrices, colors };
  }

  /** The meshes it draws with (tests: none enabled at rest). */
  get meshes(): readonly Mesh[] {
    return [this.fire.mesh, this.smoke.mesh, ...(this.debris ? [this.debris.mesh] : [])];
  }

  /** A blast at `at`; `lit` when it may light the place (the flash budget and reduced flashes allowed it). */
  add(at: Point, radius: number, lit: boolean): void {
    this.state.add(at, radius, lit);
  }

  /** Reduced flashes (ADR-0028): a darker fireball, no light. */
  setReduced(on: boolean): void {
    this.state.reduced = on;
  }

  /** The smoke's grey for the time of day (0 night .. 1 day). */
  setDaylight(daylight: number): void {
    const d = Math.max(0, Math.min(1, daylight));
    for (let i = 0; i < 3; i++) this.tint[i] = (SMOKE_NIGHT[i] as number) + ((SMOKE_DAY[i] as number) - (SMOKE_NIGHT[i] as number)) * d;
  }

  /** One frame: the blasts age, then the instances, the billboards facing `view`. */
  update(dt: number, view: BlastView): void {
    this.state.update(dt);
    const { state: s } = this;
    this.show(this.fire, s.live ? s.writeFire(this.fire.matrices, this.fire.colors, view) : 0);
    this.show(this.smoke, s.live ? s.writeSmoke(this.smoke.matrices, this.smoke.colors, view, this.tint) : 0);
    if (this.debris) this.show(this.debris, s.live ? s.writeDebris(this.debris.matrices, this.debris.colors) : 0);
  }

  /** A new game or a load: no blast goes on. */
  clear(): void {
    this.state.clear();
    for (const l of [this.fire, this.smoke, this.debris]) if (l) this.show(l, 0);
  }

  private show(layer: Layer, count: number): void {
    const { mesh } = layer;
    // Disabled rather than no instances (see `layer`).
    if (count === 0) {
      if (mesh.isEnabled()) mesh.setEnabled(false);
      return;
    }
    mesh.thinInstanceCount = count;
    mesh.thinInstanceBufferUpdated("matrix");
    mesh.thinInstanceBufferUpdated("color");
    if (!mesh.isEnabled()) mesh.setEnabled(true);
  }
}
