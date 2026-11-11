import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { CastKey, EntityId } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";
import { type CharacterModelManifest, toonSourceOf } from "../src/renderer/model-library";
import { readModelFile, serveModels } from "./game-models";

/**
 * The files the named characters' tops and trousers come from (ADR-0076 stage 4a, G-575): a dress
 * without `topFrom`/`bottomFrom` takes them from its variant's seed, so it borrows from the fixed
 * donor set (`donorFiles`), whatever has loaded.
 */

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
type Spawned = Parameters<CharacterViews["spawn"]>[1];

/** One character per file wearing its own look: the textures of its top and trousers name the file. */
const OWNERS: readonly [string, Spawned][] = [
  ["seki.vrm", { kind: "heroine" }],
  ["kaito.vrm", { kind: "npc", preset: "fixer", cast: "kaito" }],
  ["ganger.vrm", { kind: "enemy", preset: "ganger" }],
  ["civilian.vrm", { kind: "npc", preset: "civilian" }],
  ["mori.vrm", { kind: "npc", preset: "civilian", cast: "hana" }],
  ["base-female.vrm", { kind: "npc", preset: "civilian", cast: "ume" }],
  ["kurosawa.vrm", { kind: "npc", preset: "fixer", cast: "kurosawa" }],
];

const viewsOn = (scene: Scene) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
  });

const settled = async (views: CharacterViews) => {
  for (let i = 0; i < 4000 && views.loadingCount > 0; i++) await new Promise((ok) => setTimeout(ok, 0));
  expect(views.loadingCount).toBe(0);
};

const meshOf = (views: CharacterViews, id: EntityId, part: string): AbstractMesh | undefined => {
  let out: readonly AbstractMesh[] = [];
  views.scanTargets((who, _scan, meshes) => {
    if (who === id) out = meshes();
  });
  return out.find((m) => m.getTotalVertices() > 0 && toonSourceOf(m)?.source.part === part);
};

const idOf = (t: unknown): number => (t as { uniqueId: number }).uniqueId;

/** The named characters `cast` in a scene with every file's owner: the file each one's top and trousers come from. */
const donorsOfCast = async (cast: readonly CastKey[]): Promise<Record<string, { top: string; legs: string }>> => {
  serveModels();
  const views = viewsOn(new Scene(new NullEngine()));
  views.setCharacterModels(GAME);
  // Named ones first: the owners' files load after, so a donor set counted from what has loaded would miss them.
  cast.forEach((key, i) => views.spawn(100 + i, { kind: "npc", preset: "civilian", umbrella: false, cast: key }, STAND));
  await settled(views);
  OWNERS.forEach(([, view], i) => views.spawn(1 + i, view, STAND));
  await settled(views);
  const fileOf = (id: EntityId, part: string): string => {
    const m = meshOf(views, id, part);
    if (!m) return "none";
    const own = idOf(toonSourceOf(m)!.source.texture);
    const drawn = (m.material as unknown as { getActiveTextures(): unknown[] }).getActiveTextures().map(idOf);
    if (drawn.includes(own)) return "own";
    const owner = OWNERS.findIndex((_, i) => {
      const o = meshOf(views, 1 + i, part);
      return o !== undefined && drawn.includes(idOf(toonSourceOf(o)!.source.texture));
    });
    return owner < 0 ? "?" : OWNERS[owner]![0];
  };
  return Object.fromEntries(cast.map((key, i) => [key, { top: fileOf(100 + i, "torso"), legs: fileOf(100 + i, "legs") }]));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("named characters' borrowed cloth (ADR-0076 stage 4a, G-575)", () => {
  it("dresses Neon Koi's barman and regulars from fixed donor files, Kurosawa's never among them", async () => {
    expect(await donorsOfCast(["barman", "koi-regular-1", "koi-regular-2"])).toEqual({
      barman: { top: "own", legs: "kaito.vrm" },
      "koi-regular-1": { top: "ganger.vrm", legs: "own" },
      "koi-regular-2": { top: "base-female.vrm", legs: "base-female.vrm" },
    });
  });
});
