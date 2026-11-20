import type { Vec3, W3StationId } from "@seki/core";
import { W3_LAYOUT, W3_PIPES, W3_PLATFORM, W3_ROOF, W3_Y } from "@seki/sim";
import { Color4, ParticleSystem, RawTexture, type Scene, Texture, Vector3 } from "../../babylon";
import type { PointLightDef } from "../../npr/lighting";
import type { ToonMaterials } from "../../npr/toon-material";
import { W3_NEON } from "./w3-dress";

/**
 * W-3's moving air and light (ADR-0082 stage 4): steam off the pipes, welding sparks at the
 * line's arms and the yard's floodlights, behind the `W3View` part of the `BabylonRenderer`
 * facade. The steam and the sparks are particles on High only (ADR-0082 §4), one system each, so
 * one draw call each while they show; on low there are none. The floodlights are two point lights
 * of the toon shader (no draw call), on outside only: in the hall its own lamps take the slots.
 */

/** Steam within this of the hall (m); the floodlights within this of the gate. */
export const W3_FX_RANGE = 260;

/** Where steam leaks outside: the pipeline's valves over the river, the cooling units on row N's roof. */
export const W3_STEAM_OUTSIDE: readonly Vec3[] = [
  { x: 2452, y: W3_Y + W3_PLATFORM + 0.95, z: (W3_PIPES.maxZ + 443.1) / 2 },
  { x: 2474, y: W3_Y + W3_PLATFORM + 0.95, z: (W3_PIPES.maxZ + 443.1) / 2 },
  ...[2532, 2556].map((x) => ({ x, y: W3_Y + W3_ROOF + W3_LAYOUT.COOLER.h, z: W3_LAYOUT.COOLER.z })),
];
/** And in the hall: the valves on the orange pipes under its ceiling (`w3-inside-geometry.ts`). */
export const W3_STEAM_INSIDE: readonly Vec3[] = [
  { x: 2522, y: W3_Y + 13.4, z: 407.4 },
  { x: 2541, y: W3_Y + 13.4, z: 428.6 },
];

/** The arms' welding points over the belts; none by a station blown for good (ADR-0082 stage 3c). */
export const w3SparkPoints = (wrecks: readonly W3StationId[] = []): Vec3[] =>
  W3_LAYOUT.ARMS_X.flatMap((x) =>
    [W3_LAYOUT.BELT_L1, W3_LAYOUT.BELT_L2].flatMap((belt, i) => {
      const dead = wrecks.some((s) => (s === "S1" || s === "S2" ? 0 : 1) === i && Math.abs(W3_LAYOUT.STATIONS[s].x - x) < 5.5);
      return dead ? [] : [{ x, y: W3_Y + W3_LAYOUT.BELT_H + 0.45, z: (belt.minZ + belt.maxZ) / 2 }];
    }),
  );

/** The floodlights' keys begin with this. */
export const W3_FLOOD_PREFIX = "w3-flood-";

/** The neon's red over the gate and the cold floodlight over the quay and the pier (picture 01). */
export const W3_FLOOD_LIGHTS: readonly { readonly key: string; readonly light: PointLightDef }[] = [
  // Clipped to the yard before the gate: not onto the tower's shaft north of it.
  {
    key: `${W3_FLOOD_PREFIX}neon`,
    light: { color: "#ff3a3a", range: 13, intensity: 0.9, position: { x: W3_NEON.face - 2.5, y: W3_Y + W3_NEON.foot, z: 418 }, clip: { minX: 2486, maxX: 2500.5, minZ: 404, maxZ: 432 } },
  },
  { key: `${W3_FLOOD_PREFIX}quay`, light: { color: "#cfe0ff", range: 18, intensity: 0.75, position: { x: 2483, y: W3_Y + 9, z: 432 } } },
];

/** What shows now: steam outside or in the hall, the sparks, the floodlights. */
export interface W3FxPlan {
  readonly steam: "outside" | "inside" | null;
  readonly sparks: boolean;
  readonly lights: boolean;
}

/** The plan for a frame: `particles` false on low quality; `near` the hall's inside is drawn; `interior` the eye in its rooms. */
export const w3FxPlan = (o: { readonly particles: boolean; readonly inRange: boolean; readonly near: boolean; readonly interior: boolean; readonly moving: boolean }): W3FxPlan => ({
  steam: o.particles && o.inRange ? (o.interior ? "inside" : "outside") : null,
  sparks: o.particles && o.near && o.moving,
  lights: o.inRange && !o.interior,
});

/** A round soft sprite, white, its alpha falling to the rim. */
const sprite = (scene: Scene, name: string, hard: number): Texture => {
  const n = 32;
  const px = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      const a = Math.max(0, 1 - r) ** hard;
      px.set([255, 255, 255, Math.round(a * 255)], (y * n + x) * 4);
    }
  }
  const tex = RawTexture.CreateRGBATexture(px, n, n, scene, false, false, Texture.BILINEAR_SAMPLINGMODE);
  tex.name = name;
  // The standard blend reads the sprite's alpha only from a texture that says it has one.
  tex.hasAlpha = true;
  return tex;
};

/** A system that starts each particle at one of `points()`, picked at random. */
const system = (scene: Scene, name: string, capacity: number, points: () => readonly Vec3[]): ParticleSystem => {
  const ps = new ParticleSystem(name, capacity, scene);
  ps.emitter = Vector3.Zero();
  ps.startPositionFunction = (_m, pos) => {
    const list = points();
    const p = list[Math.floor(Math.random() * list.length)] ?? { x: 0, y: -1e4, z: 0 };
    pos.set(p.x + (Math.random() - 0.5) * 0.3, p.y, p.z + (Math.random() - 0.5) * 0.3);
  };
  return ps;
};

