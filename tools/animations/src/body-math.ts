/**
 * The upper body of a Mixamo clip in the engine's terms (ADR-0090 stage 2): the torso's and the
 * head's rotations, the arms' and the hands' directions, the hips' shift and the legs, per frame.
 * A pose clip (idle) keeps the chest as turned from the bind pose (T-pose, everything upright), so
 * the figure stands as in the clip; a delta clip (a hit reaction) keeps how the chest, the head and
 * the hips move from its first frame, laid over whatever the figure does.
 */

import { LEG_JOINTS, type LegJoint } from "./clip-math.ts";

export type Quat = readonly [number, number, number, number];
export const ARM_POINTS = ["shoulderL", "elbowL", "wristL", "fingerL", "shoulderR", "elbowR", "wristR", "fingerR"] as const;
export type ArmPoint = (typeof ARM_POINTS)[number];

/** The points the torso's turn is read from, per frame (or once, in the bind pose). */
export interface TorsoPoints {
  readonly hips: readonly number[];
  readonly neck: readonly number[];
  readonly shoulderL: readonly number[];
  readonly shoulderR: readonly number[];
}

/** A clip sampled at `frames` evenly spaced times, in the rig's frame (positions in any unit). */
export interface RawBody {
  readonly cycle: number;
  readonly frames: number;
  readonly hips: readonly number[];
  readonly neck: readonly number[];
  /** The torso's points in the bind pose. */
  readonly bind: TorsoPoints;
  /** Per frame, the head's world rotation since the bind pose, x y z w. */
  readonly head: readonly number[];
  readonly arms: Readonly<Record<ArmPoint, readonly number[]>>;
  readonly legs: Readonly<Record<LegJoint, readonly number[]>>;
}

export type BodyMode = "pose" | "delta";

export interface BodyClip {
  readonly cycle: number;
  readonly frames: number;
  /** The hips per frame against their mean (pose) or their first frame (delta), in leg lengths. */
  readonly hips: readonly number[];
  /**
   * Per frame x y z w: the torso's rotation (pose: from upright; delta: from the first frame), the
   * torso taken as one rigid piece from the hips to the neck and across the shoulders, as the rig's.
   */
  readonly chest: readonly number[];
  /** Per frame x y z w: the head's in the chest's frame (pose: from upright; delta: from the first frame). */
  readonly head: readonly number[];
  /** Per frame, unit directions in the chest's frame: upper arm, forearm, hand, left then right (pose only). */
  readonly arms: readonly number[];
  /** Per frame, the legs' joints relative to the hips, in leg lengths (pose only; as a leg clip's). */
  readonly legs: readonly number[];
}

const at = (a: readonly number[], f: number): [number, number, number] => [a[f * 3]!, a[f * 3 + 1]!, a[f * 3 + 2]!];
const quat = (a: readonly number[], f: number): Quat => [a[f * 4]!, a[f * 4 + 1]!, a[f * 4 + 2]!, a[f * 4 + 3]!];
const round = (v: number): number => Math.round(v * 1000) / 1000;

export const mul = (a: Quat, b: Quat): Quat => {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz];
};
export const inv = (q: Quat): Quat => [-q[0], -q[1], -q[2], q[3]];
/** `v` turned by `q`. */
export const rotate = (q: Quat, v: readonly [number, number, number]): [number, number, number] => {
  const r = mul(mul(q, [v[0], v[1], v[2], 0]), inv(q));
  return [r[0], r[1], r[2]];
};
const unit = (v: readonly [number, number, number]): [number, number, number] => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const sub = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!];
/** One sign for all: q and -q turn alike, and the frames between are mixed linearly. */
const signed = (q: Quat, w: number): Quat => (w < 0 ? [-q[0], -q[1], -q[2], -q[3]] : q);

const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];

/** The rotation whose columns are the unit axes x, y, z. */
export const fromAxes = (x: readonly number[], y: readonly number[], z: readonly number[]): Quat => {
  const [m00, m10, m20] = x as [number, number, number];
  const [m01, m11, m21] = y as [number, number, number];
  const [m02, m12, m22] = z as [number, number, number];
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const k = 0.5 / Math.sqrt(tr + 1);
    return [(m21 - m12) * k, (m02 - m20) * k, (m10 - m01) * k, 0.25 / k];
  }
  if (m00 > m11 && m00 > m22) {
    const k = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return [0.25 * k, (m01 + m10) / k, (m02 + m20) / k, (m21 - m12) / k];
  }
  if (m11 > m22) {
    const k = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return [(m01 + m10) / k, 0.25 * k, (m12 + m21) / k, (m02 - m20) / k];
  }
  const k = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return [(m02 + m20) / k, (m12 + m21) / k, 0.25 * k, (m10 - m01) / k];
};

