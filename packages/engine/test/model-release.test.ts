import type { EntityId, ViewDescriptor } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, type Scene, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { QUALITY_TIERS } from "../src/npr/quality";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";
import { donorFiles } from "../src/renderer/model-cast";
import { type CharacterModelManifest, toonSourceOf } from "../src/renderer/model-library";
import { MODEL_LINGER_S } from "../src/renderer/model-memory";
import { disposeModelScenes, fileGpuMiB, modelScene, readModelFile } from "./game-models";

/**
 * Letting go of character model files (ADR-0076 stage 4b): a file only named characters wear goes
 * once none of them is in the scene, the donors' and Seki's never do, a phone keeps no more files
 * than its limit, and a file let go of (or one that failed, G-562) loads again when needed.
 */

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;
const KUROSAWA: ViewDescriptor = { kind: "npc", preset: "fixer", cast: "kurosawa" };
/** The scene of a save at Kurosawa (ADR-0076 stage 4a): Seki, Kurosawa and Hana. */
const AT_KUROSAWA: readonly ViewDescriptor[] = [{ kind: "heroine" }, KUROSAWA, { kind: "npc", preset: "civilian", cast: "hana" }];

/**
 * Serves the game's files from disk (`?…` ignored) and notes what is asked; `hold` keeps files
 * back, `fail` fails their first fetch, `as` serves that one file under every name.
 */
const serve = (opts: { hold?: readonly string[]; fail?: readonly string[]; as?: string } = {}) => {
  const fetched: string[] = [];
  const held = new Map<string, () => void>();
  const failing = new Set(opts.fail ?? []);
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    if (failing.delete(url)) return Promise.reject(new Error(`${url}: offline`));
    const b = readModelFile(opts.as ?? url.split("?")[0]!);
    const answer = { ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) };
    if (!opts.hold?.includes(url)) return Promise.resolve(answer);
    return new Promise((ok) => held.set(url, () => ok(answer)));
  });
  return { fetched, release: (url: string) => held.get(url)?.(), times: (url: string) => fetched.filter((u) => u === url).length };
};

const viewsOn = (scene: Scene, modelFiles?: number) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
    ...(modelFiles !== undefined ? { modelFiles } : {}),
  });

const tick = () => new Promise((ok) => setTimeout(ok, 0));

const settled = async (views: CharacterViews) => {
  for (let i = 0; i < 4000 && views.loadingCount > 0; i++) await tick();
  expect(views.loadingCount).toBe(0);
};

const spawnAll = (views: CharacterViews, list: readonly ViewDescriptor[], from = 1) =>
  list.forEach((v, i) => views.spawn(from + i, v as Parameters<CharacterViews["spawn"]>[1], STAND));

/** Frames of game time, a second each (the files are looked over once a second). */
const seconds = (views: CharacterViews, s: number) => {
  for (let i = 0; i < s; i++) views.update(1);
};

const sorted = (list: readonly string[]) => [...list].sort();
const DONORS = sorted(donorFiles(GAME).map((f) => f.url));

/** Texture memory of the files in memory (RGBA8 with mips, as `model-textures.test.ts`). */
const memoryOf = (files: readonly string[]): number => files.reduce((sum, url) => sum + fileGpuMiB(url.split("?")[0]!), 0);

/**
 * What a character wears, file-independent: each drawn part's material name (preset, colour, flags)
 * with the texture id put back as "own" and the texture's name, so a reloaded file reads the same;
 * a donor's texture keeps its id, since donor files are never let go of.
 */
const outfitOf = (views: CharacterViews, id: EntityId): string[] => {
  let meshes: readonly AbstractMesh[] = [];
  views.scanTargets((who, _scan, list) => {
    if (who === id) meshes = list();
  });
  return meshes
    .filter((m) => m.getTotalVertices() > 0 && toonSourceOf(m)?.source.part)
    .map((m) => {
      const textures = (m.material as unknown as { getActiveTextures(): { name: string; uniqueId: number }[] }).getActiveTextures();
      const name = m.material?.name ?? "";
      const { part, texture } = toonSourceOf(m)!.source;
      const named = (t: { name: string; uniqueId: number }) => (t === texture ? `own ${t.name}` : `donor ${t.uniqueId} ${t.name}`);
      return `${part}:${textures.reduce((n, t) => n.replace(`:${t.uniqueId}`, `:${named(t)}`), name)}`;
    })
    .sort();
};

