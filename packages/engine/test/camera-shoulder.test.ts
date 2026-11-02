import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type Transform, type Vec3, directionFromAngles } from "@seki/core";
import { type Entity, aimOrigin } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { Matrix, Scene, Vector3 } from "../src/babylon";
import { CameraRig } from "../src/camera/camera-rig";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildHeroine, raiseWeapon } from "../src/renderer/characters";

const newScene = () => new Scene(new NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 }));

const settle = (rig: CameraRig, target: Transform, seconds = 2) => {
  for (let t = 0; t < seconds; t += 1 / 30) rig.update(target, 1 / 30);
};

const forwardOf = (rig: CameraRig): Vector3 =>
  Vector3.TransformNormal(new Vector3(0, 0, 1), Matrix.RotationYawPitchRoll(rig.camera.rotation.y, rig.camera.rotation.x, 0));

/** The player crouched or standing at the origin with the pistol aimed, as the TPP camera sees her. */
const aimedFigure = (crouch: number) => {
  const scene = newScene();
  const materials = new ToonMaterials(scene);
  const camera = new CameraRig(scene, materials, () => false);
  camera.setMode("TPP");
  const figure = buildHeroine(scene, materials, "player");
  raiseWeapon(figure);
  for (let i = 0; i < 60; i++) animateRig(figure, 0, 1 / 60, crouch, { aim: 1 });
  return { camera, figure };
};

/**
 * Turns the crouched, aimed player until the crosshair is on `target`: the camera stands on the
 * aim line, so the line from it to the target gives the next yaw and pitch.
 */
const aimAt = (camera: CameraRig, target: Vec3, crouch: number): Transform => {
  let t: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0, crouch, aim: 1, aimZoom: 0.8 };
  for (let k = 0; k < 12; k++) {
    settle(camera, t, 0.5);
    const c = camera.camera.position;
    const yaw = Math.atan2(target.x - c.x, target.z - c.z);
    const pitch = -Math.atan2(target.y - c.y, Math.hypot(target.x - c.x, target.z - c.z));
    t = { ...t, yaw, pitch };
  }
  settle(camera, t);
  return t;
};

/**
 * Angle (degrees) from the crosshair to the nearest part of the figure on screen: each skinned
 * triangle is projected onto the plane one metre ahead of the camera and measured from its centre.
 */
const clearance = (camera: CameraRig, figure: ReturnType<typeof buildHeroine>): number => {
  const o = camera.camera.position;
  const fwd = forwardOf(camera);
  const right = Vector3.Cross(Vector3.Up(), fwd).normalize();
  const up = Vector3.Cross(fwd, right);
  figure.root.computeWorldMatrix(true);
  let best = Infinity;
  for (const mesh of figure.meshes) {
    mesh.skeleton?.prepare(true);
    const world = mesh.computeWorldMatrix(true);
    const pos = mesh.getPositionData(true, false)!;
    const idx = mesh.getIndices()!;
    const onScreen = (i: number): [number, number] => {
      const p = Vector3.TransformCoordinates(new Vector3(pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!), world).subtract(o);
      const depth = Math.max(1e-3, Vector3.Dot(p, fwd));
      return [Vector3.Dot(p, right) / depth, Vector3.Dot(p, up) / depth];
    };
    for (let t = 0; t < idx.length; t += 3) best = Math.min(best, distanceToTriangle(onScreen(idx[t]!), onScreen(idx[t + 1]!), onScreen(idx[t + 2]!)));
  }
  return (Math.atan(best) * 180) / Math.PI;
};

/** Distance from the origin to a 2D triangle, 0 inside it. */
const distanceToTriangle = (a: [number, number], b: [number, number], c: [number, number]): number => {
  const side = (p: [number, number], q: [number, number]) => p[0] * q[1] - p[1] * q[0];
  const s1 = side([b[0] - a[0], b[1] - a[1]], [-a[0], -a[1]]);
  const s2 = side([c[0] - b[0], c[1] - b[1]], [-b[0], -b[1]]);
  const s3 = side([a[0] - c[0], a[1] - c[1]], [-c[0], -c[1]]);
  const area = side([b[0] - a[0], b[1] - a[1]], [c[0] - a[0], c[1] - a[1]]);
  // Collapsed triangles (the holstered pistol, scaled to nothing) are only their edges.
  if (Math.abs(area) > 1e-12 && ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0))) return 0;
  const toSegment = (p: [number, number], q: [number, number]) => {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const t = Math.min(1, Math.max(0, -(p[0] * dx + p[1] * dy) / Math.max(1e-12, dx * dx + dy * dy)));
    return Math.hypot(p[0] + dx * t, p[1] + dy * t);
  };
  return Math.min(toSegment(a, b), toSegment(b, c), toSegment(c, a));
};

