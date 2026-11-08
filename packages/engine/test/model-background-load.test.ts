import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { EntityId, ViewDescriptor } from "@seki/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type AbstractMesh, Scene, type TransformNode, Vector3 } from "../src/babylon";
import type { CameraRig } from "../src/camera/camera-rig";
import type { MoonShadow } from "../src/npr/moon-shadow";
import { ToonMaterials } from "../src/npr/toon-material";
import { CharacterViews } from "../src/renderer/character-views";
import { type CharacterModelManifest, toonSourceOf } from "../src/renderer/model-library";
import { findHumanoidBones } from "../src/renderer/model-rig";
import { readModelFile } from "./game-models";

/**
 * Loading the character models in the background (ADR-0076 stage 4a, G-547): the loading screen
 * waits for the files of the scene round the start only, a character whose file is still on its
 * way stands as its procedural rig, and the variants borrow cloth from loaded files only.
 */

const STAND = { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, speed: 0 };
const GAME = JSON.parse(new TextDecoder().decode(readModelFile("manifest.json"))) as CharacterModelManifest;

/** The characters of a new game in Neon Koi, as the simulation spawns them (`packages/app/test/model-start.test.ts`). */
const NEW_GAME: readonly ViewDescriptor[] = [
  { kind: "heroine" },
  { kind: "npc", preset: "fixer", cast: "kaito", look: 3321198671 },
  { kind: "npc", preset: "civilian", cast: "ume", look: 735192838 },
  { kind: "npc", preset: "ripperdoc", cast: "mori", look: 4099232964 },
  { kind: "enemy", preset: "ganger", look: 2887494740 },
  { kind: "enemy", preset: "ganger", enforcer: true, look: 735142254 },
  { kind: "npc", preset: "civilian", umbrella: false, cast: "barman", look: 2345189966 },
  { kind: "npc", preset: "civilian", umbrella: false, cast: "koi-regular-1", look: 2608395669 },
  { kind: "npc", preset: "civilian", umbrella: false, cast: "koi-regular-2", look: 2558062812 },
];

/** Serves the game's files from disk and notes what is asked; `hold` keeps a file back until released. */
const serve = (hold: readonly string[] = []) => {
  const fetched: string[] = [];
  const held = new Map<string, () => void>();
  vi.stubGlobal("fetch", (url: string) => {
    fetched.push(url);
    const b = readModelFile(url);
    const answer = { ok: true, arrayBuffer: () => Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) };
    if (!hold.includes(url)) return Promise.resolve(answer);
    return new Promise((ok) => held.set(url, () => ok(answer)));
  });
  return { fetched, release: (url: string) => held.get(url)?.() };
};

const viewsOn = (scene: Scene) =>
  new CharacterViews({
    scene,
    materials: new ToonMaterials(scene),
    shadow: { addCaster: () => undefined } as unknown as MoonShadow,
    camera: { camera: { position: new Vector3(2, 1.6, 2) } } as unknown as CameraRig,
    cameraTarget: () => 1,
    lift: () => 0,
  });

const tick = () => new Promise((ok) => setTimeout(ok, 0));

const settled = async (views: CharacterViews) => {
  for (let i = 0; i < 4000 && views.loadingCount > 0; i++) await tick();
  expect(views.loadingCount).toBe(0);
};

const spawnAll = (views: CharacterViews, list: readonly ViewDescriptor[], from = 1) =>
  list.forEach((v, i) => views.spawn(from + i, v as Parameters<CharacterViews["spawn"]>[1], STAND));

const meshesOf = (views: CharacterViews, id: EntityId): AbstractMesh[] => {
  let out: readonly AbstractMesh[] = [];
  views.scanTargets((who, _scan, meshes) => {
    if (who === id) out = meshes();
  });
  return out.filter((m) => m.getTotalVertices() > 0);
};

