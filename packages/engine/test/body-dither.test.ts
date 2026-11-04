import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { ditherOf, fadeFigure } from "../src/npr/body-dither";
import { ToonMaterials } from "../src/npr/toon-material";
import { buildHeroine } from "../src/renderer/characters";

describe("halftone fade of the player's figure (G-275)", () => {
  it("fades every mesh of the figure and takes the outline off while faded, then restores both", () => {
    const scene = new Scene(new NullEngine());
    const materials = new ToonMaterials(scene);
    const figure = buildHeroine(scene, materials, "player");
    const other = buildHeroine(scene, materials, "npc");
    const outlined = figure.meshes.filter((m) => m.renderOutline);
    expect(outlined.length).toBeGreaterThan(0);
    fadeFigure(figure.root, 0.6);
    for (const m of figure.root.getChildMeshes(false)) expect(ditherOf(m)).toBeCloseTo(0.6);
    for (const m of outlined) expect(m.renderOutline).toBe(false);
    // The same shared materials draw everyone else solid.
    for (const m of other.root.getChildMeshes(false)) expect(ditherOf(m)).toBe(0);
    expect(other.meshes.some((m) => m.renderOutline)).toBe(true);
    fadeFigure(figure.root, 0);
    for (const m of figure.root.getChildMeshes(false)) expect(ditherOf(m)).toBe(0);
    for (const m of outlined) expect(m.renderOutline).toBe(true);
  });

  it("is a uniform of every toon material, set per mesh as it is drawn", () => {
    const scene = new Scene(new NullEngine());
    const m = new ToonMaterials(scene).get("cyberIvory");
    expect(m.options.uniforms).toContain("dither");
    expect(m.onBindObservable.hasObservers()).toBe(true);
  });
});
