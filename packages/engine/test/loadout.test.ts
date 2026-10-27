import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { AppearanceDescriptor } from "@seki/core";
import { describe, expect, it } from "vitest";
import { Scene, TransformNode } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildHeroine, setWeaponDrawn } from "../src/renderer/characters";
import { Loadouts } from "../src/renderer/loadout";
import { ModelLibrary } from "../src/renderer/model-library";
import { WeaponMounts } from "../src/renderer/weapon-mount";

const look = (over: Partial<AppearanceDescriptor["weapons"]> = {}, garments: AppearanceDescriptor["garments"] = {}): AppearanceDescriptor => ({
  weapons: { primary: "rifle", secondary: "pistol", melee: null, active: "secondary", ...over },
  garments,
  implants: [],
});

describe("Loadouts", () => {
  // No weapon models: every weapon is the plain fallback shape, mounted synchronously.
  const setup = () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const added: string[] = [];
    const loadouts = new Loadouts(scene, materials, new WeaponMounts(new ModelLibrary(scene, materials)), (ms) => added.push(...ms.map((m) => m.name)));
    const rig = buildHeroine(scene, materials, "hero");
    return { scene, loadouts, rig, added };
  };
  const enabled = (scene: Scene, part: string) => scene.transformNodes.filter((n) => n.name.startsWith(`hero-${part}-`) && n.isEnabled()).map((n) => n.name);
  const settle = (rig: ReturnType<typeof buildHeroine>, drawn: boolean) => {
    setWeaponDrawn(rig, drawn);
    rig.drawn = drawn ? 1 : 0;
  };

  it("holsters the sidearm and slings the long gun while nothing is drawn", () => {
    const { scene, loadouts, rig, added } = setup();
    loadouts.set(rig, look(), "hero");
    settle(rig, false);
    loadouts.update(rig, false);
    expect(enabled(scene, "hand")).toEqual([]);
    expect(enabled(scene, "hip")).toEqual(["hero-hip-pistol"]);
    expect(enabled(scene, "back")).toEqual(["hero-back-rifle"]);
    expect(added.length).toBeGreaterThan(0);
    // The procedural rig's own box pistol is gone once a look arrives.
    for (const box of rig.gunBoxes) expect(box.scaling.x).toBe(0);
  });

  it("moves the active weapon into the hand, or the model's hand when dressed", () => {
    const { scene, loadouts, rig } = setup();
    loadouts.set(rig, look(), "hero");
    settle(rig, true);
    loadouts.update(rig, false);
    expect(enabled(scene, "hand")).toEqual(["hero-hand-pistol"]);
    expect(enabled(scene, "hip")).toEqual([]);
    expect(enabled(scene, "back")).toEqual(["hero-back-rifle"]);

    loadouts.set(rig, look({ active: "primary" }), "hero");
    loadouts.update(rig, false);
    expect(enabled(scene, "hand")).toEqual(["hero-hand-rifle"]);
    expect(enabled(scene, "hip")).toEqual(["hero-hip-pistol"]);
    expect(enabled(scene, "back")).toEqual([]);

    loadouts.setModelHand(rig, new TransformNode("model-hand", scene), "hero");
    loadouts.update(rig, true);
    expect(enabled(scene, "hand")).toEqual([]);
    expect(enabled(scene, "model")).toEqual(["hero-model-rifle"]);
  });

  it("keeps a model hand that arrives before the first look", () => {
    const { scene, loadouts, rig } = setup();
    loadouts.setModelHand(rig, new TransformNode("model-hand", scene), "hero");
    loadouts.set(rig, look(), "hero");
    settle(rig, true);
    loadouts.update(rig, true);
    expect(enabled(scene, "model")).toEqual(["hero-model-pistol"]);
  });

  it("adds garment attachments and drops everything on dispose", () => {
    const { scene, loadouts, rig } = setup();
    loadouts.set(rig, look({}, { head: { attachments: [{ point: "head", mesh: "helmet" }] } }), "hero");
    expect(scene.getMeshByName("hero-helmet")).not.toBeNull();
    loadouts.set(rig, look(), "hero");
    expect(scene.getMeshByName("hero-helmet")).toBeNull();
    loadouts.dispose(rig);
    expect(loadouts.has(rig)).toBe(false);
    expect(scene.transformNodes.filter((n) => n.name.startsWith("hero-hip-") || n.name === "hero-back" || n.name === "hero-sling")).toEqual([]);
  });
});