/** The torso's axes at frame `f` as a rotation: up from the hips to the neck, right across the shoulders. */
export const torsoAxes = (p: TorsoPoints, f: number): Quat => {
  const up = unit(sub(at(p.neck, f), at(p.hips, f)));
  const across = sub(at(p.shoulderR, f), at(p.shoulderL, f));
  const d = across[0] * up[0] + across[1] * up[1] + across[2] * up[2];
  const right = unit([across[0] - d * up[0], across[1] - d * up[1], across[2] - d * up[2]]);
  return fromAxes(right, up, cross(right, up));
};

const legUnit = (raw: RawBody): number => {
  const d = (a: readonly number[], b: readonly number[]) => Math.hypot(...sub(at(a, 0), at(b, 0)));
  const leg = (s: "L" | "R") => d(raw.legs[`hip${s}`], raw.legs[`knee${s}`]) + d(raw.legs[`knee${s}`], raw.legs[`ankle${s}`]);
  return (leg("L") + leg("R")) / 2;
};

/** The clip in the engine's terms. */
export const toBodyClip = (raw: RawBody, mode: BodyMode): BodyClip => {
  const u = legUnit(raw);
  const n = raw.frames;
  const ref = (a: readonly number[]): [number, number, number] => {
    if (mode === "delta") return at(a, 0);
    const m: [number, number, number] = [0, 0, 0];
    for (let f = 0; f < n; f++) for (let i = 0; i < 3; i++) m[i]! += a[f * 3 + i]! / n;
    return m;
  };
  const hipsRef = ref(raw.hips);
  const points: TorsoPoints = { hips: raw.hips, neck: raw.neck, shoulderL: raw.arms.shoulderL, shoulderR: raw.arms.shoulderR };
  const fromBind = inv(torsoAxes(raw.bind, 0));
  const torso = (f: number): Quat => mul(torsoAxes(points, f), fromBind);
  const c0 = torso(0);
  const h0 = mul(inv(c0), quat(raw.head, 0));
  const hips: number[] = [];
  const chest: number[] = [];
  const head: number[] = [];
  const arms: number[] = [];
  const legs: number[] = [];
  let prevC: Quat = [0, 0, 0, 1];
  let prevH: Quat = [0, 0, 0, 1];
  for (let f = 0; f < n; f++) {
    hips.push(...sub(at(raw.hips, f), hipsRef).map((v) => round(v / u)));
    const c = torso(f);
    const inChest = mul(inv(c), quat(raw.head, f));
    let cq = mode === "delta" ? mul(c, inv(c0)) : c;
    let hq = mode === "delta" ? mul(inChest, inv(h0)) : inChest;
    // Keep each next to the last, so a linear mix between frames takes the short way.
    cq = signed(cq, cq[0] * prevC[0] + cq[1] * prevC[1] + cq[2] * prevC[2] + cq[3] * prevC[3]);
    hq = signed(hq, hq[0] * prevH[0] + hq[1] * prevH[1] + hq[2] * prevH[2] + hq[3] * prevH[3]);
    prevC = cq;
    prevH = hq;
    chest.push(...cq.map(round));
    head.push(...hq.map(round));
    if (mode === "delta") continue;
    const back = inv(c);
    for (const s of ["L", "R"] as const) {
      const p = (k: string) => at(raw.arms[`${k}${s}` as ArmPoint], f);
      for (const [a, b] of [
        ["shoulder", "elbow"],
        ["elbow", "wrist"],
        ["wrist", "finger"],
      ] as const)
        arms.push(...unit(rotate(back, sub(p(b), p(a)))).map(round));
    }
    const hip = at(raw.hips, f);
    for (const j of LEG_JOINTS) legs.push(...sub(at(raw.legs[j], f), hip).map((v) => round(v / u)));
  }
  return { cycle: round(raw.cycle), frames: n, hips, chest, head, arms, legs };
};

/** The generated module of the engine's body clips. */
export const bodyClipsModule = (clips: Readonly<Record<string, BodyClip>>, sources: Readonly<Record<string, string>>): string =>
  [
    "// Generated by tools/animations (ADR-0090) from Mixamo clips; do not edit by hand.",
    `// Sources: ${Object.entries(sources)
      .map(([k, v]) => `${k} <- ${v}`)
      .join("; ")}.`,
    'import type { BodyClip } from "./body-clip";',
    "",
    "export const BODY_CLIPS = {",
    ...Object.entries(clips).map(([k, c]) => `  ${k}: ${JSON.stringify(c)},`),
    "} as const satisfies Readonly<Record<string, BodyClip>>;",
    "",
  ].join("\n");
