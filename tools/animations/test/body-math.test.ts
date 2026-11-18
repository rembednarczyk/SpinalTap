import { describe, expect, it } from "vitest";
import { ARM_POINTS, type ArmPoint, fromAxes, rotate, toBodyClip, torsoAxes } from "../src/body-math.ts";
import { LEG_JOINTS, type LegJoint } from "../src/clip-math.ts";

/** A figure standing upright: hips at 1, neck at 1.5, shoulders 0.2 to each side; legs of 1 hanging straight; arms down. */
const upright = { hips: [0, 1, 0], neck: [0, 1.5, 0], shoulderL: [-0.2, 1.45, 0], shoulderR: [0.2, 1.45, 0] };

const raw = (lean: number) => {
  // The second frame leans the torso `lean` radians forward about the hips.
  const turn = (p: readonly number[]): number[] => [p[0]!, 1 + (p[1]! - 1) * Math.cos(lean), (p[1]! - 1) * Math.sin(lean)];
  const frames = [upright, { hips: upright.hips, neck: turn(upright.neck), shoulderL: turn(upright.shoulderL), shoulderR: turn(upright.shoulderR) }];
  const arms = Object.fromEntries(ARM_POINTS.map((k) => [k, frames.flatMap((f) => {
    const s = k.endsWith("L") ? f.shoulderL : f.shoulderR;
    const down = { shoulder: 0, elbow: 0.3, wrist: 0.55, finger: 0.65 }[k.slice(0, -1) as "shoulder"]!;
    return [s[0]!, s[1]! - down, s[2]!];
  })])) as Record<ArmPoint, number[]>;
  const legs = Object.fromEntries(LEG_JOINTS.map((j) => [j, frames.flatMap(() => {
    const x = j.endsWith("L") ? -0.1 : 0.1;
    const y = { hip: 1, knee: 0.5, ankle: 0, toe: 0 }[j.slice(0, -1) as "hip"]!;
    return [x, y, j.startsWith("toe") ? 0.1 : 0];
  })])) as Record<LegJoint, number[]>;
  return { cycle: 1, frames: 2, hips: [0, 1, 0, 0, 1, 0], neck: frames.flatMap((f) => f.neck), bind: upright, head: [0, 0, 0, 1, 0, 0, 0, 1], arms, legs };
};

describe("a Mixamo clip's upper body for the engine (ADR-0090 stage 2)", () => {
  it("reads no turn from an upright torso, and a forward lean from one leaning", () => {
    expect(fromAxes([1, 0, 0], [0, 1, 0], [0, 0, 1])).toEqual([0, 0, 0, 1]);
    expect(torsoAxes(upright, 0)[3]).toBeCloseTo(1, 9);
    const c = toBodyClip(raw(0.3), "pose");
    expect(c.chest.slice(0, 4)).toEqual([0, 0, 0, 1]);
    // Leaning forward turns +Y (up) towards +Z (ahead).
    const q = c.chest.slice(4, 8) as [number, number, number, number];
    const up = rotate(q, [0, 1, 0]);
    expect(up[2]).toBeCloseTo(Math.sin(0.3), 2);
    // An arm hanging straight down in the world points as far ahead of the leaning torso's down.
    expect(c.arms.slice(0, 3)).toEqual([0, -1, 0]);
    expect(c.arms.slice(18, 21)).toEqual([0, -Math.round(Math.cos(0.3) * 1000) / 1000, Math.round(Math.sin(0.3) * 1000) / 1000]);
    expect(c.legs).toHaveLength(2 * 24);
  });

  it("keeps of a delta clip only how the torso, the head and the hips move from its first frame", () => {
    const c = toBodyClip(raw(0.3), "delta");
    expect(c.chest.slice(0, 4)).toEqual([0, 0, 0, 1]);
    expect(c.hips.slice(0, 3)).toEqual([0, 0, 0]);
    expect(c.arms).toEqual([]);
    expect(c.legs).toEqual([]);
  });
});
