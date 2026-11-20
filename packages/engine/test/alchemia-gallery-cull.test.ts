import { describe, expect, it } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { ALCHEMIA_LIFT_MECHANISM, ALCHEMIA_LIFT_NE_MECHANISM } from "@seki/sim";
import { Scene, TransformNode, Vector3 } from "../src/babylon";
import { AlchemiaGalleryCull, GALLERY_DRAW, inAlchemiaGallery } from "../src/renderer/alchemia/gallery-cull";

/**
 * The gallery's lifts' gates and platforms over P0 (ADR-0093 O1) are hidden while the eye is down in
 * P-2: from its store the frustum took them up the shaft through the slabs and the ground.
 */
describe("Alchemia's gallery's moving meshes hidden from P-2 (ADR-0093 O1)", () => {
  it("counts the lifts' gates over P0 as the gallery's, not the hall's or P-2's", () => {
    const gates = [...ALCHEMIA_LIFT_MECHANISM, ...ALCHEMIA_LIFT_NE_MECHANISM].filter((p) => p.mechanism?.kind === "gate");
    expect(gates.filter((g) => inAlchemiaGallery(g.center)).length).toBe(4 + 4);
    expect(inAlchemiaGallery({ x: 413.5, y: -5.2, z: 35 })).toBe(false);
  });

  it("hides them from P-2's store and shows them again from T1", () => {
    const scene = new Scene(new NullEngine());
    const cull = new AlchemiaGalleryCull();
    const node = new TransformNode("gate", scene);
    cull.track(1, node, new Vector3(413.5, 3.45, 34.85));
    const below = new TransformNode("hall", scene);
    cull.track(2, below, new Vector3(413.5, -5.25, 34.85));
    expect(cull.size).toBe(1);
    cull.update(new Vector3(413.5, -7.6, 8));
    expect(node.isEnabled(false)).toBe(false);
    expect(below.isEnabled(false)).toBe(true);
    cull.update(new Vector3(418, -4.8, 78));
    expect(node.isEnabled(false)).toBe(true);
  });

  it("hides them from afar too (Zielona's building site, some 180 m west), shows them within reach of the gallery's walls", () => {
    const scene = new Scene(new NullEngine());
    const cull = new AlchemiaGalleryCull();
    const node = new TransformNode("gate", scene);
    cull.track(1, node, new Vector3(413.5, 3.45, 34.85));
    cull.update(new Vector3(238.8, 2, -6.5));
    expect(node.isEnabled(false)).toBe(false);
    cull.update(new Vector3(400 - GALLERY_DRAW + 1, 0, 45));
    expect(node.isEnabled(false)).toBe(true);
    cull.update(new Vector3(400 - GALLERY_DRAW - 1, 0, 45));
    expect(node.isEnabled(false)).toBe(false);
  });
});
