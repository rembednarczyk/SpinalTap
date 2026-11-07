import type { GrabPhase, Transform } from "@seki/core";
import { type Matrix, type TransformNode, Vector3 } from "../babylon";
import type { LayOffset } from "./body-lay";
import type { CharacterRig } from "./character-rig";
import { smooth } from "./character-poses";
import { GRAB_PULL, heldPose, holderPose } from "./grab-pose";
import { applyPose } from "./joint-pose";
import { KNOCKOUT_FALL, KNOCKOUT_HANDOFF } from "./knockout-pose";
import { applyArm, rigReach, solveArm } from "./two-hand-hold";

/**
 * Playing the takedown grab (ADR-0075 stage 2) on the player's and the target's rigs, from the
 * views' `Transform.grab`: the clips of `grab-pose` eased in and out, the target pulled in front
 * of the player, and the player's hands put on its neck (two-bone IK, as the long-gun hold). A
 * choke or a kill hands the target over to the knockout poses on its knees. The state lives
 * here per rig, so the views only call in.
 */

/** Seconds to ease into the grab's clips, and out of them once it is over (the target over its fall from the knees). */
export const GRAB_IN = 0.25;
export const GRAB_OUT = 0.4;
const GRAB_OUT_HELD = 0.7;

export type GrabRole = "holder" | "held";

interface Anchor {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

interface Clip {
  /** The phase under way, null once the grab is over (the clip easing out). */
  phase: GrabPhase | null;
  /** The last phase played: the one easing out. */
  last: GrabPhase;
  /** Seconds into the phase. */
  time: number;
  /** 0..1 how far the clip is laid over the rig. */
  weight: number;
  /** The target only: 0..1 how far it is pulled in front of the player, and where that was. */
  pull: number;
  anchor: Anchor | null;
}

const clips = new WeakMap<CharacterRig, Clip>();

/** The rig is in a grab's clip, or easing out of one. */
export const inGrab = (rig: CharacterRig): boolean => clips.has(rig);

/** 0..1 how far the rig plays the grab right now. */
export const grabWeight = (rig: CharacterRig): number => smooth(clips.get(rig)?.weight ?? 0);

/** A new phase, or the end of the grab: the target that was choked or killed falls on from its knees. */
const enter = (rig: CharacterRig, c: Clip, grab: GrabPhase | null, role: GrabRole, unconscious: boolean): void => {
  if (grab) {
    c.phase = grab;
    c.last = grab;
    c.time = 0;
    return;
  }
  c.phase = null;
  // The knockout goes on from the knees, under the clip easing out.
  if (role === "held" && c.last !== "hold" && unconscious) rig.knockout = Math.max(rig.knockout, KNOCKOUT_HANDOFF);
};

/**
 * Advances the grab's clip of one rig and lays it over the pose: call after the walk, the
 * activity and the knockout (a target let go eases out over its fall). `role`: the player
 * holding, or the target held.
 */
export const animateGrab = (rig: CharacterRig, dt: number, t: Transform, role: GrabRole): void => {
  const grab = t.grab ?? null;
  let c = clips.get(rig);
  if (!c) {
    if (!grab) return;
    c = { phase: null, last: grab, time: 0, weight: 0, pull: 0, anchor: null };
    clips.set(rig, c);
  }
  if (grab !== c.phase) enter(rig, c, grab, role, !!t.unconscious);
  c.time += dt;
  const on = c.phase !== null;
  c.weight = on ? Math.min(1, c.weight + dt / GRAB_IN) : Math.max(0, c.weight - dt / (role === "held" ? GRAB_OUT_HELD : GRAB_OUT));
  // The body is put back where the simulation has it over the fall, not snapped there.
  if (role === "held") c.pull = on ? Math.min(1, c.pull + dt / GRAB_IN) : Math.max(0, c.pull - dt / KNOCKOUT_FALL);
  if (role === "holder" && c.phase === null && c.weight <= 0) clips.delete(rig);
  if (c.weight > 0) {
    const pose = role === "held" ? heldPose(rig, c.last, c.time) : holderPose(rig, c.last, c.time);
    applyPose(rig, pose, smooth(c.weight), role === "holder" ? 1 : 0.7);
  }
};

const lerpAngle = (a: number, b: number, t: number): number => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/**
 * Puts a held target's root `GRAB_PULL` in front of the player (`holder`, her rig's root), eased
 * in with the grab and back to the simulation's place (`t`, lifted `lift`) after it, laid over
 * by `lay` (a body turned and moved off a wall, `body-lay`). Returns false (and touches nothing)
 * for a rig that is not pulled.
 */
export const placeHeld = (rig: CharacterRig, t: Transform, lift: number, holder: CharacterRig | null, lay: LayOffset | null): boolean => {
  const c = clips.get(rig);
  if (!c) return false;
  if (holder && c.phase !== null) {
    const h = holder.root;
    const yaw = h.rotation.y;
    c.anchor = { x: h.position.x + Math.sin(yaw) * GRAB_PULL, y: h.position.y, z: h.position.z + Math.cos(yaw) * GRAB_PULL, yaw };
  }
  const a = c.anchor;
  if (!a) return false;
  const k = smooth(c.pull);
  const x = t.position.x + (lay?.x ?? 0);
  const y = t.position.y + lift;
  const z = t.position.z + (lay?.z ?? 0);
  rig.root.position.set(x + (a.x - x) * k, y + (a.y - y) * k, z + (a.z - z) * k);
  rig.root.rotation.y = lerpAngle(t.yaw + (lay?.turn ?? 0), a.yaw, k);
  // Back on the simulation's place: the clip is done with.
  if (c.phase === null && c.pull <= 0 && c.weight <= 0) clips.delete(rig);
  return true;
};

/** Computes the world matrices from the top of `node`'s chain down to it. */
const worldOf = (node: TransformNode): Matrix => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = node; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  return node.getWorldMatrix();
};

