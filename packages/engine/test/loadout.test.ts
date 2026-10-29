import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor } from "@seki/core";
import { describe, expect, it } from "vitest";
import { type AbstractMesh, MeshBuilder, Scene, type Texture, type TransformNode } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildHeroine, setWeaponDrawn } from "../src/renderer/characters";
import { GARMENT_TINT, Loadouts, rigTintOf } from "../src/renderer/loadout";
import { skinParts } from "../src/renderer/character-skin";
import { VertexBuffer } from "../src/babylon";
import { PRESETS } from "../src/npr/presets";
import { ModelLibrary, type ToonSource, readSourceMaterial } from "../src/renderer/model-library";
import { HumanoidRetarget } from "../src/renderer/model-rig";
import { WeaponMounts } from "../src/renderer/weapon-mount";
import { tPose } from "./t-pose";

const look = (over: Partial<AppearanceDescriptor["weapons"]> = {}, garments: AppearanceDescriptor["garments"] = {}): AppearanceDescriptor => ({
  weapons: { primary: "rifle", secondary: "pistol", melee: null, active: "secondary", ...over },
  garments,
  implants: [],
});

const HELMET: AppearanceDescriptor["garments"] = { head: { attachments: [{ point: "head", mesh: "helmet" }] }, torso: { tint: "vest", attachments: [{ point: "chest", mesh: "vest-plate" }] } };

