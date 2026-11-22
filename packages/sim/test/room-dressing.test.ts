import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES, ROOM_KITS } from "@seki/core";
import { METRO_PLATFORMS, type GroundRect, dressRoom, platformLayout } from "../src";
import { METRO_DETAIL } from "../src";

const key = (variant: number) => ROOM_DETAIL_SHAPES[variant]!.key;
const inRect = (x: number, z: number, r: GroundRect) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/**
 * The rooms' dressing generator of ADR-0099 on the metro's platforms: the kit stands on the back wall and the
 * benches, out of the stairs' foot, the ends, the edge and the ticket machine, never on what is taken, its clutter
 * within a cluster's reach of its heroes, the same every time.
 */
describe("the rooms' dressing generator (ADR-0099) on the platforms", () => {
  const rooms = METRO_PLATFORMS.map((e, i) => {
    const hand = METRO_DETAIL[i]!.slice(0, 7);
    return { layout: platformLayout(e.platform, `metro-${e.station}`, hand), dressed: METRO_DETAIL[i]!.slice(7) };
  });

  it("gives every platform its kit, the counts in the kit's ranges", () => {
    for (const { layout, dressed } of rooms) {
      for (const e of ROOM_KITS.platform) {
        const n = dressed.filter((p) => key(p.variant) === e.key).length;
        expect(n, `${layout.id} ${e.key}`).toBeGreaterThanOrEqual(e.count[0]);
        expect(n, `${layout.id} ${e.key}`).toBeLessThanOrEqual(e.count[1]);
      }
    }
  });

  it("stands nothing in what is kept clear, out of the platform or on a bench's solid, the tops' things on a top", () => {
    for (const { layout, dressed } of rooms) {
      for (const p of dressed) {
        const k = `${layout.id} ${key(p.variant)} ${p.x.toFixed(2)},${p.z.toFixed(2)}`;
        expect(inRect(p.x, p.z, layout.bounds), k).toBe(true);
        expect(layout.clear.some((r) => inRect(p.x, p.z, r)), k).toBe(false);
        const onTop = p.y > layout.floor + 0.2;
        if (onTop) expect(layout.surfaces.some((s) => inRect(p.x, p.z, s) && Math.abs(s.top - p.y) < 1e-6), k).toBe(true);
        else expect(layout.taken.filter((t) => !t.onTop).some((t) => inRect(p.x, p.z, t)), k).toBe(false);
      }
    }
  });

  it("gathers the clutter within a cluster's reach (1.2 m) of a hero of its keys", () => {
    for (const { layout, dressed } of rooms) {
      for (const e of ROOM_KITS.platform.filter((k) => k.role === "clutter")) {
        const heroes = [
          ...dressed.filter((p) => e.near!.includes(key(p.variant))).map((p) => ({ x: p.x, z: p.z })),
          ...layout.taken.filter((t) => t.key && e.near!.includes(t.key)).map((t) => ({ x: (t.minX + t.maxX) / 2, z: (t.minZ + t.maxZ) / 2 })),
        ];
        for (const p of dressed.filter((d) => key(d.variant) === e.key)) expect(heroes.some((h) => Math.hypot(h.x - p.x, h.z - p.z) <= 1.2), `${layout.id} ${e.key}`).toBe(true);
      }
    }
  });

  it("is the same every time, and differs between platforms (the room's key)", () => {
    for (const { layout, dressed } of rooms) expect(dressRoom(layout)).toEqual(dressed);
    const spread = new Set(rooms.map(({ layout, dressed }) => dressed.map((p) => `${key(p.variant)}:${(p.x - layout.bounds.minX).toFixed(1)}`).join()));
    expect(spread.size).toBeGreaterThan(1);
  });
});
