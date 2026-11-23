import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { BAR_SPOT, DEPTAK_DETAIL, DEPTAK_SOLIDS, KOI_COUNTER, KOI_DOOR, KOI_LANTERN, NOBU_BENCH, NOBU_SEAT, WORLD_SCENERY, inBuilding, nearestWall } from "../src";
import { seatGroups } from "../src/content/lublin/seats";

/*
 * The deptak after its card (`docs/lokacje/deptak-krakowskie.md`, ADR-0102 point 5): the counter on Neon Koi's front
 * where the contract's drinker stands, clear of the bar's door, with its solid; the lantern over the door; Nobu's bench
 * under him; the clusters at their fronts' feet.
 */

const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("the deptak's scene (ADR-0102 point 5)", () => {
  it("stands the counter on Koi's front by the drinker, clear of the door, solid", () => {
    const bar = DEPTAK_DETAIL.find((i) => i.prop === "room-detail" && keyOf(i.variant) === "rd-dp-bar")!;
    expect(flat(bar, KOI_COUNTER.at)).toBeLessThan(1e-9);
    expect(flat(BAR_SPOT, KOI_COUNTER.at)).toBeLessThan(2);
    // Its west end (0.9 m from its middle) a hand off the door's east jamb.
    expect(Math.abs(KOI_COUNTER.at.x - KOI_DOOR.at.x) - 0.9 - KOI_DOOR.width / 2).toBeGreaterThan(0.2);
    const solid = DEPTAK_SOLIDS[0]!;
    for (const p of solid.prisms![0]!.points) expect(inBuilding(solid.center.x + p.x, solid.center.z + p.z), `${p.x},${p.z}`).toBe(false);
    // The drinker stands out of the counter's solid.
    const pts = solid.prisms![0]!.points.map((p) => ({ x: solid.center.x + p.x, z: solid.center.z + p.z }));
    const minZ = Math.min(...pts.map((p) => p.z));
    const maxZ = Math.max(...pts.map((p) => p.z));
    expect(BAR_SPOT.z < minZ - 0.3 || BAR_SPOT.z > maxZ + 0.3).toBe(true);
  });

  it("hangs the lantern over Koi's door and seats Nobu on his bench before PACHINKO", () => {
    expect(flat(KOI_LANTERN.at, KOI_DOOR.at)).toBeLessThan(0.6);
    const bench = DEPTAK_DETAIL.find((i) => i.prop === "bench")!;
    expect(flat(bench, NOBU_BENCH)).toBeLessThan(1e-9);
    const seats = seatGroups(bench).flat();
    expect(Math.min(...seats.map((s) => flat(s, NOBU_SEAT)))).toBeLessThan(0.6);
    expect(inBuilding(bench.x, bench.z)).toBe(false);
  });

  it("leaves the clusters at their fronts' feet, out of the houses", () => {
    for (const i of DEPTAK_DETAIL.filter((x) => x.prop === "room-detail")) {
      expect(inBuilding(i.x, i.z), keyOf(i.variant)).toBe(false);
      expect(nearestWall(i.x, i.z).d, keyOf(i.variant)).toBeLessThan(0.1);
    }
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === DEPTAK_DETAIL)).toBe(true);
  });
});
