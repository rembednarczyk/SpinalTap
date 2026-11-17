import { describe, expect, it } from "vitest";
import { LEG_JOINTS, type LegJoint, type RawClip, legLength, mirrored, toLegClip } from "../src/clip-math.ts";

/** A clip of two frames walking 2 units ahead in a loop: legs of 1 (hip to knee 0.5, knee to ankle 0.5), the left foot ahead first. */
const raw = (): RawClip => {
  const leg = (side: number, ahead: number) => ({
    hip: [side * 0.1, 1, 0],
    knee: [side * 0.1, 0.5, ahead * 0.1],
    ankle: [side * 0.1, 0, ahead * 0.2],
    toe: [side * 0.1, 0, ahead * 0.2 + 0.1],
  });
  const frames = [
    { hips: [0, 1, 0], l: leg(-1, 1), r: leg(1, -1) },
    { hips: [0, 0.98, 1], l: leg(-1, -1), r: leg(1, 1) },
  ];
  const joints = Object.fromEntries(LEG_JOINTS.map((j) => [j, [] as number[]])) as Record<LegJoint, number[]>;
  const hips: number[] = [];
  for (const f of frames) {
    hips.push(...f.hips);
    for (const s of ["L", "R"] as const) {
      const g = s === "L" ? f.l : f.r;
      const z = f.hips[2]!;
      joints[`hip${s}`].push(g.hip[0]!, g.hip[1]!, g.hip[2]! + z);
      joints[`knee${s}`].push(g.knee[0]!, g.knee[1]!, g.knee[2]! + z);
      joints[`ankle${s}`].push(g.ankle[0]!, g.ankle[1]!, g.ankle[2]! + z);
      joints[`toe${s}`].push(g.toe[0]!, g.toe[1]!, g.toe[2]! + z);
    }
  }
  return { cycle: 1, frames: 2, hips, joints, hipsEnd: [0, 1, 2] };
};

describe("a Mixamo clip's legs for the engine (ADR-0090)", () => {
  it("measures the leg at the first frame and puts the joints in place, in leg lengths, with the loop's travel", () => {
    const r = raw();
    expect(legLength(r)).toBeCloseTo(Math.hypot(0.5, 0.1) + Math.hypot(0.5, 0.1), 9);
    const c = toLegClip(r);
    const unit = legLength(r);
    expect(c.stride).toEqual({ x: 0, z: Math.round((2 / unit) * 1000) / 1000 });
    // The left hip of frame 1 is beside the hips (which dipped 0.02), not 1 ahead with them: the root motion is out.
    expect(c.legs.slice(24, 27)).toEqual([Math.round((-0.1 / unit) * 1000) / 1000, Math.round((0.02 / unit) * 1000) / 1000, 0]);
    expect(c.bob).toEqual([Math.round((0.01 / unit) * 1000) / 1000, Math.round((-0.01 / unit) * 1000) / 1000]);
    expect(c.legs).toHaveLength(2 * 24);
  });

  it("turns a clip left for right: x over, the legs swapped, half a loop on, the travel's x over", () => {
    const r = { ...raw(), hipsEnd: [1, 1, 2] as const };
    const m = mirrored(r);
    // Frame 0 of the mirror is frame 1 of the clip, the right leg's path given to the left, x over.
    expect(m.joints.ankleL.slice(0, 3)).toEqual([-r.joints.ankleR[3]!, r.joints.ankleR[4]!, r.joints.ankleR[5]!]);
    expect(m.hips.slice(0, 3)).toEqual([-0, 0.98, 1]);
    expect(m.hipsEnd).toEqual([-1, 0.98, 3]);
    expect(toLegClip(m).stride.x).toBeCloseTo(-toLegClip(r).stride.x, 9);
  });
});