/** Where the right forearm crosses the throat (the wrist at its left side) and the left hand cups the back of the head, in the held rig's frames. */
const THROAT = new Vector3(-0.085, -0.075, 0.07);
const NAPE = new Vector3(-0.03, 0.05, -0.11);
/** Elbow hints: the right elbow out to the right in front of the throat, the left one down and out. */
const POLE_R = new Vector3(0.8, -0.2, 0.6).normalize();
const POLE_L = new Vector3(-0.8, -0.6, 0).normalize();
/** Hands: the right one's fingers round the far side of the neck, the left one's up over the skull. */
const handOf = (fingers: Vector3, thumb: Vector3) => {
  const y = fingers.normalize().negate();
  const z = thumb.normalize();
  return { x: Vector3.Cross(y, z), y, z };
};
const HAND_R = handOf(new Vector3(-1, 0, -0.3), new Vector3(0, 1, 0));
const HAND_L = handOf(new Vector3(0, 0.6, 0.8), new Vector3(1, 0, 0));

/**
 * The player's hands on the held target's neck, by the player's clip weight: call once both
 * rigs are posed and placed for the frame.
 */
export const reachForNeck = (holder: CharacterRig, held: CharacterRig): void => {
  const w = grabWeight(holder);
  if (w <= 0) return;
  const toHolder = worldOf(holder.body).clone().invert();
  const head = held.head;
  const throatAt = Vector3.TransformCoordinates(head.position.add(THROAT.scale(head.position.y / 1.6)), worldOf(held.body));
  const napeAt = Vector3.TransformCoordinates(NAPE, worldOf(head));
  const reach = holder.reach ?? rigReach(holder);
  const right = solveArm(reach.shoulderR, reach.upper, reach.fore, Vector3.TransformCoordinates(throatAt, toHolder), POLE_R, HAND_R);
  const left = solveArm(reach.shoulderL, reach.upper, reach.fore, Vector3.TransformCoordinates(napeAt, toHolder), POLE_L, HAND_L);
  applyArm(holder.armR, holder.elbowR, holder.wristR, right, w);
  applyArm(holder.armL, holder.elbowL, holder.wristL, left, w);
};
