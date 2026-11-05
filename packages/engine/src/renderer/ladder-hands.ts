import { Matrix, Vector3 } from "../babylon";
import type { CharacterRig } from "./character-rig";
import type { DressBlock } from "./dressing-plan";
import type { LadderRungs } from "./ladder-rungs";
import type { HandFrame } from "./two-hand-hold";
import { applyArm, rigReach, solveArm } from "./two-hand-hold";

export type { LadderRungs } from "./ladder-rungs";

/** A climber hangs this far behind the rungs (the content's `LADDER_OFFSET`, a little slack). */
const HANG = 0.7;

/** The ladder a climber with the feet at (x, y, z) hangs on, or null when there is none. */
export const rungsNear = (blocks: Iterable<DressBlock>, x: number, y: number, z: number): LadderRungs | null => {
  let best: LadderRungs | null = null;
  let bestOff = HANG;
  for (const b of blocks) {
    if (!b.rungs) continue;
    const bottom = b.center.y - b.size.y / 2;
    if (y < bottom - 1 || y > bottom + b.size.y) continue;
    // The rungs go across the wider horizontal side; the climber is in front of them.
    const alongX = b.size.x >= b.size.z;
    const across = alongX ? b.center.x - x : b.center.z - z;
    const ahead = alongX ? b.center.z - z : b.center.x - x;
    if (Math.abs(across) > Math.max(b.size.x, b.size.z) / 2 || Math.abs(ahead) >= bestOff) continue;
    bestOff = Math.abs(ahead);
    const yaw = alongX ? (ahead > 0 ? 0 : Math.PI) : ahead > 0 ? Math.PI / 2 : -Math.PI / 2;
    best = { bottom, spacing: b.size.y / b.rungs, count: b.rungs, x: b.center.x, z: b.center.z, yaw };
  }
  return best;
};

/** Without a ladder in view: rungs every 0.3 m from y = 0, as far in front as the content hangs them. */
const ladderAhead = (rig: CharacterRig): LadderRungs => {
  const yaw = rig.root.rotation.y;
  const p = rig.root.position;
  return { bottom: 0, spacing: 0.3, count: Number.MAX_SAFE_INTEGER, x: p.x + Math.sin(yaw) * 0.32, z: p.z + Math.cos(yaw) * 0.32, yaw };
};

/**
 * A hand goes up `CYCLE` rungs a cycle, the other half a cycle after it, so one cycle takes the
 * climber up two rungs (0.6 m): at the game's climbing speed (1.5 m/s) 2.5 cycles a second.
 */
const CYCLE = 2;
/** Of a hand's cycle, this much it holds its rung; then it lets go and reaches for the next one. */
const GRIP = 0.6;
/** A hand takes a rung this far up its arm's length over the shoulder, then the body goes up past it. */
const REACH_TOP = 0.8;
/** Hands this far apart from the ladder's middle, the palms this far on the climber's side of the bar. */
const HAND_APART = 0.17;
const PALM_IN = 0.025;
/** On the way to the next rung the hand comes this far off the ladder, clear of the bar between. */
const REACH_ARC = 0.1;
/** Elbows down and a little out, under the hands. */
const POLE_L = new Vector3(-0.5, -1, -0.4).normalize();
const POLE_R = new Vector3(0.5, -1, -0.4).normalize();

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/**
 * Where on the ladder hand `o` (0 the left, `CYCLE / 2` the right) is at rung coordinate `a`
 * (the top of the reach, in rungs: 0 at rung 0's bar): the rung it holds, and how far it is
 * between that one and the next (0 holding .. 1, the arc of the reach).
 */
const handOn = (a: number, o: number, count: number): { y: number; reach: number } => {
  const q = (a + o) / CYCLE;
  const f = q - Math.floor(q);
  const held = Math.floor(q) * CYCLE - o;
  const clamp = (j: number) => Math.min(count - 1, Math.max(0, j));
  if (f < GRIP) return { y: clamp(held), reach: 0 };
  const t = (f - GRIP) / (1 - GRIP);
  return { y: clamp(held) + (clamp(held + CYCLE) - clamp(held)) * smoothstep(t), reach: Math.sin(Math.PI * t) };
};

const inverse = new Matrix();

/**
 * Hand over hand on the rungs (G-310): each hand holds a rung while the body climbs past it,
 * then reaches up two rungs, the hands half a cycle apart. The phase is the height on the ladder,
 * so the hands stay on the rungs at any speed, up or down, and do not move while she hangs still.
 * Turns the arms by `w` (the ladder pose's blend); the legs step with the same phase. Call once
 * the body is posed for the frame.
 */
export const reachForRungs = (rig: CharacterRig, w: number, ladder: LadderRungs | null): void => {
  const l = ladder ?? ladderAhead(rig);
  const reach = rig.reach ?? rigReach(rig);
  const feet = rig.root.position.y;
  const a = (feet + reach.shoulderL.y + REACH_TOP * (reach.upper + reach.fore) - l.bottom) / l.spacing - 0.5;
  rig.climbPhase = (2 * Math.PI * a) / CYCLE;
  rig.root.computeWorldMatrix(true);
  rig.body.computeWorldMatrix(true).invertToRef(inverse);
  const facing = new Vector3(Math.sin(l.yaw), 0, Math.cos(l.yaw));
  const side = new Vector3(facing.z, 0, -facing.x);
  const n = Vector3.TransformNormal(facing, inverse).normalize();
  const down = Vector3.TransformNormal(Vector3.Down(), inverse).normalize();
  const hands = [
    { arm: rig.armL, elbow: rig.elbowL, wrist: rig.wristL, shoulder: reach.shoulderL, pole: POLE_L, o: 0, s: -1, f: 0 },
    { arm: rig.armR, elbow: rig.elbowR, wrist: rig.wristR, shoulder: reach.shoulderR, pole: POLE_R, o: CYCLE / 2, s: 1, f: 1 },
  ] as const;
  for (const h of hands) {
    const on = handOn(a, h.o, l.count);
    const centre = new Vector3(l.x, l.bottom + (on.y + 0.5) * l.spacing, l.z)
      .addInPlace(side.scale(h.s * HAND_APART))
      .subtractInPlace(facing.scale(PALM_IN + REACH_ARC * on.reach));
    // Palm against the rung, fingers up over it, thumbs in.
    const x = n.scale(-h.s);
    const frame: HandFrame = { x, y: down, z: Vector3.Cross(x, down) };
    const palm = reach.palm;
    const local = Vector3.TransformCoordinates(centre, inverse);
    const wrist = local.subtract(frame.x.scale(h.s < 0 ? -palm.x : palm.x)).subtract(frame.y.scale(palm.y)).subtract(frame.z.scale(palm.z));
    applyArm(h.arm, h.elbow, h.wrist, solveArm(h.shoulder, reach.upper, reach.fore, wrist, h.pole, frame), w);
    rig.fist[h.f] = 0.8 * w * (1 - on.reach);
  }
};
