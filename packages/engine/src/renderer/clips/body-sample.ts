import { Quaternion, Vector3 } from "../../babylon";
import type { BodyClip } from "./body-clip";

/** A body clip at one moment (ADR-0090 stage 2), mixed between its two nearest frames. */
export interface BodyFrame {
  readonly hips: Vector3;
  readonly chest: Quaternion;
  readonly head: Quaternion;
  readonly arms: readonly number[];
  readonly legs: readonly number[];
  /** How far the gun has gone back along its barrel, in leg lengths (0 for a clip without it). */
  readonly gun: number;
}

const mixRows = (a: readonly number[], f0: number, f1: number, k: number, width: number): number[] => {
  const out = new Array<number>(width);
  for (let i = 0; i < width; i++) out[i] = a[f0 * width + i]! * (1 - k) + a[f1 * width + i]! * k;
  return out;
};
const quatAt = (a: readonly number[], f: number): Quaternion => new Quaternion(a[f * 4]!, a[f * 4 + 1]!, a[f * 4 + 2]!, a[f * 4 + 3]!);

/** The clip at `t` seconds: looped, or held at its last frame. */
export const sampleBody = (clip: BodyClip, t: number, loop: boolean): BodyFrame => {
  const n = clip.frames;
  let x = (t / clip.cycle) * n;
  x = loop ? ((x % n) + n) % n : Math.max(0, Math.min(n - 1, x));
  const f0 = Math.floor(x);
  const f1 = loop ? (f0 + 1) % n : Math.min(n - 1, f0 + 1);
  const k = x - f0;
  const [hx, hy, hz] = mixRows(clip.hips, f0, f1, k, 3) as [number, number, number];
  return {
    hips: new Vector3(hx, hy, hz),
    chest: Quaternion.Slerp(quatAt(clip.chest, f0), quatAt(clip.chest, f1), k),
    head: Quaternion.Slerp(quatAt(clip.head, f0), quatAt(clip.head, f1), k),
    arms: clip.arms.length ? mixRows(clip.arms, f0, f1, k, 18) : [],
    legs: clip.legs.length ? mixRows(clip.legs, f0, f1, k, 24) : [],
    gun: clip.gun.length ? mixRows(clip.gun, f0, f1, k, 1)[0]! : 0,
  };
};

/** Two frames mixed: `k` of the way from `a` to `b`. */
export const mixFrames = (a: BodyFrame, b: BodyFrame, k: number): BodyFrame => ({
  hips: Vector3.Lerp(a.hips, b.hips, k),
  chest: Quaternion.Slerp(a.chest, b.chest, k),
  head: Quaternion.Slerp(a.head, b.head, k),
  arms: a.arms.map((v, i) => v + (b.arms[i]! - v) * k),
  legs: a.legs.map((v, i) => v + (b.legs[i]! - v) * k),
  gun: a.gun + (b.gun - a.gun) * k,
});
