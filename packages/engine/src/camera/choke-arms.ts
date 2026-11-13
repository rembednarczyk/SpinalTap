import type { GrabPhase } from "@seki/core";
import { type AbstractMesh, type Camera, MeshBuilder, type Scene, TransformNode, Vector3 } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";
import type { ViewArmsFrame } from "./view-arms";

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
/** The eye in the grab: up out of a crouch, beside the target's head (metres to the left), down to a kneel at the end. */
const EYE_SIDE = 0.16;
const KNEEL_CROUCH = 0.7;

const RIGHT: ArmAt = { x: 0.34, y: -0.15, z: 0.36, dx: -1, dy: 0.05, dz: -0.22 };
const LEFT: ArmAt = { x: -0.14, y: -0.34, z: 0.2, dx: 0.5, dy: 0.62, dz: 0.5 };

interface Forearm {
  readonly node: TransformNode;
  readonly meshes: readonly AbstractMesh[];
  /** The way the forearm points from the elbow, as last placed. */
  readonly dir: Vector3;
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
  return { node, meshes: [sleeve, wrist, hand], dir: new Vector3(0, 0, 1) };
};

const place = (arm: Forearm, at: ArmAt, dy: number, dx: number): void => {
  arm.node.position.set(at.x + dx, at.y + dy, at.z);
  arm.dir.set(at.dx, at.dy, at.dz).normalize();
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

  /**
   * Where the eye is in the grab, from the simulation's `crouch`: she stands up behind the target
   * with her head beside its own (`side`, metres to her left) and goes down on a knee with it
   * through the choke and after the kill's snap, as her figure does in TPP.
   */
  eye(crouch: number): { crouch: number; side: number } {
    const w = smoothstep(this.raised);
    if (w <= 0) return { crouch, side: 0 };
    const t = this.time;
    const kneel = this.phase === "choke" ? smoothstep(Math.min(1, Math.max(0, (t - 0.2) / 1))) : this.phase === "kill" ? smoothstep(Math.min(1, Math.max(0, (t - SNAP - 0.12) / 0.6))) : 0;
    return { crouch: crouch + (KNEEL_CROUCH * kneel - crouch) * w, side: -EYE_SIDE * w };
  }

  /** Where the forearms are now in the camera's frame, while they are shown; Seki's model arms follow them. */
  forearms(): ViewArmsFrame["choke"] {
    if (!this.root.isEnabled(false)) return null;
    const of = (arm: Forearm) => ({ elbow: arm.node.position.clone(), dir: arm.dir.clone() });
    return { right: of(this.right), left: of(this.left) };
  }

  /** The procedural forearms give way to the model's (`ViewArms`). */
  showProps(shown: boolean): void {
    for (const m of [...this.right.meshes, ...this.left.meshes]) if (m.isEnabled(false) !== shown) m.setEnabled(shown);
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
