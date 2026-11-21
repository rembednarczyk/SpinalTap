import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { type CarPose, type Transform, driverSeat, vehicleSpec } from "@seki/core";
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
 * left a long-legged model's hips up to 0.35 m over it and its head through the roof. Its own hip
 * joints go on the seat now, whatever its legs, and its head stays under the roof: the sports car's
 * close-up has it 1.05 m over the ground above the seat, and the head reaches some 0.23 m over its
 * joint (`C_Head`), so the joint stays under 0.78 m (user's notes of 21.11: at the seat of 0.26 m the
 * heroine's joint was at 0.85 m, her head through the roof).
 */

const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
// The game's seat (`driverSeat`): its height is what keeps the head under the roof.
const SEAT = { x: -0.38, y: driverSeat(vehicleSpec("hatchback")).y, z: -0.36 };
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
      expect(at(bone("C_Head")).y, `e${id}'s head`).toBeLessThan(0.78);
    }
  });
});