afterEach(() => {
  disposeModelScenes();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("letting go of character model files (ADR-0076 stage 4b)", () => {
  it("lets go of kurosawa.vrm a while after he left the scene, with its meshes and textures", async () => {
    const { times } = serve();
    const scene = modelScene();
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    spawnAll(views, AT_KUROSAWA);
    await Promise.all(views.modelLoading.start());
    await views.modelLoading.rest();
    await settled(views);
    expect(views.modelLoading.loaded()).toContain("kurosawa.vrm");
    const peak = memoryOf(views.modelLoading.loaded());
    const meshes = scene.meshes.length;
    const his = scene.meshes.filter((m) => m.name.startsWith("e2-m-") && m.material);
    const materials = new Set(his.map((m) => m.material!));
    const textures = new Set([...materials].flatMap((m) => m.getActiveTextures()));
    expect(textures.size).toBeGreaterThan(0);
    // Seki walks on into another district: the simulation streams Kurosawa out.
    views.despawn(2, false);
    seconds(views, MODEL_LINGER_S - 2);
    expect(views.modelLoading.loaded(), "a step back over the streaming edge finds him still in memory").toContain("kurosawa.vrm");
    seconds(views, 3);
    expect(views.modelLoading.loaded()).not.toContain("kurosawa.vrm");
    // His pooled model went with the file.
    expect(scene.meshes.filter((m) => m.name.startsWith("e2-m-"))).toHaveLength(0);
    expect(scene.meshes.length).toBeLessThan(meshes);
    // His toon materials and textures are freed; the donors' stay (`donorFiles`).
    for (const m of materials) expect(scene.materials.includes(m), m.name).toBe(false);
    for (const t of textures) expect(t.getInternalTexture() === null, t.name).toBe(true);
    const after = memoryOf(views.modelLoading.loaded());
    console.info(`[memory] after Kurosawa's scene: ${peak.toFixed(1)} MiB of model textures kept before stage 4b, ${after.toFixed(1)} MiB now`);
    expect(peak - after).toBeGreaterThan(30);
    // He comes back: the file loads again and dresses him.
    views.spawn(9, KUROSAWA, STAND);
    await settled(views);
    expect(times("kurosawa.vrm")).toBe(2);
    expect(views.dressedCount).toBe(3);
  });

  it("never lets go of Seki's file or the donors', not on a phone over its limit, nor behind a new scene", async () => {
    serve();
    const views = viewsOn(modelScene(), QUALITY_TIERS.low.modelFiles);
    views.setCharacterModels(GAME);
    spawnAll(views, AT_KUROSAWA);
    await Promise.all(views.modelLoading.start());
    await views.modelLoading.rest();
    await settled(views);
    expect(sorted(views.modelLoading.loaded())).toEqual(sorted([...DONORS, "kurosawa.vrm"]));
    views.clear();
    seconds(views, 3 * MODEL_LINGER_S);
    expect(sorted(views.modelLoading.loaded())).toEqual(DONORS);
    // A new game with nobody but Seki: the donors stay all the same.
    spawnAll(views, [{ kind: "heroine" }]);
    await Promise.all(views.modelLoading.start());
    expect(sorted(views.modelLoading.loaded())).toEqual(DONORS);
  });

  it("keeps no more files than a phone's limit: the longest unused goes first, at once", async () => {
    // Which file goes hangs on the names and the order they went unused, not on what they hold:
    // the lightest file under seven names, fourteen loads of the real ones overran CI's 20 s (G-620).
    serve({ as: "ganger.vrm" });
    // Named characters only, no donors but Seki's: six files a phone may let go of.
    const cast: CharacterModelManifest = {
      heroine: { url: "seki.vrm" },
      cast: { kurosawa: { url: "kurosawa.vrm" }, hana: { url: "mori.vrm" }, ume: { url: "base-female.vrm" }, kaito: { url: "kaito.vrm" }, tetsu: { url: "ganger.vrm" }, mei: { url: "civilian.vrm" } },
    };
    const people: readonly ViewDescriptor[] = [
      { kind: "heroine" },
      KUROSAWA,
      { kind: "npc", preset: "civilian", cast: "hana" },
      { kind: "npc", preset: "civilian", cast: "ume" },
      { kind: "npc", preset: "fixer", cast: "kaito" },
      { kind: "enemy", preset: "ganger", cast: "tetsu" },
      { kind: "npc", preset: "civilian", cast: "mei" },
    ];
    const at = async (modelFiles: number) => {
      const views = viewsOn(modelScene(), modelFiles);
      views.setCharacterModels(cast);
      spawnAll(views, people);
      await settled(views);
      expect(views.modelLoading.loaded()).toHaveLength(7);
      // Kurosawa leaves first, Hana a second later, Ume a second after her.
      for (const id of [2, 3, 4]) {
        views.despawn(id, false);
        seconds(views, 1);
      }
      return views;
    };
    const phone = await at(QUALITY_TIERS.low.modelFiles);
    // Seven files over a limit of five: the two unused longest went, Ume's waits out the linger.
    expect(sorted(phone.modelLoading.loaded())).toEqual(["base-female.vrm", "civilian.vrm", "ganger.vrm", "kaito.vrm", "seki.vrm"]);
    seconds(phone, MODEL_LINGER_S);
    expect(sorted(phone.modelLoading.loaded())).toEqual(["civilian.vrm", "ganger.vrm", "kaito.vrm", "seki.vrm"]);
    // Characters in the scene keep their files over the limit: nothing to let go of.
    expect(phone.dressedCount).toBe(4);
    const computer = await at(QUALITY_TIERS.high.modelFiles);
    expect(computer.modelLoading.loaded()).toHaveLength(7);
  });

  it("dresses a look the same after its file was let go of and loaded again", async () => {
    const { times } = serve();
    const views = viewsOn(modelScene());
    // Kurosawa in his own dress, and a man on his file with a donor's trousers (ADR-0076 §3).
    const borrower = { url: "kurosawa.vrm", variant: 150, dress: { bottomFrom: 0.99, topFrom: null } };
    views.setCharacterModels({ ...GAME, cast: { ...GAME.cast, tetsu: borrower } });
    const scene = [KUROSAWA, { kind: "enemy", preset: "ganger", cast: "tetsu", look: 7 }] as const satisfies readonly ViewDescriptor[];
    spawnAll(views, scene, 2);
    await views.modelLoading.rest();
    await settled(views);
    const before = [outfitOf(views, 2), outfitOf(views, 3)];
    expect(before[1]!.some((p) => p.startsWith("legs:") && p.includes(":donor ")), "his trousers are a donor's").toBe(true);
    expect(before[0]!.length).toBeGreaterThan(0);
    views.clear();
    seconds(views, MODEL_LINGER_S + 1);
    expect(views.modelLoading.loaded()).not.toContain("kurosawa.vrm");
    spawnAll(views, scene, 12);
    await settled(views);
    expect(times("kurosawa.vrm")).toBe(2);
    expect([outfitOf(views, 12), outfitOf(views, 13)]).toEqual(before);
  });

  it("loads a file again after its fetch failed (G-562)", async () => {
    const { times } = serve({ fail: ["kurosawa.vrm"] });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const views = viewsOn(modelScene());
    views.setCharacterModels(GAME);
    views.spawn(2, KUROSAWA, STAND);
    await settled(views);
    expect(views.dressedCount).toBe(0);
    // The network is back by the time he comes again.
    views.despawn(2, false);
    views.spawn(3, KUROSAWA, STAND);
    await settled(views);
    expect(times("kurosawa.vrm")).toBe(2);
    expect(views.dressedCount).toBe(1);
  });

  it("loads a save away from Kurosawa and back again, his file let go of behind the first loading screen", async () => {
    const { times, release } = serve({ hold: ["kurosawa.vrm"] });
    const scene = modelScene();
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    spawnAll(views, AT_KUROSAWA);
    const first = views.modelLoading.start();
    for (let i = 0; i < 20; i++) await tick();
    // A save loads while his file is still on its way: a new game's scene in Neon Koi.
    views.clear();
    spawnAll(views, [{ kind: "heroine" }, { kind: "npc", preset: "fixer", cast: "kaito", look: 3321198671 }], 10);
    const second = views.modelLoading.start();
    release("kurosawa.vrm");
    await Promise.all([...first, ...second]);
    await settled(views);
    expect(views.dressedCount).toBe(2);
    // His file came after the new scene's start; nobody wears it, so it goes after the linger.
    expect(views.modelLoading.loaded()).toContain("kurosawa.vrm");
    seconds(views, MODEL_LINGER_S + 1);
    expect(views.modelLoading.loaded()).not.toContain("kurosawa.vrm");
    expect(scene.meshes.filter((m) => m.name.startsWith("e2-m-"))).toHaveLength(0);
    // Back to the save at Kurosawa: his file loads again behind the loading screen.
    views.clear();
    spawnAll(views, AT_KUROSAWA, 20);
    const third = views.modelLoading.start();
    for (let i = 0; i < 20 && times("kurosawa.vrm") < 2; i++) await tick();
    release("kurosawa.vrm");
    await Promise.all(third);
    await settled(views);
    expect(times("kurosawa.vrm")).toBe(2);
    expect(views.dressedCount).toBe(3);
    // And a save away from him again: no linger behind a loading screen, the file goes at once.
    views.clear();
    spawnAll(views, [{ kind: "heroine" }], 30);
    await Promise.all(views.modelLoading.start());
    expect(views.modelLoading.loaded()).not.toContain("kurosawa.vrm");
  });
});
