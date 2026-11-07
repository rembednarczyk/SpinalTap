import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, type TransformNode, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterRig, animateRig, buildHeroine } from "../src/renderer/characters";
import { type LadderRungs, rungsNear } from "../src/renderer/ladder-hands";
import { rigReach } from "../src/renderer/two-hand-hold";

/*
 * G-310: on a ladder the hands go from rung to rung. A hand that holds stays on its rung while
 * the body goes past it, so the phase follows the height on the ladder, not the way climbed.
 */

/** A ladder as the content builds it: its foot off the 0.3 m grid, so the rungs are where it puts them. */
const BOTTOM = 12.37;
const HEIGHT = 7.6;
const RUNGS = Math.round(HEIGHT / 0.3);
/** The climber hangs on the ladder's line, 0.32 m behind the rungs, facing them along +Z. */
const AT = { x: 4, z: -2 };
const LADDER: LadderRungs = { bottom: BOTTOM, spacing: HEIGHT / RUNGS, count: RUNGS, x: AT.x, z: AT.z + 0.32, yaw: 0 };

const FPS = 60;

/** The chain from the root down to a wrist, world matrices fresh. */
const palmOf = (rig: CharacterRig, wrist: TransformNode): Vector3 => {
  const chain: TransformNode[] = [];
  for (let n: TransformNode | null = wrist; n; n = n.parent as TransformNode | null) chain.unshift(n);
  for (const n of chain) n.computeWorldMatrix(true);
  return Vector3.TransformCoordinates(rigReach(rig).palm, wrist.getWorldMatrix());
};

/** How far a point is from the nearest rung of `l` (a bar across the ladder, 0.6 m wide). */
const offRung = (p: Vector3, l: LadderRungs = LADDER): number => {
  const j = Math.min(l.count - 1, Math.max(0, Math.round((p.y - l.bottom) / l.spacing - 0.5)));
  const dy = p.y - (l.bottom + (j + 0.5) * l.spacing);
  const fx = Math.sin(l.yaw);
  const fz = Math.cos(l.yaw);
  const ahead = (p.x - l.x) * fx + (p.z - l.z) * fz;
  const across = Math.max(0, Math.abs((p.x - l.x) * fz - (p.z - l.z) * fx) - 0.3);
  return Math.hypot(across, dy, ahead);
};

interface Frame {
  readonly palms: readonly [Vector3, Vector3];
}

/** Climbs `l` at `speed(t)` m/s (null: off it) from height `from` for `seconds`, the heroine on its line facing it. */
const climb = (seconds: number, speed: (t: number) => number | null, from = BOTTOM, l = LADDER): { rig: CharacterRig; frames: Frame[] } => {
  const scene = new Scene(new NullEngine());
  const rig = buildHeroine(scene, new ToonMaterials(scene), "h");
  rig.root.position.set(l.x - Math.sin(l.yaw) * 0.32, from, l.z - Math.cos(l.yaw) * 0.32);
  rig.root.rotation.y = l.yaw;
  const frames: Frame[] = [];
  let y = from;
  for (let i = 0; i < seconds * FPS; i++) {
    const v = speed(i / FPS);
    y += (v ?? 0) / FPS;
    rig.root.position.y = y;
    animateRig(rig, 0, 1 / FPS, 0, {}, v === null ? {} : { climb: v, rungs: l });
    frames.push({ palms: [palmOf(rig, rig.wristL), palmOf(rig, rig.wristR)] });
  }
  return { rig, frames };
};

/** Seconds into the climb by which the ladder pose has eased in. */
const SETTLED = 0.6;

