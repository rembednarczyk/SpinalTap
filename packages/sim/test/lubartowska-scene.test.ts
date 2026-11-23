import { describe, expect, it } from "vitest";
import { LUBARTOWSKA_DETAIL, LUBARTOWSKA_KIOSK, LUBARTOWSKA_RING, TERRITORY_GROUPS, WORLD_SCENERY, inBuilding, nearestWall } from "../src";
import { furniturePrisms } from "../src/content/lublin/furniture";

/*
 * Lubartowska after its card (`docs/lokacje/lubartowska.md`, ADR-0102 point 5): the 24-hour kiosk on the pavement by
 * the tenement, its solid out of the house and off the group's ring, its back to the wall; the group's litter round it.
 */
describe("Lubartowska's scene (ADR-0102 point 5)", () => {
  it("stands the kiosk with its back to the tenement, off the Hebi group's ring and the house's door", () => {
    expect(TERRITORY_GROUPS.find((g) => g.territory === "lubartowska")!.core).toEqual(LUBARTOWSKA_RING);
    const kiosk = LUBARTOWSKA_DETAIL.find((i) => i.prop === "kiosk")!;
    expect(Math.hypot(kiosk.x - LUBARTOWSKA_KIOSK.x, kiosk.z - LUBARTOWSKA_KIOSK.z)).toBeLessThan(1e-9);
    for (const p of furniturePrisms(kiosk)[0]!.points) expect(inBuilding(kiosk.x + p.x, kiosk.z + p.z), `${p.x},${p.z}`).toBe(false);
    expect(nearestWall(kiosk.x, kiosk.z).d).toBeLessThan(1.3);
    expect(Math.hypot(kiosk.x - LUBARTOWSKA_RING.x, kiosk.z - LUBARTOWSKA_RING.z)).toBeGreaterThan(3.5);
    expect(Math.hypot(kiosk.x - 559.8, kiosk.z - 346.3)).toBeGreaterThan(3);
  });

  it("leaves the group's litter round its ring, out of the houses", () => {
    const litter = LUBARTOWSKA_DETAIL.filter((i) => i.prop === "clutter");
    expect(litter.length).toBeGreaterThanOrEqual(5);
    for (const l of litter) {
      const d = Math.hypot(l.x - LUBARTOWSKA_RING.x, l.z - LUBARTOWSKA_RING.z);
      expect(d).toBeGreaterThan(1.6);
      expect(d).toBeLessThan(3.2);
      expect(inBuilding(l.x, l.z)).toBe(false);
    }
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === LUBARTOWSKA_DETAIL)).toBe(true);
  });
});
