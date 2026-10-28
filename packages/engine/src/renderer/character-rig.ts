import type { Mesh, TransformNode } from "../babylon";

/** A procedurally built character with a jointed skeleton for procedural animation. */
export interface CharacterRig {
  readonly root: TransformNode;
  /** Everything above the feet; bobs while walking and tips over on death. */
  readonly body: TransformNode;
  readonly head: TransformNode;
  readonly legL: TransformNode;
  readonly legR: TransformNode;
  readonly kneeL: TransformNode;
  readonly kneeR: TransformNode;
  readonly armL: TransformNode;
  readonly armR: TransformNode;
  readonly elbowL: TransformNode;
  readonly elbowR: TransformNode;
  readonly meshes: Mesh[];
  /** Carries a pistol: holster at the right hip, drawn into the right hand. */
  readonly aiming: boolean;
  /** Pistol in the hand and in the holster; the one not in use is scaled to zero. */
  readonly gunHand: TransformNode | null;
  readonly gunHip: TransformNode | null;
  /** The placeholder box pistols under hand and holster; scaled to zero once a weapon model is mounted. */
  readonly gunBoxes: readonly TransformNode[];
  /** 0 holstered .. 1 drawn, eased towards `drawTarget` over DRAW_SECONDS. */
  drawn: number;
  drawTarget: boolean;
  /** 0 low ready (muzzle down, arm loose) .. 1 aimed; raised by a shot, lowered after `aimHold`. */
  aim: number;
  aimHold: number;
  /** Seconds left of a reload, and its full length; 0 when not reloading. */
  reload: number;
  reloadTotal: number;
  /** Holds a melee weapon (from the appearance): swings and guards instead of aiming (ADR-0019). */
  melee: boolean;
  /** The melee swing being played, or null. */
  swing: Swing | null;
  /** 0..1 guard pose, eased towards the transform's guard. */
  guard: number;
  /** Seconds left of a stagger, and its full length; 0 when steady. */
  stagger: number;
  staggerTotal: number;
  /** Arms hang slightly away from the body (radians around Z). */
  readonly armSpread: number;
  /** Left arm held in a fixed pose (shoulder X, elbow X), e.g. holding an umbrella. */
  readonly leftHold: readonly [number, number] | null;
  phase: number;
  /** Forward stoop of the body at rest (radians around X), e.g. an old woman's bent back. */
  stoop: number;
  /** Seconds alive; drives idle breathing. */
  time: number;
  /** 0..1 flinch after a hit, decays quickly. */
  flinch: number;
  /** null while alive; seconds since death otherwise. */
  dying: number | null;
  /** Vertical speed last frame while airborne, null on the ground (ADR-0021). */
  lastAir: number | null;
  /** 0..1 blend of the jump pose, eased in on take-off and out on landing. */
  airBlend: number;
  /** 0..1 knee dip after landing, stronger after a long drop; decays. */
  landing: number;
  /** 0..1 blend of the ladder pose, and the phase of the hand-over-hand cycle. */
  climbBlend: number;
  climbPhase: number;
}

/** A melee swing in progress: strike `strike` of the combo, timed like the simulation's. */
export interface Swing {
  readonly strike: number;
  readonly windup: number;
  readonly recovery: number;
  elapsed: number;
}
