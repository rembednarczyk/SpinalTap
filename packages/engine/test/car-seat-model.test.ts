import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { CarPose, Transform } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { type CharacterDescriptor, CharacterViews } from "../src/renderer/character-views";
import type { CharacterModelManifest } from "../src/renderer/model-library";
import { readModelFile, serveModels } from "./game-models";

/*
 * Seated at a car on the game's models (ADR-0097, user's notes of 21.11): a dressed model hangs on
 * the rig's body with its hips its own legs' length over its feet, so the rig's hips on the seat
 * left a long-legged model's hips up to 0.35 m over it and its head through the roof (1.15 m). Its
 * own hip joints go on the seat now, whatever its legs, and its head stays under the roof.
 */

const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const SEAT = { x: -0.38, y: 0.26, z: -0.36 };
afterEach(() => vi.unstubAllGlobals());

const at = (n: { computeWorldMatrix(force: boolean): { getTranslation(): Vector3 } } | null): Vector3 => n!.computeWorldMatrix(true).getTranslation();

describe("a dressed model at a car's wheel (ADR-0097)", () => {
  it.each(["drive", "pulled"] as const)("%s: its hips on the seat and its head under the roof, the heroine's and the street's short and tall", async (act) => {
    serveModels();
    const scene = new Scene(new NullEngine());
    const cam = new Vector3(0, 1.6, -4);
    const views = new CharacterViews({
      scene,
      materials: new ToonMaterials(scene),
      shadow: { addCaster: () => undefined } as unknown as MoonShadow,
      camera: { camera: { position: cam }, handsBusy: false, setHeldWeapon: () => undefined, setPlaceholders: () => undefined } as unknown as CameraRig,
      cameraTarget: () => 999,
      lift: () => 0,
    });
    views.setCharacterModels(GAME);
    const car: CarPose = { act, t: 0, yaw: 0, seat: SEAT, floor: 0 };
    const seated: Transform = { position: { x: SEAT.x, y: 0, z: SEAT.z }, yaw: 0, pitch: 0, speed: 0, car };
    // The street's looks 0 and 2 are short-legged, 3 and 4 long-legged (the tallest seated before).
    const who: [number, CharacterDescriptor][] = [
      [1, { kind: "heroine" } as CharacterDescriptor],
      ...[0, 2, 3, 4].map((look): [number, CharacterDescriptor] => [100 + look, { kind: "npc", preset: "civilian", look } as CharacterDescriptor]),
    ];
    for (const [id, d] of who) views.spawn(id, d, seated);
    for (let i = 0; i < 6000 && views.modelCounts.loading > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
    for (let i = 0; i < 4; i++) views.update(1 / 30);
    for (const [id] of who) {
      const bone = (name: string) => scene.getTransformNodeByName(`e${id}-m-J_Bip_${name}`);
      expect(bone("C_Head"), `e${id} dressed`).not.toBeNull();
      const hips = (at(bone("L_UpperLeg")).y + at(bone("R_UpperLeg")).y) / 2;
      expect(hips, `e${id}'s hip joints`).toBeCloseTo(SEAT.y, 1);
      expect(at(bone("C_Head")).y, `e${id}'s head`).toBeLessThan(0.9);
    }
  });
});