describe("hands on the rungs (G-310)", () => {
  it("one hand or the other holds a rung in every frame of a climb, and a holding hand does not slide", () => {
    const { frames } = climb(3, (t) => (t < 0.3 ? 0 : 1.5));
    let worst = 0;
    let slide = 0;
    const holding = [0, 0];
    frames.forEach((f, i) => {
      if (i < SETTLED * FPS) return;
      const off = f.palms.map((p) => offRung(p));
      worst = Math.max(worst, Math.min(...off));
      off.forEach((d, h) => {
        if (d > 0.04) return;
        holding[h]!++;
        // Holding on in two frames running: the hand stays put while the body climbs past it.
        const before = frames[i - 1]!.palms[h]!;
        if (d <= 0.01 && offRung(before) <= 0.01) slide = Math.max(slide, Vector3.Distance(before, f.palms[h]!) * FPS);
      });
    });
    expect(worst).toBeLessThan(0.04);
    expect(slide).toBeLessThan(0.2);
    // Both hands do the holding, each most of the time.
    const settled = frames.length - SETTLED * FPS;
    for (const n of holding) expect(n / settled).toBeGreaterThan(0.5);
  });

  it("down the ladder the hands hold the rungs too", () => {
    const { frames } = climb(3, (t) => (t < 0.3 ? 0 : -1.5), BOTTOM + 5);
    const worst = Math.max(...frames.slice(SETTLED * FPS).map((f) => Math.min(...f.palms.map((p) => offRung(p)))));
    expect(worst).toBeLessThan(0.04);
  });

  it("on another ladder (facing east, rungs 0.31 m apart) and faster, the hands hold its rungs too", () => {
    const east: LadderRungs = { bottom: -3.05, spacing: 0.31, count: 20, x: -7, z: 11, yaw: Math.PI / 2 };
    const { frames } = climb(2, (t) => (t < 0.3 ? 0 : 2.2), east.bottom, east);
    const worst = Math.max(...frames.slice(SETTLED * FPS).map((f) => Math.min(...f.palms.map((p) => offRung(p, east)))));
    expect(worst).toBeLessThan(0.04);
  });

  it("stopping and going on again moves no hand at a jerk", () => {
    const speed = (t: number) => (t < 0.3 ? 0 : t < 1.37 ? 1.5 : t < 2 ? 0 : 1.5);
    const { frames } = climb(2.6, speed);
    // Still on the rungs: the hands do not move at all while she hangs there.
    const still = frames.slice(1.4 * FPS, 2 * FPS);
    for (let i = 1; i < still.length; i++) for (const h of [0, 1]) expect(Vector3.Distance(still[i]!.palms[h]!, still[i - 1]!.palms[h]!)).toBeLessThan(1e-3);
    // No hand jumps further in a frame than a reach to the next rung but one takes it.
    let jump = 0;
    for (let i = SETTLED * FPS; i < frames.length; i++) for (const h of [0, 1]) jump = Math.max(jump, Vector3.Distance(frames[i]!.palms[h]!, frames[i - 1]!.palms[h]!));
    expect(jump).toBeLessThan(0.12);
  });

  it("off the ladder the hands let go of its rungs without a jump", () => {
    const { frames } = climb(2, (t) => (t < 0.3 ? 0 : t < 1.4 ? 1.5 : null));
    let jump = 0;
    for (let i = 1.4 * FPS; i < frames.length; i++) for (const h of [0, 1]) jump = Math.max(jump, Vector3.Distance(frames[i]!.palms[h]!, frames[i - 1]!.palms[h]!));
    // The ladder pose eases out (some 0.15 m of the hands in its first frame); hands that went
    // for rungs other than this ladder's on the way down would jump twice as far.
    expect(jump).toBeLessThan(0.2);
  });

  it("the climb pose follows the height: the same height gives the same hands, whatever the way there", () => {
    const up = climb(2, (t) => (t < 0.3 ? 0 : 1.5));
    // Further up, then back down to the same height: a longer way there.
    const back = climb(3, (t) => (t < 0.3 ? 0 : t < 2.5 ? 1.5 : -1.5));
    expect(back.rig.root.position.y).toBeCloseTo(up.rig.root.position.y, 6);
    const a = up.frames.at(-1)!.palms;
    const b = back.frames.at(-1)!.palms;
    for (const h of [0, 1]) expect(Vector3.Distance(a[h]!, b[h]!)).toBeLessThan(0.01);
  });

  it("finds the ladder a climber hangs on, and none away from one", () => {
    const block = { center: { x: LADDER.x, y: BOTTOM + HEIGHT / 2, z: LADDER.z }, size: { x: 0.6, y: HEIGHT, z: 0.08 }, material: "metal" as const, rungs: RUNGS };
    const wall = { center: { x: 0, y: 5, z: 0 }, size: { x: 10, y: 10, z: 1 }, material: "concrete" as const };
    const found = rungsNear([wall, block], AT.x, BOTTOM + 3, AT.z);
    expect(found).not.toBeNull();
    expect(found!.bottom).toBeCloseTo(BOTTOM, 6);
    expect(found!.spacing).toBeCloseTo(LADDER.spacing, 6);
    expect(found!.yaw).toBeCloseTo(0, 6);
    expect(rungsNear([wall, block], AT.x + 3, BOTTOM + 3, AT.z)).toBeNull();
    expect(rungsNear([wall, block], AT.x, BOTTOM + HEIGHT + 2, AT.z)).toBeNull();
  });
});