describe("Loadouts", () => {
  // No weapon models: every weapon is the plain fallback shape, mounted synchronously.
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const added: string[] = [];
    const loadouts = new Loadouts(scene, materials, new WeaponMounts(new ModelLibrary(scene, materials)), (ms) => added.push(...ms.map((m) => m.name)));
    const rig = buildHeroine(scene, materials, "hero");
    return { scene, materials, loadouts, rig, added };
  };
  const enabled = (scene: Scene, part: string) => scene.transformNodes.filter((n) => n.name.startsWith(`hero-${part}-`) && n.isEnabled()).map((n) => n.name);
  const settle = (rig: ReturnType<typeof buildHeroine>, drawn: boolean) => {
    setWeaponDrawn(rig, drawn);
    rig.drawn = drawn ? 1 : 0;
  };
  /** A T-pose model over the rig with a VRoid "Tops" and "Bottoms" cloth mesh. */
  const model = (scene: Scene, materials: ToonMaterials, rig: ReturnType<typeof buildHeroine>) => {
    const { root, bone } = tPose(scene, "m-");
    const retarget = HumanoidRetarget.create(rig, root, "m-")!;
    const texture = { uniqueId: 9001 } as unknown as Texture;
    const cloth = (name: string): AbstractMesh => {
      const source = readSourceMaterial({ name, albedoTexture: texture });
      const mesh = MeshBuilder.CreateBox(name, { size: 0.1 }, scene);
      mesh.material = materials.forImported(source.base, texture, "importedCharacter", source);
      const toonSource: ToonSource = { preset: "importedCharacter", source };
      mesh.metadata = { toonSource };
      return mesh;
    };
    const meshes = [cloth("F00_001_01_Tops_01_CLOTH"), cloth("F00_001_01_Bottoms_01_CLOTH"), cloth("F00_000_Hair_00_HAIR")];
    return { dressed: { retarget, meshes }, bone, meshes };
  };
  const modelNodes = (scene: Scene) => scene.transformNodes.filter((n) => n.name.startsWith("hero-bone-")).map((n) => n.name);
  const parentOf = (scene: Scene, name: string) => (scene.getMeshByName(name)?.parent as TransformNode | null)?.name;

  it("holsters the sidearm and slings the long gun while nothing is drawn", () => {
    const { scene, loadouts, rig, added } = setup();
    loadouts.set(rig, look(), "hero");
    settle(rig, false);
    loadouts.update(rig);
    expect(enabled(scene, "hand")).toEqual([]);
    expect(enabled(scene, "hip")).toEqual(["hero-hip-pistol"]);
    expect(enabled(scene, "back")).toEqual(["hero-back-rifle"]);
    expect(added.length).toBeGreaterThan(0);
    // The procedural rig's own box pistol is gone once a look arrives.
    for (const box of rig.gunBoxes) expect(box.scaling.x).toBe(0);
  });

  it("moves the active weapon into the hand, or the model's hand when dressed", () => {
    const { scene, materials, loadouts, rig } = setup();
    loadouts.set(rig, look(), "hero");
    settle(rig, true);
    loadouts.update(rig);
    expect(enabled(scene, "hand")).toEqual(["hero-hand-pistol"]);
    expect(enabled(scene, "hip")).toEqual([]);
    expect(enabled(scene, "back")).toEqual(["hero-back-rifle"]);

    loadouts.set(rig, look({ active: "primary" }), "hero");
    loadouts.update(rig);
    expect(enabled(scene, "hand")).toEqual(["hero-hand-rifle"]);
    // The holster is its own node: the rig folds its gunHip bone away while drawn.
    expect(enabled(scene, "hip")).toEqual(["hero-hip-pistol"]);
    expect(scene.getTransformNodeByName("hero-hip-pistol")!.parent).not.toBe(rig.gunHip);
    expect(enabled(scene, "back")).toEqual([]);

    loadouts.setModel(rig, model(scene, materials, rig).dressed);
    loadouts.update(rig);
    expect(enabled(scene, "hand")).toEqual([]);
    expect(enabled(scene, "model")).toEqual(["hero-model-rifle"]);
  });

  it("carries the melee weapon on the left hip until it is drawn", () => {
    const { scene, loadouts, rig } = setup();
    loadouts.set(rig, look({ melee: "baton" }), "hero");
    settle(rig, true);
    loadouts.update(rig);
    expect(enabled(scene, "hipL")).toEqual(["hero-hipL-baton"]);
    loadouts.set(rig, look({ melee: "baton", active: "melee" }), "hero");
    loadouts.update(rig);
    expect(enabled(scene, "hipL")).toEqual([]);
    expect(enabled(scene, "hand")).toEqual(["hero-hand-baton"]);
  });

  it("keeps a model that arrives before the first look", () => {
    const { scene, materials, loadouts, rig } = setup();
    loadouts.setModel(rig, model(scene, materials, rig).dressed);
    loadouts.set(rig, look({}, HELMET), "hero");
    settle(rig, true);
    loadouts.update(rig);
    expect(enabled(scene, "model")).toEqual(["hero-model-pistol"]);
    expect(loadouts.attachments(rig)).toEqual([
      { id: "helmet", onModel: true },
      { id: "vest-plate", onModel: true },
    ]);
  });

  it("puts garment add-ons on the rig's head and body while undressed", () => {
    const { scene, loadouts, rig } = setup();
    loadouts.set(rig, look({}, { ...HELMET, head: { attachments: [{ point: "eyes", mesh: "visor" }] } }), "hero");
    expect(loadouts.attachments(rig)).toEqual([
      { id: "visor", onModel: false },
      { id: "vest-plate", onModel: false },
    ]);
    expect(scene.getMeshByName("hero-visor")!.parent).toBe(rig.head);
    expect(scene.getMeshByName("hero-vest-plate")!.parent).toBe(rig.body);
    // The visor's arc bulges forward, in front of the face.
    const visor = scene.getMeshByName("hero-visor")!;
    visor.refreshBoundingInfo({});
    const box = visor.getBoundingInfo().boundingBox;
    expect(box.maximum.z).toBeGreaterThan(0.08);
    expect(box.minimum.z).toBeGreaterThan(-0.05);
    loadouts.set(rig, look(), "hero");
    expect(scene.getMeshByName("hero-visor")).toBeNull();
    expect(loadouts.attachments(rig)).toEqual([]);
  });

  it("moves garment add-ons to the model's head and chest bones and back when it comes off", () => {
    const { scene, materials, loadouts, rig } = setup();
    loadouts.set(rig, look({}, HELMET), "hero");
    expect(scene.getMeshByName("hero-helmet")!.parent).toBe(rig.head);
    const m = model(scene, materials, rig);
    loadouts.setModel(rig, m.dressed);
    expect(loadouts.attachments(rig).every((a) => a.onModel)).toBe(true);
    expect(parentOf(scene, "hero-helmet")).toBe("hero-bone-head");
    expect(parentOf(scene, "hero-vest-plate")).toBe("hero-bone-chest");
    expect(scene.getTransformNodeByName("hero-bone-head")!.parent).toBe(m.bone("J_Bip_C_Head"));
    expect(scene.getTransformNodeByName("hero-bone-chest")!.parent).toBe(m.bone("J_Bip_C_Chest"));
    // Seated above the head bone, whatever the model's own frame (here mirrored and turned).
    const helmet = scene.getMeshByName("hero-helmet")!;
    helmet.computeWorldMatrix(true);
    expect(helmet.getAbsolutePosition().y).toBeGreaterThan(m.bone("J_Bip_C_Head").getAbsolutePosition().y + 0.05);

    loadouts.setModel(rig, null);
    expect(modelNodes(scene)).toEqual([]);
    expect(scene.getMeshByName("hero-helmet")!.parent).toBe(rig.head);
    expect(loadouts.attachments(rig).some((a) => a.onModel)).toBe(false);
  });

  it("tints the model's cloth by the torso and legs garments and gives the colours back", () => {
    const { scene, materials, loadouts, rig } = setup();
    const m = model(scene, materials, rig);
    const [tops, bottoms, hair] = m.meshes as [AbstractMesh, AbstractMesh, AbstractMesh];
    const own = m.meshes.map((x) => x.material);
    loadouts.set(rig, look({}, { torso: { tint: "jacket-hebi" }, legs: { tint: "kevlar" } }), "hero");
    loadouts.setModel(rig, m.dressed);
    expect(loadouts.tinted(rig)).toBe(2);
    expect(tops.material!.name).toContain(GARMENT_TINT["jacket-hebi"]!);
    expect(tops.material!.name).toContain(":tint");
    expect(bottoms.material!.name).toContain(GARMENT_TINT.kevlar!);
    expect(hair.material).toBe(own[2]);
    // Seki's own jacket keeps the model's colours; trousers stay tinted.
    loadouts.set(rig, look({}, { torso: { tint: "jacket-seki" }, legs: { tint: "kevlar" } }), "hero");
    expect(tops.material).toBe(own[0]);
    expect(loadouts.tinted(rig)).toBe(1);
    loadouts.setModel(rig, null);
    expect(m.meshes.map((x) => x.material)).toEqual(own);
  });

  it("drops everything on dispose, including what hung on the model", () => {
    const { scene, materials, loadouts, rig } = setup();
    const m = model(scene, materials, rig);
    const own = m.meshes.map((x) => x.material);
    loadouts.set(rig, look({}, { ...HELMET, torso: { tint: "jacket-hebi", attachments: [{ point: "chest", mesh: "vest-plate" }] } }), "hero");
    loadouts.setModel(rig, m.dressed);
    loadouts.dispose(rig);
    expect(loadouts.has(rig)).toBe(false);
    expect(scene.getMeshByName("hero-helmet")).toBeNull();
    expect(scene.getMeshByName("hero-vest-plate")).toBeNull();
    expect(modelNodes(scene)).toEqual([]);
    expect(m.meshes.map((x) => x.material)).toEqual(own);
    expect(scene.transformNodes.filter((n) => n.name.startsWith("hero-hip") || n.name.startsWith("hero-holster") || n.name === "hero-back" || n.name === "hero-sling")).toEqual([]);
  });

  it("shows optics and arm implants on the rig, then on the model's head and hand", () => {
    const { scene, materials, loadouts, rig } = setup();
    loadouts.set(rig, { ...look(), implants: ["optics", "arms"] }, "hero");
    expect(parentOf(scene, "hero-optics1")).toBe(rig.head.name);
    expect(parentOf(scene, "hero-cyberarm0")).toBe(rig.elbowR.name);
    loadouts.setModel(rig, model(scene, materials, rig).dressed);
    expect(parentOf(scene, "hero-optics-1")).toBe("hero-bone-head");
    expect(parentOf(scene, "hero-cyberarm1")).toBe("hero-bone-hand");
    loadouts.set(rig, look(), "hero");
    expect(scene.getMeshByName("hero-optics1")).toBeNull();
    expect(scene.getMeshByName("hero-cyberarm0")).toBeNull();
  });

  it("moves holsters and the sling by the model's size and back when it comes off", () => {
    const { scene, materials, loadouts, rig } = setup();
    loadouts.set(rig, look(), "hero");
    const holster = scene.getTransformNodeByName("hero-holsterR")!;
    const sling = scene.getTransformNodeByName("hero-sling")!;
    const [h0, s0] = [holster.position.clone(), sling.position.clone()];
    const m = model(scene, materials, rig);
    loadouts.setModel(rig, m.dressed);
    const fit = Math.min(1.25, Math.max(0.8, m.dressed.retarget.headHeight / rig.head.position.y));
    expect(holster.position.y).toBeCloseTo(h0.y * fit, 5);
    expect(sling.position.y).toBeCloseTo(s0.y * fit, 5);
    loadouts.setModel(rig, null);
    expect(holster.position.y).toBeCloseTo(h0.y, 5);
    expect(sling.position.z).toBeCloseTo(s0.z, 5);
  });

  it("forgets a waiting model on dispose", () => {
    const { scene, materials, loadouts, rig } = setup();
    loadouts.setModel(rig, model(scene, materials, rig).dressed);
    loadouts.dispose(rig);
    loadouts.set(rig, look(), "hero");
    expect(modelNodes(scene)).toEqual([]);
  });

  /** Colour of the first vertex of the rig's part with `preset`, as hex. */
  const partColor = (rig: ReturnType<typeof buildHeroine>, preset: string): string | null => {
    for (const mesh of rig.meshes) {
      const part = skinParts(mesh).find((p) => p.preset === preset);
      const data = mesh.getVerticesData(VertexBuffer.ColorKind);
      if (!part || !data) continue;
      const i = part.start * 4;
      const h = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
      return "#" + h(data[i]!) + h(data[i + 1]!) + h(data[i + 2]!);
    }
    return null;
  };

  it("dresses the procedural rig in the garment tints too: a disguise reads without models (ADR-0036)", () => {
    const { loadouts, rig } = setup();
    expect(partColor(rig, "sekiTop")).toBe(PRESETS.sekiTop.base);
    // Hebi's jacket over the top, Tessen's uniform: the cloth takes the tint, skin and hair do not.
    loadouts.set(rig, look({}, { torso: { tint: "jacket-hebi" } }), "hero");
    expect(partColor(rig, "sekiTop")).toBe(GARMENT_TINT["jacket-hebi"]);
    expect(partColor(rig, "sekiPants")).toBe(PRESETS.sekiPants.base);
    expect(partColor(rig, "skin")).toBe(PRESETS.skin.base);
    loadouts.set(rig, look({}, { torso: { tint: "jacket-tessen", attachments: [{ point: "chest", mesh: "vest-plate" }] }, legs: { tint: "kevlar" } }), "hero");
    expect(partColor(rig, "sekiTop")).toBe(GARMENT_TINT["jacket-tessen"]);
    expect(partColor(rig, "sekiPants")).toBe(GARMENT_TINT.kevlar);
    expect(loadouts.attachments(rig).map((a) => a.id)).toEqual(["vest-plate"]);
    // Seki's own jacket keeps her colours.
    loadouts.set(rig, look({}, { torso: { tint: "jacket-seki" } }), "hero");
    expect(partColor(rig, "sekiTop")).toBe(PRESETS.sekiTop.base);
    expect(partColor(rig, "sekiPants")).toBe(PRESETS.sekiPants.base);
  });

  it("maps cloth presets to garment slots", () => {
    const hebi = look({}, { torso: { tint: "jacket-hebi" }, legs: { tint: "kevlar" } });
    expect(rigTintOf(hebi, "gangerHood")).toBe(GARMENT_TINT["jacket-hebi"]);
    expect(rigTintOf(hebi, "fixerPants")).toBe(GARMENT_TINT.kevlar);
    expect(rigTintOf(hebi, "skin")).toBeNull();
    expect(rigTintOf(look(), "sekiTop")).toBeNull();
  });
});
