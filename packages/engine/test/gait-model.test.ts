import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { Transform } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterDescriptor, CharacterViews } from "../src/renderer/character-views";
import { buildCivilian, buildGanger } from "../src/renderer/characters";
import { BODY_CLIPS } from "../src/renderer/clips/body-clips.generated";
import { idleClipOf } from "../src/renderer/clips/body-pose";
import { LEG_CLIPS } from "../src/renderer/clips/leg-clips.generated";
import { legWeights } from "../src/renderer/clips/leg-pose";
import type { CharacterModelManifest } from "../src/renderer/model-library";
import { readModelFile, serveModels } from "./game-models";

/*
 * A man walks, runs and stands as a man (ADR-0090, 18.11): the Action Adventure pack's clips for
 * a man's build, the procedural one's or the dressed model's (shoulders against hips: the game's
 * men 1.74, its women 1.41), so a woman on a man's file walks as a man and the other way.
 */

const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const STAND: Transform = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
afterEach(() => vi.unstubAllGlobals());

describe("a man's gait (ADR-0090)", () => {
  it("walks and runs ahead on the men's clips, the rest as before", () => {
    const clips = (m: boolean, run: number) => legWeights(0, run, 0, m).map(([c]) => c);
    expect(clips(true, 0)).toEqual([LEG_CLIPS.walkM]);
    expect(clips(true, 1)).toEqual([LEG_CLIPS.runM]);
    expect(clips(false, 0)).toEqual([LEG_CLIPS.walk]);
    expect(legWeights(Math.PI / 2, 0, 0, true).map(([c]) => c)).toEqual([LEG_CLIPS.walkRight]);
  });

  it("takes the build from the procedural figure, then from the dressed model, and back", async () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    expect(buildGanger(scene, materials, "g").masculine).toBe(true);
    expect(buildCivilian(scene, materials, "c").masculine).toBe(false);
    serveModels();
    const views = new CharacterViews({
      scene,
      materials,
      shadow: { addCaster: () => undefined } as unknown as MoonShadow,
      camera: { camera: { position: new Vector3(0, 1.6, -4) }, handsBusy: false, setHeldWeapon: () => undefined, setPlaceholders: () => undefined } as unknown as CameraRig,
      cameraTarget: () => 999,
      lift: () => 0,
    });
    views.setCharacterModels(GAME);
    // A civilian on Kaito's file (a man), one on Hana's (mori.vrm, a woman).
    views.spawn(1, { kind: "npc", preset: "civilian", cast: "kaito" } as CharacterDescriptor, STAND);
    views.spawn(2, { kind: "npc", preset: "civilian", cast: "hana" } as CharacterDescriptor, STAND);
    for (let i = 0; i < 4000 && views.modelCounts.loading > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
    expect(views.rigOf(1)!.masculine).toBe(true);
    expect(views.rigOf(2)!.masculine).toBe(false);
    expect([BODY_CLIPS.idleM, BODY_CLIPS.idleShift]).toContain(idleClipOf(views.rigOf(1)!));
    expect([BODY_CLIPS.idle, BODY_CLIPS.idleShift]).toContain(idleClipOf(views.rigOf(2)!));
  });
});
