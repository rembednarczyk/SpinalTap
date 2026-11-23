import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES } from "@seki/core";
import { BRIDGE_DOWNPIPE, CHIPS_TABLE, GATE_PASSAGES, GRODZKA_DETAIL, GRODZKA_GATE_LANTERNS, GRODZKA_LANTERN_DROP, GRODZKA_RING, GRODZKA_SOLIDS, GRODZKA_WALK, KANAL_SCENERY, MEMORY_LANTERN, TESSEN_STOP, TERRITORY_GROUPS, WORLD_SCENERY, inBuilding, inGrodzkaGate, nearestWall } from "../src";
import { groundY } from "../src/content/lublin/terrain";

/*
 * Grodzka under the footbridge after its card (`docs/lokacje/grodzka-kladka.md`, ADR-0102 point 5): the traders' table
 * against the house under the bridge with its solid, clear of Hideo's walk; the group's litter in its ring; the bridge's
 * downpipe on the house at its west end; Brama Grodzka's passage lit by two lanterns on its jambs; the Lantern of Memory
 * before it; the bus stop's sign out of the gate's way.
 */

const GATE = GATE_PASSAGES[1]!;
const keyOf = (variant: number): string => ROOM_DETAIL_SHAPES[variant]!.key;
const modelOf = (key: string) => GRODZKA_DETAIL.find((i) => i.prop === "room-detail" && keyOf(i.variant) === key)!;
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
const offLine = (p: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
};

describe("Grodzka's scene (ADR-0102 point 5)", () => {
  it("stands the traders' table against the house under the bridge, solid, clear of Hideo's walk", () => {
    const table = modelOf("rd-gr-chips");
    expect(flat(table, CHIPS_TABLE.at)).toBeLessThan(1e-9);
    expect(inBuilding(table.x, table.z)).toBe(false);
    expect(nearestWall(table.x, table.z).d).toBeLessThan(0.8);
    const solid = GRODZKA_SOLIDS[0]!;
    expect(solid.solid).toBe(true);
    expect(flat(solid.center, CHIPS_TABLE.at)).toBeLessThan(1e-9);
    for (const p of solid.prisms![0]!.points) expect(inBuilding(solid.center.x + p.x, solid.center.z + p.z)).toBe(false);
    for (let i = 1; i < GRODZKA_WALK.length; i++) expect(offLine(table, GRODZKA_WALK[i - 1]!, GRODZKA_WALK[i]!)).toBeGreaterThan(1.2);
    // Under the bridge (its outline round its middle), near the group.
    expect(flat(table, KANAL_SCENERY[0]!.at)).toBeLessThan(10);
    expect(flat(table, GRODZKA_RING)).toBeLessThan(8);
    expect(TERRITORY_GROUPS.find((g) => g.territory === "grodzka-bridge")!.core).toEqual(GRODZKA_RING);
  });

  it("hangs the bridge's downpipe on the house at its west end, dripping", () => {
    const pipe = modelOf("rd-gr-downpipe");
    expect(flat(pipe, BRIDGE_DOWNPIPE.at)).toBeLessThan(1e-9);
    expect(inBuilding(pipe.x, pipe.z)).toBe(false);
    expect(nearestWall(pipe.x, pipe.z).d).toBeLessThan(0.1);
    expect(ROOM_DETAIL_SHAPES.find((s) => s.key === "rd-gr-downpipe")?.sound).toBe("drip");
  });

  it("lights Brama Grodzka's passage from its jambs, under the vault's springing", () => {
    const lanterns = GRODZKA_DETAIL.filter((i) => i.prop === "lamp-wall-lantern");
    expect(lanterns).toHaveLength(GRODZKA_GATE_LANTERNS.length);
    lanterns.forEach((l, i) => {
      const g = GRODZKA_GATE_LANTERNS[i]!;
      expect(flat(l, inGrodzkaGate(g.t, g.side * (GATE.width / 2)))).toBeLessThan(1e-9);
      expect(l.y).toBeCloseTo(groundY(l.x, l.z) - GRODZKA_LANTERN_DROP, 5);
    });
  });

  it("stands the Lantern of Memory before the gate and the bus stop's sign out of the gate's way", () => {
    expect(GRODZKA_DETAIL.find((i) => i.prop === "lamp-pastoral")).toMatchObject({ x: MEMORY_LANTERN.x, z: MEMORY_LANTERN.z });
    expect(inBuilding(MEMORY_LANTERN.x, MEMORY_LANTERN.z)).toBe(false);
    const sign = GRODZKA_DETAIL.find((i) => i.prop === "bus-stop")!;
    expect(flat(sign, TESSEN_STOP.at)).toBeLessThan(1e-9);
    expect(inBuilding(sign.x, sign.z)).toBe(false);
    // Off the passage's axis beyond its east mouth by more than half its width and a body.
    const far = { x: GATE.to.x + (GATE.to.x - GATE.from.x), z: GATE.to.z + (GATE.to.z - GATE.from.z) };
    expect(offLine(sign, GATE.to, far)).toBeGreaterThan(GATE.width / 2 + 0.4);
    expect(WORLD_SCENERY.some((s) => s.view.kind === "street-props" && s.view.items === GRODZKA_DETAIL)).toBe(true);
  });
});
