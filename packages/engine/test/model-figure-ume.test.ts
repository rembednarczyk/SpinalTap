import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { ACTIVITY_IDS, type ActivityId } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Mesh, Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterActivities } from "../src/renderer/character-activities";
import { CharacterViews } from "../src/renderer/character-views";
import type { CharacterModelManifest } from "../src/renderer/model-library";
import { normaliseBoneName } from "../src/renderer/model-rig";
import { readModelFile, serveModels } from "./game-models";

const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
const WALK = { ...STAND, speed: 1.4 };

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Ume dressed over a rig that plays `activity` (null: walking), stepped `frames` frames. */
const ume = async (activity: ActivityId | null) => {
  serveModels();
  const scene = new Scene(new NullEngine());
  const materials = new ToonMaterials(scene);
  const acts = new CharacterActivities(scene, materials, () => ({ x: 0, y: 1.6, z: -3 }));
  const views = new CharacterViews({
    scene,
    materials,
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
    pose: (id, rig, speed, dt, retarget, clock) => acts.apply(id, rig, speed, dt, retarget, clock),
  });
  views.setCharacterModels(GAME);
  views.spawn(2, { kind: "npc", preset: "civilian", cast: "ume", umbrella: false }, STAND);
  for (let i = 0; i < 4000 && views.modelCounts.loading > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
  if (activity) acts.set(2, activity);
  const at = activity ? STAND : WALK;
  const step = () => {
    views.move(2, at);
    views.update(1 / 60);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    for (const n of scene.transformNodes) n.computeWorldMatrix(true);
  };
  const bone = (b: string) => scene.transformNodes.find((n) => n.name.startsWith("e2-m-") && normaliseBoneName(n.name, "e2-m-") === b)!;
  const boxOf = (name: string) => {
    const m = scene.getMeshByName(name) as Mesh;
    m.computeWorldMatrix(true);
    m.refreshBoundingInfo();
    return { on: m.isEnabled(), box: m.getBoundingInfo().boundingBox };
  };
  return { step, bone, cane: () => boxOf("e2-v-cane"), skirt: () => boxOf("e2-v-skirt") };
};

/** Activities seated or lying: the stiff bell would sink into the floor and lose the knees. */
const SEATED: readonly ActivityId[] = ["sit", "sleep"];

describe("Ume's stick and long skirt in every activity (ADR-0076 decision 7)", () => {
  it.each([null, ...ACTIVITY_IDS])("%s: the stick is on the ground by her hand or put away, the skirt round her knees or put away", async (activity) => {
    const u = await ume(activity);
    let caneSeen = 0;
    let skirtSeen = 0;
    for (let i = 0; i < 240; i++) {
      u.step();
      if (i < 90) continue;
      const cane = u.cane();
      if (cane.on) {
        caneSeen++;
        const hand = u.bone("rhand").getAbsolutePosition();
        expect(cane.box.minimumWorld.y, "stick on the ground").toBeGreaterThan(-0.05);
        expect(cane.box.minimumWorld.y, "stick on the ground").toBeLessThan(0.15);
        expect(Math.hypot(cane.box.centerWorld.x - hand.x, cane.box.centerWorld.z - hand.z), "stick by the hand").toBeLessThan(0.08);
      }
      const skirt = u.skirt();
      if (skirt.on) {
        skirtSeen++;
        const b = skirt.box;
        expect(b.minimumWorld.y, "skirt above the floor").toBeGreaterThan(-0.01);
        for (const k of ["llowerleg", "rlowerleg"]) {
          const p = u.bone(k).getAbsolutePosition();
          if (p.y < b.minimumWorld.y || p.y > b.maximumWorld.y) continue;
          expect(p.x > b.minimumWorld.x && p.x < b.maximumWorld.x && p.z > b.minimumWorld.z && p.z < b.maximumWorld.z, `${k} inside the skirt`).toBe(true);
        }
      }
    }
    // Walking and plain standing carry the stick; every activity puts it away.
    expect(caneSeen > 0, "stick shown").toBe(activity === null || activity === "idle");
    expect(skirtSeen > 0, "skirt shown").toBe(activity === null || !SEATED.includes(activity));
  });
});
