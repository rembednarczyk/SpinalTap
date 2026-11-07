import type { GrabPhase } from "@seki/core";
import { type Camera, MeshBuilder, type Scene, TransformNode } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";

/**
 * Seki's forearms on the target's neck in first person (ADR-0075 stage 2). The FPP viewmodel
 * is one cybernetic forearm with the weapon; in a takedown grab the weapon drops out of view
 * (G-459) and these two come up instead: the right forearm across the throat, the left hand
 * up on the back of the head. Placed in the camera's frame like the viewmodel (metres: +X right,
 * +Y up, +Z ahead), squeezing down with the choke and wrenching round with the kill. The target
 * itself is the character view in front of the camera.
 */

/** An elbow in the camera's frame and the way the forearm points from it. */
interface ArmAt {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
}

const FOREARM = 0.26;
const smoothstep = (t: number): number => t * t * (3 - 2 * t);
/** Seconds to bring the arms up, and down again after the grab. */
const RAISE = 0.25;
/** The kill's snap, seconds into it (as the TPP clip, `grab-pose`). */
const SNAP = 0.4;

const RIGHT: ArmAt = { x: 0.2, y: -0.2, z: 0.3, dx: -1, dy: 0.04, dz: 0.18 };
const LEFT: ArmAt = { x: -0.24, y: -0.34, z: 0.2, dx: 0.45, dy: 0.75, dz: 0.45 };

interface Forearm {
  readonly node: TransformNode;
}

const buildForearm = (scene: Scene, materials: ToonMaterials, parent: TransformNode, name: string): Forearm => {
  const node = new TransformNode(`vm-choke-${name}`, scene);
  node.parent = parent;
  const sleeve = MeshBuilder.CreateCylinder(`vm-choke-${name}-arm`, { height: FOREARM, diameterTop: 0.05, diameterBottom: 0.064, tessellation: 12 }, scene);
  sleeve.material = materials.get("cyberIvory");
  sleeve.parent = node;
  // The cylinder stands along Y; the forearm runs along the node's +Z from the elbow.
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.z = FOREARM / 2;
  const wrist = MeshBuilder.CreateTorus(`vm-choke-${name}-wrist`, { diameter: 0.052, thickness: 0.012, tessellation: 16 }, scene);
  wrist.material = materials.get("cyberCopper");
  wrist.parent = node;
  wrist.rotation.x = Math.PI / 2;
  wrist.position.z = FOREARM;
  const hand = MeshBuilder.CreateSphere(`vm-choke-${name}-hand`, { diameter: 0.064, segments: 10 }, scene);
  hand.material = materials.get("cyberIvory");
  hand.parent = node;
  hand.scaling.set(0.8, 1, 1.25);
  hand.position.z = FOREARM + 0.04;
  for (const m of [sleeve, wrist, hand]) {
    m.isPickable = false;
    applyOutline(m, 0.004);
  }
  return { node };
};

const place = (arm: Forearm, at: ArmAt, dy: number, dx: number): void => {
  arm.node.position.set(at.x + dx, at.y + dy, at.z);
  const len = Math.hypot(at.dx, at.dy, at.dz);
  arm.node.rotation.set(-Math.asin(at.dy / len), Math.atan2(at.dx, at.dz), 0);
};

export class ChokeArms {
  private readonly root: TransformNode;
  private readonly right: Forearm;
  private readonly left: Forearm;
  private raised = 0;
  private phase: GrabPhase | null = null;
  private time = 0;

  constructor(scene: Scene, materials: ToonMaterials, camera: Camera) {
    this.root = new TransformNode("vm-choke", scene);
    this.root.parent = camera;
    this.right = buildForearm(scene, materials, this.root, "r");
    this.left = buildForearm(scene, materials, this.root, "l");
    this.root.setEnabled(false);
  }

  /** Shown in first person while `grab` lasts; `fpp` false hides them at once (TPP, the reference view). */
  update(fpp: boolean, grab: GrabPhase | undefined, dt: number): void {
    const phase = grab ?? null;
    if (phase !== this.phase && phase !== null) this.time = 0;
    if (phase !== null) this.phase = phase;
    this.time += dt;
    this.raised = phase !== null ? Math.min(1, this.raised + dt / RAISE) : Math.max(0, this.raised - dt / RAISE);
    if (!phase && this.raised <= 0) this.phase = null;
    const shown = fpp && this.raised > 0.02;
    if (this.root.isEnabled(false) !== shown) this.root.setEnabled(shown);
    if (!shown) return;
    const up = smoothstep(this.raised);
    const t = this.time;
    // The choke squeezes down with the target going to its knees; the kill wrenches the head round.
    const sink = this.phase === "choke" ? smoothstep(Math.min(1, t / 1.2)) * 0.1 : 0;
    const wrench = this.phase === "kill" ? Math.sin(Math.PI * Math.min(1, Math.max(0, (t - SNAP + 0.05) / 0.27))) : 0;
    const struggle = this.phase === "hold" ? Math.sin(t * 9) * 0.008 : 0;
    const low = -(1 - up) * 0.3 - sink;
    place(this.right, RIGHT, low + struggle, -0.03 * wrench);
    place(this.left, LEFT, low - struggle, 0.1 * wrench);
  }
}
