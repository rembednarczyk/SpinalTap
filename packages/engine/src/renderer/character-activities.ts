import type { ActivityId, EntityId } from "@seki/core";
import type { Mesh, Scene, TransformNode } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import { type ActivityBlend, type ActivityProp, blendJoints, blendWeight, freshBlend, propsOf, setBlendTarget, stepBlend } from "./activity-poses";
import { ActivityProps, PROP_DRAW_DISTANCE } from "./activity-props";
import { applyActivityPose } from "./activity-rig";
import type { CharacterRig } from "./character-rig";
import type { HumanoidRetarget } from "./model-rig";

/** Walking faster than this (m/s) holds an activity's pose out. */
const MOVING = 0.6;

interface HeldProp {
  readonly kind: ActivityProp;
  readonly node: TransformNode;
  readonly meshes: Mesh[];
  readonly tip: Mesh | null;
  readonly hand: "left" | "right" | null;
  /** The imported model's hand it sits in, if moved there. */
  onModel: HumanoidRetarget | null;
}

interface Doing {
  readonly blend: ActivityBlend;
  props: HeldProp[];
  /** The activity the props were built for. */
  propsFor: ActivityId | null;
  /** No stool: the character sits on something of the scene (the metro bench). */
  readonly seated: boolean;
}

export interface ActivityOptions {
  /** Sits on the scene's own seat (no stool is brought). */
  readonly seat?: "scene";
}

/** Position of the camera, for the props' draw distance. */
export type CameraPosition = () => { readonly x: number; readonly y: number; readonly z: number };

/**
 * Activities of the characters (ADR-0040), a part behind the `BabylonRenderer` facade: the
 * blend from walking into an activity and between activities, the pose laid over the walk
 * animation each frame, and the things held (a cigarette with a glowing tip, a phone, a can,
 * a bowl, a broom, a stool to sit on). Poses are pure functions (activity-poses.ts).
 */
export class CharacterActivities {
  private readonly doing = new Map<EntityId, Doing>();
  private readonly props: ActivityProps;

  constructor(
    scene: Scene,
    materials: ToonMaterials,
    private readonly camera: CameraPosition,
  ) {
    this.props = new ActivityProps(scene, materials);
  }

  /** The character now does `activity` (null: back to walking and standing). */
  set(id: EntityId, activity: ActivityId | null, options: ActivityOptions = {}): void {
    let d = this.doing.get(id);
    if (!d) {
      if (activity === null) return;
      d = { blend: freshBlend(), props: [], propsFor: null, seated: options.seat === "scene" };
      this.doing.set(id, d);
    }
    setBlendTarget(d.blend, activity);
  }

  /** What the character is doing now (debug and tests). */
  activityOf(id: EntityId): ActivityId | null {
    return this.doing.get(id)?.blend.target ?? null;
  }

  get count(): number {
    return this.doing.size;
  }

  /** Drops a character's activity and its props, before its rig (or its model) goes. */
  forget(id: EntityId): void {
    const d = this.doing.get(id);
    if (!d) return;
    this.dropProps(d);
    this.doing.delete(id);
  }

  clear(): void {
    for (const id of [...this.doing.keys()]) this.forget(id);
  }

  /**
   * One frame of a character, right after `animateRig`: eases the blend and lays the pose over
   * the walk. `retarget` is the imported model dressed over the rig, if any.
   */
  apply(id: EntityId, rig: CharacterRig, speed: number, dt: number, retarget: HumanoidRetarget | null): void {
    const d = this.doing.get(id);
    if (!d) return;
    const showing = stepBlend(d.blend, dt, speed > MOVING);
    const joints = blendJoints(d.blend);
    applyActivityPose(rig, joints ?? zeroJoints, showing && joints ? blendWeight(d.blend) : 0);
    if (!showing) {
      this.forget(id);
      return;
    }
    this.updateProps(d, rig, retarget);
  }

  private updateProps(d: Doing, rig: CharacterRig, retarget: HumanoidRetarget | null): void {
    const b = d.blend;
    const wanted = b.weight > 0.5 ? b.current : null;
    if (wanted !== d.propsFor) {
      this.dropProps(d);
      d.propsFor = wanted;
      const kinds = wanted ? propsOf(wanted).filter((k) => !(k === "stool" && d.seated)) : [];
      d.props = kinds.map((kind) => ({ ...this.props.build(kind, rig, rig.root.name), kind, onModel: null }));
    }
    const c = this.camera();
    const p = rig.root.position;
    const near = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) <= PROP_DRAW_DISTANCE;
    for (const h of d.props) {
      if (h.node.isEnabled() !== near) h.node.setEnabled(near);
      if (retarget && h.hand === "right" && h.onModel !== retarget && this.props.holdOnModel(h.node, retarget)) h.onModel = retarget;
      this.props.update(rig, h.kind === "stool" ? h.node : null, h.tip, b.time);
    }
  }

  private dropProps(d: Doing): void {
    for (const h of d.props) {
      h.onModel?.release(h.node);
      h.node.dispose(false, false);
    }
    d.props = [];
    d.propsFor = null;
  }
}

/** Neutral joints for the last frame of a blend (only the channels the walk never sets are read). */
const zeroJoints = {
  armLX: 0,
  armLZ: 0,
  elbowL: 0,
  armRX: 0,
  armRZ: 0,
  elbowR: 0,
  legLX: 0,
  legRX: 0,
  kneeL: 0,
  kneeR: 0,
  spread: 0,
  lean: 0,
  twist: 0,
  back: 0,
  headX: 0,
  headY: 0,
  headZ: 0,
};