/** The texture a character's part is drawn with, and the one its own file gave it. */
const texturesOf = (views: CharacterViews, id: EntityId, part: string) => {
  const m = meshesOf(views, id).find((x) => toonSourceOf(x)?.source.part === part)!;
  return { drawn: (m.material as unknown as { getActiveTextures(): unknown[] }).getActiveTextures(), own: toonSourceOf(m)!.source.texture };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("character models in the background (ADR-0076 stage 4a)", () => {
  it("loads the files of the start's scene behind the loading screen, not kurosawa.vrm nor the rest (G-547)", async () => {
    const { fetched } = serve();
    const views = viewsOn(new Scene(new NullEngine()));
    spawnAll(views, NEW_GAME);
    views.setCharacterModels(GAME);
    await Promise.all(views.modelLoading.start());
    await settled(views);
    expect(views.dressedCount).toBe(NEW_GAME.length);
    expect([...new Set(fetched)].sort()).toEqual(["base-female.vrm", "civilian.vrm", "ganger.vrm", "kaito.vrm", "seki.vrm"]);
    expect(fetched).not.toContain("kurosawa.vrm");
    // Every file once, though nine characters and their donors asked for them.
    expect(fetched).toHaveLength(new Set(fetched).size);
  });

  it("fetches the background roles' files after the start, one at a time, and Kurosawa's only when he comes", async () => {
    const { fetched } = serve();
    const views = viewsOn(new Scene(new NullEngine()));
    spawnAll(views, NEW_GAME);
    views.setCharacterModels(GAME);
    await Promise.all(views.modelLoading.start());
    await views.modelLoading.rest();
    expect(fetched).toContain("mori.vrm");
    expect(fetched).not.toContain("kurosawa.vrm");
    views.spawn(20, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    await settled(views);
    expect(fetched.filter((u) => u === "kurosawa.vrm")).toHaveLength(1);
    expect(views.dressedCount).toBe(NEW_GAME.length + 1);
  });

  it("stands a character whose file is on its way as its rig, then swaps the model in, posed as the rig", async () => {
    const { release } = serve(["kurosawa.vrm"]);
    const scene = new Scene(new NullEngine());
    const views = viewsOn(scene);
    views.setCharacterModels(GAME);
    views.spawn(3, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    // A step into a walk: the swap must not drop him back into the file's T-pose.
    views.move(3, { ...STAND, speed: 1.6 });
    for (let i = 0; i < 10; i++) views.update(1 / 30);
    for (let i = 0; i < 50; i++) await tick();
    const rig = views.rigOf(3)!;
    expect(views.loadingCount).toBe(1);
    expect(views.dressedCount).toBe(0);
    expect(rig.meshes.every((m) => m.isEnabled(false))).toBe(true);
    release("kurosawa.vrm");
    await settled(views);
    expect(views.dressedCount).toBe(1);
    expect(rig.meshes.some((m) => m.isEnabled(false))).toBe(false);
    const bones = findHumanoidBones(scene.transformNodes.filter((n) => n.name.startsWith("e3-m-")) as TransformNode[], "e3-m-");
    const along = (from: TransformNode, to: TransformNode) => to.getAbsolutePosition().subtract(from.getAbsolutePosition()).normalize();
    // Before any frame after the swap: the arms hang (VRoid files are in T-pose) and the thighs swing as the rig's.
    for (const side of ["L", "R"] as const) expect(along(bones[`upperArm${side}`]!, bones[`lowerArm${side}`]!).y).toBeLessThan(-0.8);
    rig.root.computeWorldMatrix(true);
    const thighOfRig = along(rig.legL, rig.kneeL);
    const thighOfModel = along(bones.upperLegL!, bones.lowerLegL!);
    expect(Vector3.Dot(thighOfRig, thighOfModel)).toBeGreaterThan(0.97);
  });

  it("borrows cloth from the loaded files only, and counts the donors again once another loads", async () => {
    serve();
    const views = viewsOn(new Scene(new NullEngine()));
    // Base_Male with the last donor's trousers: of the loaded M00 files, sorted by name.
    const borrower = { url: "ganger.vrm", variant: 150, dress: { bottomFrom: 0.99, topFrom: null } };
    views.setCharacterModels({ ...GAME, cast: { ...GAME.cast, tetsu: borrower } });
    views.spawn(1, { kind: "heroine" }, STAND);
    views.spawn(2, { kind: "npc", preset: "fixer", cast: "kaito" }, STAND);
    views.spawn(3, { kind: "enemy", preset: "ganger", cast: "tetsu" }, STAND);
    await settled(views);
    // Kaito's are the only other M00 trousers loaded: kurosawa.vrm is not fetched for its cloth.
    expect(texturesOf(views, 3, "legs").drawn).toContain(texturesOf(views, 2, "legs").own);
    views.spawn(4, { kind: "npc", preset: "fixer", cast: "kurosawa" }, STAND);
    await settled(views);
    views.spawn(5, { kind: "enemy", preset: "ganger", cast: "tetsu" }, STAND);
    await settled(views);
    expect(texturesOf(views, 5, "legs").drawn).toContain(texturesOf(views, 4, "legs").own);
    // The one dressed before keeps what it wore.
    expect(texturesOf(views, 3, "legs").drawn).toContain(texturesOf(views, 2, "legs").own);
  });

  it("dresses a loaded game's scene while the old one's files still load in the background", async () => {
    const { fetched, release } = serve(["mori.vrm"]);
    const views = viewsOn(new Scene(new NullEngine()));
    spawnAll(views, NEW_GAME);
    views.setCharacterModels(GAME);
    await Promise.all(views.modelLoading.start());
    await settled(views);
    const prefetch = views.modelLoading.rest();
    for (let i = 0; i < 20; i++) await tick();
    expect(fetched).toContain("mori.vrm");
    // A save loads (ADR-0057): the scene goes, the save's scene comes in behind a new loading screen.
    views.clear();
    spawnAll(views, [{ kind: "heroine" }, { kind: "npc", preset: "fixer", cast: "kurosawa" }, { kind: "npc", preset: "civilian", cast: "hana" }], 30);
    const start = views.modelLoading.start();
    expect(start).toHaveLength(3);
    release("mori.vrm");
    await Promise.all(start);
    await prefetch;
    await settled(views);
    expect(views.dressedCount).toBe(3);
    expect(fetched).toHaveLength(new Set(fetched).size);
  });
});
