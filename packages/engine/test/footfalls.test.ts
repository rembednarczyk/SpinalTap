import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { animateRig, buildHeroine } from "../src/renderer/characters";
import { poseLegsFromClips } from "../src/renderer/clips/leg-pose";
import { FootfallCount, footfallsOf } from "../src/renderer/footfalls";
import { FootstepClock, MIN_STEP_GAP } from "../src/audio/footsteps";

/*
 * Footsteps with the feet (user notes of 18.11): the figure's footfalls in the picture lead the
 * footsteps' sound, one at most every 0.2 s, so a sprint or a dash does not spam it.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 60;

/** Footfalls of a figure moving at `speed` for `seconds`, each with the time it came. */
const walk = (speed: number, seconds: number): number[] => {
  const r = buildHeroine(scene, materials, `w${speed}`);
  const at: number[] = [];
  let z = 0;
  for (let i = 0; i < seconds / DT; i++) {
    z += speed * DT;
    r.root.position.set(0, 0, z);
    animateRig(r, speed, DT, 0, {});
    poseLegsFromClips(r, { x: 0, z }, speed, DT, 0);
    const n = footfallsOf(r, speed);
    for (let k = 0; k < n; k++) at.push(i * DT);
  }
  return at;
};

describe("footsteps with the feet (user notes of 18.11)", () => {
  it("counts the feet coming down: a walk's steps, a run's quicker ones, none standing", () => {
    const walking = walk(1.6, 4).filter((t) => t > 1);
    const running = walk(5, 4).filter((t) => t > 1);
    expect(walk(0, 3)).toEqual([]);
    // About two steps a second walking, more running; never two feet within a tenth of a second.
    expect(walking.length).toBeGreaterThanOrEqual(4);
    expect(running.length).toBeGreaterThan(walking.length);
    for (const s of [walking, running]) for (let i = 1; i < s.length; i++) expect(s[i]! - s[i - 1]!).toBeGreaterThan(0.1);
  });

  it("plays a footstep for a footfall, one at most every 0.2 s, and keeps its clock while no figure leads", () => {
    const clock = new FootstepClock();
    // No footfalls yet: the clock's own steps.
    let fromClock = 0;
    for (let t = 0; t < 2; t += 0.05) fromClock += clock.take(1.6, 0.05, t);
    expect(fromClock).toBeGreaterThan(0);
    const led = new FootstepClock();
    led.feel(1);
    expect(led.take(6, 0.05, 10)).toBe(1);
    led.feel(1);
    expect(led.take(6, 0.05, 10 + MIN_STEP_GAP / 2)).toBe(0);
    led.feel(1);
    expect(led.take(6, 0.05, 10 + MIN_STEP_GAP)).toBe(1);
    // Between footfalls nothing; standing nothing.
    expect(led.take(6, 0.05, 10.5)).toBe(0);
    led.feel(1);
    expect(led.take(0, 0.05, 11)).toBe(0);
    // Walking 1.2 s and more with no footfall (no figure drawn): the clock again.
    let late = 0;
    for (let t = 12; t < 14; t += 0.05) late += led.take(1.6, 0.05, t);
    expect(late).toBeGreaterThan(0);
  });

  it("hands the renderer's footfalls over once", () => {
    const c = new FootfallCount();
    c.add(1);
    c.add(1);
    expect([c.take(), c.take()]).toEqual([2, 0]);
  });
});
