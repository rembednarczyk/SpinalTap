import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { DISTRICT_M0_PROPS, PLAC_LITEWSKI_DETAIL, ROOM_DETAIL_SCENERY, WRECK_BODY, WRECK_FOOT, inBuilding } from "../src";
import { WORLD_STREET_PROPS } from "../src/content/street-props";
import { surfaceY } from "../src/content/lublin/terrain";

/**
 * Plac Litewski's scene after its card (`docs/lokacje/plac-litewski.md`, ADR-0102): the wreck on its roof drawn by its
 * model in its solid, the bent pastoral in the OSM lamp's place, the night's traces and the clusters by the van, on
 * the paving and outside every building.
 */
describe("Plac Litewski's scene (ADR-0102)", () => {
  const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;
  const placed = (k: string) => PLAC_LITEWSKI_DETAIL.filter((p) => key(p.variant) === k);

  it("draws the wreck by its model on its roof, standing at its solid's foot, the solid kept for the scans", () => {
    expect(WRECK_BODY.scenery).toBe(true);
    expect(WRECK_BODY.solid).toBe(true);
    expect(WRECK_BODY.view.kind === "block" && WRECK_BODY.view.skin?.style).toBe("wreck");
    const [wreck] = placed("rd-lit-wreck");
    expect(wreck).toBeDefined();
    expect([wreck!.x, wreck!.y, wreck!.z]).toEqual([WRECK_FOOT.x, WRECK_FOOT.y, WRECK_FOOT.z]);
    expect(DISTRICT_M0_PROPS[0]).toBe(WRECK_BODY);
  });

  it("puts the bent pastoral where the OSM one stood, which gives way to its solid", () => {
    const [lamp] = placed("rd-lit-bent-lamp");
    expect([lamp!.x, lamp!.z]).toEqual([155.1, -50.9]);
    const straight = Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "lamp-pastoral" && Math.hypot(i.x - 155.1, i.z + 50.9) < 1);
    expect(straight).toEqual([]);
    // Its solid and the door's, the scene's last props.
    const night = DISTRICT_M0_PROPS.slice(-2);
    expect(night.every((p) => p.scenery && p.solid && p.seeThrough)).toBe(true);
    expect(night.some((p) => Math.abs(p.center.x - 155) < 0.5 && Math.abs(p.center.z + 50.9) < 0.5)).toBe(true);
  });

  it("lays every piece on the drawn paving, outside every building, by a shape of the scene or the rooms' kit", () => {
    for (const p of PLAC_LITEWSKI_DETAIL) {
      expect(key(p.variant), `${p.x},${p.z}`).toMatch(/^rd-(lit|c)-/);
      expect(inBuilding(p.x, p.z), `${key(p.variant)} at ${p.x},${p.z}`).toBe(false);
      if (key(p.variant) !== "rd-lit-wreck") expect(p.y).toBeCloseTo(surfaceY(p.x, p.z), 5);
    }
  });

  it("leaves the small things in clusters by the wreck and by the van, not over the square (§14)", () => {
    const things = (x: number, z: number, r: number) => PLAC_LITEWSKI_DETAIL.filter((p) => Math.hypot(p.x - x, p.z - z) <= r && (ROOM_DETAIL_SHAPES[p.variant]!.clutter ?? 0) > 0);
    const byWreck = things(155, -51, 3).reduce((n, p) => n + (ROOM_DETAIL_SHAPES[p.variant]!.clutter ?? 0), 0);
    const byVan = things(112, -42, 4).reduce((n, p) => n + (ROOM_DETAIL_SHAPES[p.variant]!.clutter ?? 0), 0);
    expect(byWreck).toBeGreaterThanOrEqual(12);
    expect(byVan).toBeGreaterThanOrEqual(10);
  });

  it("runs the tyres' tracks out of Kapucyńska towards the lamp the car hit", () => {
    const skid = placed("rd-lit-skid");
    expect(skid).toHaveLength(3);
    const first = skid[0]!;
    const last = skid[skid.length - 1]!;
    expect(Math.hypot(last.x - 155.1, last.z + 50.9)).toBeLessThan(Math.hypot(first.x - 155.1, first.z + 50.9));
    // Each piece heads north-east, the way the car came out of the side street.
    for (const s of skid) expect(Math.sin(s.yaw) > 0 && Math.cos(s.yaw) > 0).toBe(true);
  });

  it("is the scenery's last view, so the ids before it stay", () => {
    expect(ROOM_DETAIL_SCENERY[ROOM_DETAIL_SCENERY.length - 1]!.view).toEqual({ kind: "street-props", items: PLAC_LITEWSKI_DETAIL });
  });
});
