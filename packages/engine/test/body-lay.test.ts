import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene, type TransformNode, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { LYING_REACH, MAX_SHIFT, type WallProbe, layOffset } from "../src/renderer/body-lay";
import { CharacterViews } from "../src/renderer/character-views";

/**
 * G-458: a body laid down facing a wall went into it head first (the prone pose is about 2 m
 * long, the simulation's body a small circle). The picture turns it on the ground, and moves it
 * off the wall by what is still missing, until no part of it is in the wall.
 */

/** A wall across the street at z = `wall`, facing −z (the side the player stands on). */
const wallAt =
  (wall: number): WallProbe =>
  (o, d, max) => {
    if (d.z <= 1e-9) return null;
    const t = (wall - o.z) / d.z;
    return t >= 0 && t <= max ? t : null;
  };

/** Two walls: across at z = `z` and along at x = `x` (a corner the player faces). */
const cornerAt =
  (x: number, z: number): WallProbe =>
  (o, d, max) => {
    const hits = [d.z > 1e-9 ? (z - o.z) / d.z : -1, d.x > 1e-9 ? (x - o.x) / d.x : -1].filter((t) => t >= 0 && t <= max);
    return hits.length ? Math.min(...hits) : null;
  };

const ORIGIN = { x: 0, y: 0, z: 0 };

describe("which way a body lies (G-458)", () => {
  it("lies as it fell in the open", () => {
    expect(layOffset(ORIGIN, 0.7, () => null)).toEqual({ turn: 0, x: 0, z: 0 });
  });

  it("with a wall ahead it lies across, its narrow left side to the wall", () => {
    expect(layOffset(ORIGIN, 0, wallAt(LYING_REACH.ahead + 0.05))).toEqual({ turn: 0, x: 0, z: 0 });
    expect(layOffset(ORIGIN, 0, wallAt(LYING_REACH.ahead - 0.1))).toEqual({ turn: Math.PI / 2, x: 0, z: 0 });
    expect(layOffset(ORIGIN, 0, wallAt(LYING_REACH.left + 0.05))).toEqual({ turn: Math.PI / 2, x: 0, z: 0 });
  });

  it("with a wall on its right (the thrown-out arm) it lies the other way round", () => {
    // Looking along −x the wall at z = 0.6 is on the body's right.
    expect(layOffset(ORIGIN, -Math.PI / 2, wallAt(0.6)).turn).toBeCloseTo(Math.PI, 6);
  });

  it("against a wall it is moved off it by what is missing, never further than MAX_SHIFT", () => {
    const tight = layOffset(ORIGIN, 0, wallAt(0.3));
    expect(tight.turn).toBeCloseTo(Math.PI / 2, 6);
    expect(tight.x).toBeCloseTo(0, 6);
    expect(tight.z).toBeCloseTo(0.3 - LYING_REACH.left, 6);
    expect(layOffset(ORIGIN, 0, wallAt(-0.5)).z).toBeGreaterThanOrEqual(-MAX_SHIFT);
  });

  it("is moved out of a tight corner, away from both walls", () => {
    const out = layOffset(ORIGIN, 0, cornerAt(0.7, 0.7));
    expect(out.x <= 0 && out.z <= 0).toBe(true);
    expect(Math.hypot(out.x, out.z)).toBeGreaterThan(0.1);
    expect(Math.hypot(out.x, out.z)).toBeLessThanOrEqual(MAX_SHIFT);
  });
});

describe("a body put down facing a wall (G-458)", () => {
  const HEROINE = 1;
  const GUARD = 2;
  /** The wall the player faces, 0.75 m ahead of her (her radius and a step). */
  const WALL = 0.75;
  const at = (x: number, z: number, more: Partial<Transform> = {}): Transform => ({ position: { x, y: 0, z }, yaw: 0, pitch: 0, speed: 0, ...more });
  const OUT = { unconscious: true } as const;

  const setup = (wall: WallProbe | undefined) => {
    const scene = new Scene(new NullEngine());
    const views = new CharacterViews({
      scene,
      materials: new ToonMaterials(scene),
      shadow: { addCaster: () => undefined } as unknown as MoonShadow,
      camera: { camera: { position: new Vector3(3, 1.6, 3) } } as unknown as CameraRig,
      cameraTarget: () => HEROINE,
      lift: () => 0,
      ...(wall ? { wall } : {}),
    });
    views.spawn(HEROINE, { kind: "heroine" }, at(0, 0));
    // On her shoulder, then put down in front of her, its circle against the wall (as the simulation's push-out leaves it).
    views.spawn(GUARD, { kind: "enemy", preset: "corpo" }, at(0, 0, OUT));
    run(views, 1);
    views.move(GUARD, at(0, WALL - 0.3, OUT));
    run(views, 2);
    return views;
  };

  const run = (views: CharacterViews, seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) views.update(1 / 60);
  };

  /** The furthest any joint of the body reaches towards the wall (its z). */
  const reach = (views: CharacterViews): number => {
    const rig = views.rigOf(GUARD)!;
    let most = -Infinity;
    for (const n of rig.root.getDescendants(false) as TransformNode[]) {
      const chain: TransformNode[] = [];
      for (let p: TransformNode | null = n; p; p = p.parent as TransformNode | null) chain.unshift(p);
      for (const p of chain) p.computeWorldMatrix(true);
      most = Math.max(most, Vector3.TransformCoordinates(Vector3.Zero(), n.getWorldMatrix()).z);
    }
    return most;
  };

  it("lies clear of the wall, on the ground", () => {
    const views = setup(wallAt(WALL));
    expect(reach(views)).toBeLessThan(WALL);
    expect(views.rigOf(GUARD)!.head.getAbsolutePosition().y).toBeLessThan(0.45);
  });

  it("went into the wall head first without the walls (the glitch the probe answers)", () => {
    expect(reach(setup(undefined))).toBeGreaterThan(WALL + 0.3);
  });

  it("turns back to the carrier when picked up again", () => {
    const views = setup(wallAt(WALL));
    expect(Math.abs(views.rigOf(GUARD)!.root.rotation.y)).toBeGreaterThan(1);
    views.move(GUARD, at(0, 0, OUT));
    run(views, 1);
    expect(views.rigOf(GUARD)!.root.rotation.y).toBeCloseTo(0, 6);
    expect(views.rigOf(GUARD)!.root.position.z).toBeCloseTo(0, 6);
  });
});
