import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterActivities } from "../src/renderer/character-activities";
import { type CharacterRig, animateRig, buildCivilian } from "../src/renderer/characters";
import { BODY_CLIPS } from "../src/renderer/clips/body-clips.generated";
import { activityFrame, handAtLips } from "../src/renderer/clips/activity-clips";
import { figureSeed } from "../src/renderer/clips/pose-lay";

/*
 * The passers-by's activities from Mixamo clips (ADR-0090, the user's clips of 18.11): smoking with
 * the drags at the lips, the phone at the right ear or typed on in front, a talk's gestures one
 * after another.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);
const DT = 1 / 10;

const world = (r: CharacterRig, n: CharacterRig["head"]): Vector3 => {
  r.root.computeWorldMatrix(true);
  return n.computeWorldMatrix(true).getTranslation().clone();
};

/** A figure in `activity` for `seconds`, `look` called every frame. */
const play = (name: string, activity: "smoke" | "phone" | "talk", seconds: number, look: (r: CharacterRig) => void): CharacterRig => {
  const acts = new CharacterActivities(scene, materials, () => ({ x: 0, y: 1.6, z: -3 }));
  const r = buildCivilian(scene, materials, name);
  acts.set(1, activity);
  for (let i = 0; i < seconds / DT; i++) {
    animateRig(r, 0, DT);
    acts.apply(1, r, 0, DT, null);
    if (i * DT > 2) look(r);
  }
  return r;
};

describe("activities from Mixamo clips (ADR-0090)", () => {
  it("a smoker brings the cigarette hand to the lips now and then, and lowers it between", () => {
    let most = 0;
    let least = 1;
    play("smoker", "smoke", BODY_CLIPS.smoke.cycle + 2, (r) => {
      const k = handAtLips(r);
      most = Math.max(most, k);
      least = Math.min(least, k);
    });
    expect(most).toBeGreaterThan(0.7);
    expect(least).toBeLessThan(0.2);
  });

  it("on the phone a figure holds it at the right ear, or types on it in front with both hands", () => {
    // Figures by name: one of each kind of phone call.
    const names = Array.from({ length: 40 }, (_, i) => `caller-${i}`);
    const kind = (n: string) => Math.floor(figureSeed(buildCivilian(scene, materials, n)) * 2);
    const talker = names.find((n) => kind(n) === 0)!;
    const texter = names.find((n) => kind(n) === 1)!;
    let ear = 0;
    play(talker, "phone", 8, (r) => {
      const d = Vector3.Distance(world(r, r.wristR), world(r, r.head));
      ear = Math.max(ear, d < 0.25 ? 1 : 0);
    });
    expect(ear).toBe(1);
    let front = 0;
    play(texter, "phone", 8, (r) => {
      const hands = Vector3.Distance(world(r, r.wristL), world(r, r.wristR));
      const below = world(r, r.head).y - world(r, r.wristR).y;
      if (hands < 0.25 && below > 0.2) front++;
    });
    expect(front).toBeGreaterThan(20);
  });

  it("a talk goes through gestures one after another, each figure in its own order", () => {
    const rig = buildCivilian(scene, materials, "talker");
    const heads = Array.from({ length: 20 }, (_, i) => activityFrame(rig, "talk", i * 1.5)!.head.asArray());
    // The head turns from one gesture to the next: not one pose held.
    const spread = Math.max(...heads.map((h) => Math.max(...h.map((v, j) => Math.abs(v - heads[0]![j]!)))));
    expect(spread).toBeGreaterThan(0.05);
    const other = buildCivilian(scene, materials, "another talker");
    expect(activityFrame(other, "talk", 3)!.head.asArray()).not.toEqual(activityFrame(rig, "talk", 3)!.head.asArray());
    // Names a letter apart are far apart: a crowd does not move as one.
    const seeds = Array.from({ length: 20 }, (_, i) => figureSeed(buildCivilian(scene, materials, `npc-${i}`)));
    expect(Math.max(...seeds) - Math.min(...seeds)).toBeGreaterThan(0.6);
    expect(new Set(seeds.map((x) => Math.floor(x * 2))).size).toBe(2);
    // The lean is a clip too: its procedural pose put the hands up by the head on the models (G-731).
    expect(activityFrame(rig, "lean", 1)).not.toBeNull();
    // An activity without a clip keeps its procedural pose.
    expect(activityFrame(rig, "sweep", 1)).toBeNull();
  });
});
