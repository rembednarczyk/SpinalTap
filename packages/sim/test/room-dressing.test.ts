import { describe, expect, it } from "vitest";
import { ROOM_DETAIL_SHAPES, ROOM_KITS } from "@seki/core";
import { ALL_SHOP_BUILDS, METRO_PLATFORMS, P2_TUNNEL_DRESSING, SHOP_DRESSING, shopDressingLayout as shopDressLayout, P1_DRESSING, P1_LAYOUT, P2_TUNNEL_LAYOUT, SHELTER_DRESSING, SHELTER_LAYOUT, TESSEN_OFFICE_DRESSING, TESSEN_OFFICE_LAYOUT, W3_HALL_DRESSING, W3_HALL_LAYOUT, type GroundRect, dressRoom, platformLayout } from "../src";
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

/**
 * Every room the generator dresses besides the platforms (`room-dressing-rooms.ts`): in its bounds, out of what is kept
 * clear and taken, the clutter by its heroes, a `by` shape by its door, an `apart` shape apart, the same every time.
 */
describe("the rooms' dressing generator (ADR-0099) in the other rooms", () => {
  const shops = ALL_SHOP_BUILDS.flatMap((b) => {
    const layout = shopDressLayout(b);
    return layout ? [{ layout, dressed: dressRoom(layout) }] : [];
  });
  const rooms = [{ layout: P2_TUNNEL_LAYOUT, dressed: P2_TUNNEL_DRESSING }, { layout: TESSEN_OFFICE_LAYOUT, dressed: TESSEN_OFFICE_DRESSING }, { layout: SHELTER_LAYOUT, dressed: SHELTER_DRESSING }, { layout: P1_LAYOUT, dressed: P1_DRESSING }, { layout: W3_HALL_LAYOUT, dressed: W3_HALL_DRESSING }, ...shops];

  it("dresses every open shop of Alchemia's, the papers on its counter's top (its till and cup left free)", () => {
    expect(shops.length).toBeGreaterThanOrEqual(40);
    expect(shops.flatMap((s) => s.dressed)).toEqual(SHOP_DRESSING);
    const papered = shops.filter((s) => s.dressed.some((p) => key(p.variant) === "rd-c-papers"));
    expect(papered.length / shops.length).toBeGreaterThan(0.8);
    for (const { layout, dressed } of shops)
      for (const p of dressed.filter((d) => d.y > layout.floor + 0.5)) {
        const k = `${layout.id} ${key(p.variant)}`;
        expect(layout.surfaces.some((s) => inRect(p.x, p.z, s)), k).toBe(true);
        expect(layout.taken.filter((t) => t.onTop).some((t) => inRect(p.x, p.z, t)), k).toBe(false);
      }
  });
  it("gives the shelter its whole kit, the Hebi's bottles and cup on his crate by his laptop", () => {
    for (const e of ROOM_KITS.shelter) expect(SHELTER_DRESSING.filter((p) => key(p.variant) === e.key).length, e.key).toBeGreaterThanOrEqual(e.count[0]);
    const laptop = SHELTER_LAYOUT.taken.find((t) => t.key === "rd-shelter-hebi")!;
    for (const p of SHELTER_DRESSING.filter((d) => d.y > SHELTER_LAYOUT.floor + 0.5)) {
      expect(inRect(p.x, p.z, SHELTER_LAYOUT.surfaces[0]!), key(p.variant)).toBe(true);
      expect(Math.hypot(p.x - (laptop.minX + laptop.maxX) / 2, p.z - (laptop.minZ + laptop.maxZ) / 2), key(p.variant)).toBeLessThanOrEqual(1.2);
    }
  });
  it("pools P-1's puddles in its empty bays, on a half-metre grid, and gives the deck its whole kit", () => {
    for (const e of ROOM_KITS["car-park"]) expect(P1_DRESSING.filter((p) => key(p.variant) === e.key).length, e.key).toBeGreaterThanOrEqual(e.count[0]);
    const puddles = P1_DRESSING.filter((p) => key(p.variant) === "rd-c-puddle");
    for (const p of puddles) expect((P1_LAYOUT.open ?? []).some((r) => inRect(p.x, p.z, r)), `${p.x},${p.z}`).toBe(true);
    // No floor-free thing in a room without open floor.
    for (const { layout, dressed } of rooms.filter((r) => !r.layout.open))
      for (const e of ROOM_KITS[layout.kind].filter((k) => k.anchor === "floor-free")) expect(dressed.some((p) => key(p.variant) === e.key), layout.id).toBe(false);
  });
  const near = (x: number, z: number, r: GroundRect, d: number) => Math.hypot(x - Math.min(r.maxX, Math.max(r.minX, x)), z - Math.min(r.maxZ, Math.max(r.minZ, z))) <= d;

  it("stands each kit's things in their room, out of the clear and the taken, each within its kit's count", () => {
    for (const { layout, dressed } of rooms) {
      expect(dressed.length, layout.id).toBeGreaterThan(0);
      for (const e of ROOM_KITS[layout.kind]) expect(dressed.filter((p) => key(p.variant) === e.key).length, `${layout.id} ${e.key}`).toBeLessThanOrEqual(e.count[1]);
      for (const p of dressed) {
        const k = `${layout.id} ${key(p.variant)} ${p.x.toFixed(2)},${p.z.toFixed(2)}`;
        expect(inRect(p.x, p.z, layout.bounds), k).toBe(true);
        expect(layout.clear.some((r) => inRect(p.x, p.z, r)), k).toBe(false);
        expect(layout.taken.some((t) => (p.y > layout.floor + 0.5) === (t.onTop === true) && inRect(p.x, p.z, t)), k).toBe(false);
      }
    }
  });

  it("puts a `by` thing by its door (the puddle where the rain comes in) and keeps an `apart` thing apart", () => {
    for (const { layout, dressed } of rooms) {
      for (const e of ROOM_KITS[layout.kind]) {
        const mine = dressed.filter((p) => key(p.variant) === e.key);
        if (e.by) for (const p of mine) expect((layout.doors ?? []).some((d) => (e.by === "door" || d.weather) && near(p.x, p.z, d, 2.5)), `${layout.id} ${e.key}`).toBe(true);
        if (e.apart) for (const [i, p] of mine.entries()) for (const q of mine.slice(i + 1)) expect(Math.hypot(p.x - q.x, p.z - q.z), `${layout.id} ${e.key}`).toBeGreaterThanOrEqual(e.apart);
      }
      expect(dressRoom(layout)).toEqual(dressed);
    }
  });
});
