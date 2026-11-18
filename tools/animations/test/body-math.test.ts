import { describe, expect, it } from "vitest";
import { ARM_POINTS, type ArmPoint, fromAxes, rotate, toBodyClip, torsoAxes, withoutTurn } from "../src/body-math.ts";
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
    expect(c.arms.slice(18, 21)).toEqual([0, -Math.round(Math.cos(0.3) * 100) / 100, Math.round(Math.sin(0.3) * 100) / 100]);
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

describe("a turn on the spot taken out of a clip (ADR-0090)", () => {
  it("keeps the hips' line across where it was and says how far the clip turned", () => {
    // Two frames: the second turned a quarter about the hips (x towards z).
    const base = raw(0);
    const turnPoint = (p: readonly number[], f: number): number[] => {
      if (f === 0) return [...p];
      const [x, y, z] = p as [number, number, number];
      return [-z, y, x];
    };
    const twice = (a: readonly number[]): number[] => [...turnPoint(a.slice(0, 3), 0), ...turnPoint(a.slice(3, 6), 1)];
    const map = <K extends string>(o: Record<K, readonly number[]>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, twice(v as number[])])) as Record<K, number[]>;
    const r = { ...base, hips: [0, 1, 0, 0, 1, 0], neck: twice(base.neck), arms: map(base.arms), legs: map(base.legs) };
    const { raw: still, turn } = withoutTurn(r);
    expect(turn).toBeCloseTo(Math.PI / 2 * 2, 5);
    // The right hip of the second frame is back where the first frame's was.
    expect(still.legs.hipR.slice(3, 6).map((v) => Math.round(v * 1000) / 1000)).toEqual(base.legs.hipR.slice(0, 3).map((v) => Math.round(v * 1000) / 1000));
  });
});