describe("TPP camera aimed from close up (G-275)", () => {
  // A standing NPC's chest and a crouching one's, 1-3 m ahead of the crouched player.
  it.each([
    [1, 1.3],
    [1, 0.9],
    [2, 1.3],
    [2, 0.9],
    [3, 0.9],
  ])("crouched, aimed at a target %s m ahead at %s m: the figure stays out of 15 degrees round the crosshair, or fades", (distance, height) => {
    const { camera, figure } = aimedFigure(1);
    let fade = 0;
    camera.onBodyFade = (f) => (fade = f);
    figure.root.rotation.y = aimAt(camera, { x: 0, y: height, z: distance }, 1).yaw;
    // Before G-275 the gun hand and the head came within 10-15 degrees of it.
    if (fade < 0.5) expect(clearance(camera, figure)).toBeGreaterThan(15);
  });

  it("keeps the figure solid while it is out of the way", () => {
    const { camera } = aimedFigure(1);
    let fade = 0;
    camera.onBodyFade = (f) => (fade = f);
    settle(camera, { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0, crouch: 1, aim: 1 });
    expect(fade).toBe(0);
    settle(camera, { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 });
    expect(fade).toBe(0);
  });

  it("fades the figure to dots when a wall pulls the camera in close to it, and brings it back", () => {
    const { camera } = aimedFigure(0);
    const fades: number[] = [];
    camera.onBodyFade = (f) => fades.push(f);
    camera.setOccluder(() => 0.5);
    settle(camera, { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 });
    expect(Math.hypot(camera.camera.position.x, camera.camera.position.z)).toBeLessThan(1);
    expect(fades.at(-1)).toBeGreaterThan(0.5);
    expect(fades.at(-1)).toBeLessThan(1);
    // Eased in, not snapped.
    expect(fades[0]).toBeLessThan(fades.at(-1)!);
    camera.setOccluder(null);
    settle(camera, { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 });
    expect(fades.at(-1)).toBe(0);
  });

  it("never fades the figure in first person or in the reference view", () => {
    const { camera } = aimedFigure(0);
    let fade = 0;
    camera.onBodyFade = (f) => (fade = f);
    camera.setOccluder(() => 0.5);
    settle(camera, { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 });
    expect(fade).toBeGreaterThan(0.5);
    camera.setReferenceView({ x: 0, y: 2, z: -5 }, { x: 0, y: 1, z: 0 });
    camera.update(null, 1 / 30);
    expect(fade).toBe(0);
    camera.setReferenceView(null);
    camera.setMode("FPP");
    settle(camera, { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 });
    expect(fade).toBe(0);
  });
});

/** The player as the simulation shoots for her: only what `aimOrigin` reads. */
const shooter = (yaw: number, pitch: number, crouch: number, aim: number): Entity =>
  ({
    id: 1,
    position: { x: 3, y: 0.5, z: -2 },
    prevPosition: { x: 3, y: 0.5, z: -2 },
    yaw,
    prevYaw: yaw,
    pitch,
    posture: { crouched: crouch > 0, amount: crouch, prevAmount: crouch, sprinting: false, aiming: aim > 0, aim, prevAim: aim },
  }) as Entity;

describe("the crosshair is where the shot goes (G-275)", () => {
  it.each([
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [0.5, 0.4],
  ])("crouch %s, aim %s: the camera sits on the line of the simulation's shot", (crouch, aim) => {
    const scene = newScene();
    const camera = new CameraRig(scene, new ToonMaterials(scene), () => false);
    camera.setMode("TPP");
    for (const [yaw, pitch] of [
      [0.3, 0.2],
      [-2.4, -0.3],
    ] as const) {
      const at = { x: 3, y: 0.5, z: -2 };
      settle(camera, { position: at, yaw, pitch, speed: 0, crouch, aim });
      const origin = aimOrigin(shooter(yaw, pitch, crouch, aim), "TPP");
      const dir = directionFromAngles(yaw, pitch);
      const off = camera.camera.position.subtract(new Vector3(origin.x, origin.y, origin.z));
      // On the shot's line, behind its start: what the crosshair covers is what the shot hits.
      expect(Vector3.Cross(off, new Vector3(dir.x, dir.y, dir.z)).length()).toBeLessThan(1e-6);
      expect(Vector3.Dot(off, new Vector3(dir.x, dir.y, dir.z))).toBeLessThan(0);
      const fwd = forwardOf(camera);
      expect(Vector3.Dot(fwd, new Vector3(dir.x, dir.y, dir.z))).toBeCloseTo(1, 6);
    }
  });
});
