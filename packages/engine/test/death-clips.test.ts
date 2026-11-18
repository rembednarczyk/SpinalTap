import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterDeaths } from "../src/renderer/character-deaths";
import { type CharacterRig, buildHeroine } from "../src/renderer/characters";
import { BODY_CLIPS } from "../src/renderer/clips/body-clips.generated";
import { deathClipOf, noteHit } from "../src/renderer/clips/death-clips";

/*
 * Deaths from Mixamo clips (ADR-0090): hit from the front a figure falls on its back, from behind
 * on its face, in the head on its back and to the side; it ends lying on the ground.
 */

const scene = new Scene(new NullEngine());
const materials = new ToonMaterials(scene);

/** A figure at the origin facing +Z, hit at `at` (or not), dead and fallen for `seconds`. */
const fallen = (name: string, at: Vector3 | null, head = false, seconds = 2.6): CharacterRig => {
  const r = buildHeroine(scene, materials, name);
  if (at) noteHit(r, at, head);
  const deaths = new CharacterDeaths(() => undefined);
  deaths.fall(r);
  for (let i = 0; i < seconds * 30; i++) deaths.update(1 / 30);
  return r;
};

const headAt = (r: CharacterRig): Vector3 => {
  r.root.computeWorldMatrix(true);
  return r.head.computeWorldMatrix(true).getTranslation().clone();
};

describe("deaths from the clips (ADR-0090)", () => {
  it("picks the fall by the way the last hit came", () => {
    const r = buildHeroine(scene, materials, "picker");
    expect(deathClipOf(r)).toBe(BODY_CLIPS.deathFront);
    noteHit(r, { x: 0, y: 1.2, z: 0.3 }, false);
    expect(deathClipOf(r)).toBe(BODY_CLIPS.deathFront);
    noteHit(r, { x: 0, y: 1.2, z: -0.3 }, false);
    expect(deathClipOf(r)).toBe(BODY_CLIPS.deathBack);
    noteHit(r, { x: 0, y: 1.6, z: 0.2 }, true);
    expect(deathClipOf(r)).toBe(BODY_CLIPS.deathHead);
  });

  it("shot from the front it ends on its back, from behind on its face, lying on the ground with the root upright", () => {
    const front = fallen("shot-front", new Vector3(0, 1.2, 0.3));
    const back = fallen("shot-back", new Vector3(0, 1.2, -0.3));
    for (const r of [front, back]) {
      expect(r.root.rotation.x).toBe(0);
      expect(headAt(r).y).toBeLessThan(0.45);
    }
    // Facing +Z: on its back the head lies behind (-Z), on its face ahead (+Z).
    expect(headAt(front).z).toBeLessThan(-0.8);
    expect(headAt(back).z).toBeGreaterThan(0.8);
  });
});