const steamSystem = (scene: Scene, points: () => readonly Vec3[]): ParticleSystem => {
  const ps = system(scene, "w3-steam", 160, points);
  ps.particleTexture = sprite(scene, "w3-steam-tex", 1.6);
  ps.direction1 = new Vector3(-0.2, 1, -0.15);
  ps.direction2 = new Vector3(0.25, 1, 0.2);
  ps.minEmitPower = 0.6;
  ps.maxEmitPower = 1.2;
  ps.minLifeTime = 2.5;
  ps.maxLifeTime = 4.5;
  ps.addSizeGradient(0, 1.2, 1.6);
  ps.addSizeGradient(1, 3.5, 4.5);
  ps.emitRate = 26;
  ps.color1 = new Color4(0.74, 0.78, 0.84, 0.42);
  ps.color2 = new Color4(0.64, 0.68, 0.76, 0.34);
  ps.colorDead = new Color4(0.6, 0.64, 0.7, 0);
  ps.gravity = new Vector3(0.3, 0.1, 0);
  ps.minAngularSpeed = -0.4;
  ps.maxAngularSpeed = 0.4;
  ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  return ps;
};

const sparkSystem = (scene: Scene, points: () => readonly Vec3[]): ParticleSystem => {
  const ps = system(scene, "w3-sparks", 240, points);
  ps.particleTexture = sprite(scene, "w3-spark-tex", 0.6);
  ps.direction1 = new Vector3(-1, 0.6, -1);
  ps.direction2 = new Vector3(1, 1.6, 1);
  ps.minEmitPower = 1.5;
  ps.maxEmitPower = 3.5;
  ps.minLifeTime = 0.25;
  ps.maxLifeTime = 0.7;
  ps.minSize = 0.03;
  ps.maxSize = 0.08;
  ps.emitRate = 160;
  ps.color1 = new Color4(1, 0.92, 0.55, 1);
  ps.color2 = new Color4(1, 0.6, 0.18, 1);
  ps.colorDead = new Color4(1, 0.3, 0.05, 0);
  ps.gravity = new Vector3(0, -9.8, 0);
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  return ps;
};

/** Seconds a welding point burns before the line moves on to the next pair. */
const WELD = 1.1;

export class W3Fx {
  private steam: ParticleSystem | null = null;
  private sparks: ParticleSystem | null = null;
  private steamAt: readonly Vec3[] = W3_STEAM_OUTSIDE;
  private sparkPoints: readonly Vec3[] = w3SparkPoints();
  private welding: readonly Vec3[] = [];
  private wrecksSeen: readonly W3StationId[] = [];
  private lightsOn = false;
  /** The systems emitting now (a stopped one keeps `isStarted`). */
  private readonly running = new Set<ParticleSystem>();
  private time = 0;
  plan: W3FxPlan = { steam: null, sparks: false, lights: false };

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    /** False on low quality: no particles at all. */
    private readonly particles: boolean,
  ) {}

  /** The systems made so far (tests). */
  get systems(): readonly ParticleSystem[] {
    return [this.steam, this.sparks].filter((s): s is ParticleSystem => s !== null);
  }

  update(dt: number, o: { readonly inRange: boolean; readonly near: boolean; readonly interior: boolean; readonly moving: boolean; readonly wrecks: readonly W3StationId[] }): void {
    this.time += dt;
    const plan = w3FxPlan({ particles: this.particles, ...o });
    this.plan = plan;
    if (plan.steam) {
      this.steam ??= steamSystem(this.scene, () => this.steamAt);
      this.steamAt = plan.steam === "inside" ? W3_STEAM_INSIDE : W3_STEAM_OUTSIDE;
    }
    this.run(this.steam, plan.steam !== null);
    if (o.wrecks !== this.wrecksSeen) {
      this.wrecksSeen = o.wrecks;
      this.sparkPoints = w3SparkPoints(o.wrecks);
    }
    if (plan.sparks) {
      this.sparks ??= sparkSystem(this.scene, () => this.welding);
      // Two arms weld at a time, the pair moving down the line.
      const n = this.sparkPoints.length;
      const k = Math.floor(this.time / WELD);
      this.welding = n === 0 ? [] : [this.sparkPoints[k % n]!, this.sparkPoints[(k * 3 + 1) % n]!];
    }
    this.run(this.sparks, plan.sparks && this.welding.length > 0);
    this.setLights(plan.lights);
  }

  /** The systems emitting now (tests). */
  get emitting(): readonly string[] {
    return [...this.running].map((s) => s.name).sort();
  }

  private run(ps: ParticleSystem | null, on: boolean): void {
    if (!ps || on === this.running.has(ps)) return;
    if (on) {
      ps.start();
      this.running.add(ps);
    } else {
      ps.stop();
      this.running.delete(ps);
    }
  }

  private setLights(on: boolean): void {
    if (on === this.lightsOn) return;
    this.lightsOn = on;
    for (const l of W3_FLOOD_LIGHTS) {
      if (on) this.materials.addLight(l.key, l.light);
      else this.materials.removeLight(l.key);
    }
  }

  dispose(): void {
    for (const s of this.systems) s.dispose();
    this.running.clear();
    this.setLights(false);
  }
}
