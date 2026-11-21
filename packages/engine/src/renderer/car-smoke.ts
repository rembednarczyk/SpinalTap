import type { Transform } from "@seki/core";
import { Color3, type Mesh, MeshBuilder, type Scene, StandardMaterial } from "../babylon";

/*
 * Smoke from under a damaged car's bonnet (ADR-0097 §5): past half its damage a car smokes, pale
 * steam at first, dark and thick near a wreck. Each smoking car is a loop of `PER_CAR` puffs, each
 * puff a function of the time and its place in the loop (rising, growing, drifting back and fading),
 * so nothing is made per frame; every puff is a thin instance of one low-poly ball, unlit and
 * see-through, so all the smoke is one draw call while a car smokes and none otherwise (the
 * explosions' smoke works the same way, `ExplosionFx`).
 */

/** Puffs a smoking car keeps in the air, cars smoking at once (the nearest first) and a puff's life (s). */
export const PER_CAR = 8;
export const MAX_CARS = 4;
export const PUFF_LIFE = 1.8;
/** The damage from which a car smokes, thickest at a wreck. */
export const SMOKE_FROM = 0.5;
/** Where the bonnet is on a car's frame (front +z, up from the ground under it): its middle, over the engine. */
const BONNET = { y: 0.85, z: 1.35 } as const;

/** How thick a car's smoke is for its damage (0 none .. 1 a wreck's). */
export const smokeOf = (damage: number): number => Math.min(1, Math.max(0, (damage - SMOKE_FROM) / (1 - SMOKE_FROM)));

/**
 * The puffs of the smoking `cars` at `time` (s): their matrices (16 floats each, Babylon's row-vector
 * layout, uniform scale) and colours (4 floats, grey and alpha); returns how many.
 */
export const writePuffs = (cars: readonly Transform[], time: number, matrices: Float32Array, colors: Float32Array): number => {
  let n = 0;
  for (const car of cars) {
    const k = smokeOf(car.damage ?? 0);
    if (k <= 0) continue;
    const [s, c] = [Math.sin(car.yaw), Math.cos(car.yaw)];
    const bx = car.position.x + s * BONNET.z;
    const bz = car.position.z + c * BONNET.z;
    for (let i = 0; i < PER_CAR && (n + 1) * 16 <= matrices.length; i++, n++) {
      const t = (time / PUFF_LIFE + i / PER_CAR) % 1;
      // Up and growing, back over the roof as it rises, a little to either side by its place in the loop.
      const side = ((i * 0.618) % 1) - 0.5;
      const back = 0.9 * t;
      const x = bx - s * back + c * side * 0.4;
      const y = car.position.y + BONNET.y + 0.15 + (1.2 + 0.8 * k) * t;
      const z = bz - c * back - s * side * 0.4;
      const size = (0.45 + 0.75 * k) * (0.5 + 1.3 * t);
      const o = n * 16;
      matrices.fill(0, o, o + 16);
      matrices[o] = matrices[o + 5] = matrices[o + 10] = size;
      matrices[o + 12] = x;
      matrices[o + 13] = y;
      matrices[o + 14] = z;
      matrices[o + 15] = 1;
      // Pale steam at first, dark smoke near a wreck; fading out as it rises.
      const grey = 0.78 - 0.55 * k;
      colors.set([grey, grey, grey * 1.02, (0.55 + 0.4 * k) * Math.min(1, t * 6) * (1 - t) ** 0.7], n * 4);
    }
  }
  return n;
};

/** The smoke of the damaged cars near the camera. */
export class CarSmoke {
  private readonly mesh: Mesh;
  private readonly matrices = new Float32Array(16 * PER_CAR * MAX_CARS);
  private readonly colors = new Float32Array(4 * PER_CAR * MAX_CARS);
  private time = 0;

  constructor(scene: Scene) {
    const mesh = MeshBuilder.CreateIcoSphere("car-smoke", { radius: 0.5, subdivisions: 1, flat: true }, scene);
    const m = new StandardMaterial("car-smoke", scene);
    m.disableLighting = true;
    m.emissiveColor = Color3.White();
    m.transparencyMode = StandardMaterial.MATERIAL_ALPHABLEND;
    m.disableDepthWrite = true;
    mesh.material = m;
    mesh.thinInstanceSetBuffer("matrix", this.matrices, 16, false);
    mesh.thinInstanceSetBuffer("color", this.colors, 4, false);
    // Never none (as the explosions' smoke): a material readied with no instances loses their colour.
    mesh.thinInstanceCount = 1;
    mesh.isPickable = false;
    // The instances' alpha is their fading.
    mesh.hasVertexAlpha = true;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.setEnabled(false);
    this.mesh = mesh;
  }

  /** True while it draws (tests, stats). */
  get drawn(): boolean {
    return this.mesh.isEnabled();
  }

  /** One frame `dt` seconds on: the puffs of the smoking cars among `cars` (the nearest `MAX_CARS` of them). */
  update(dt: number, cars: readonly Transform[]): void {
    this.time += Math.max(0, dt);
    const count = writePuffs(cars.filter((t) => smokeOf(t.damage ?? 0) > 0).slice(0, MAX_CARS), this.time, this.matrices, this.colors);
    if (count === 0) {
      if (this.mesh.isEnabled()) this.mesh.setEnabled(false);
      return;
    }
    this.mesh.thinInstanceCount = count;
    this.mesh.thinInstanceBufferUpdated("matrix");
    this.mesh.thinInstanceBufferUpdated("color");
    if (!this.mesh.isEnabled()) this.mesh.setEnabled(true);
  }
}
