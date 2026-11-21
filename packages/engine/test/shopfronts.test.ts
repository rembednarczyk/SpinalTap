// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { type PropSlot, placeSlot, planShopfronts } from "../src/renderer/mapcity/facade-props";
import { planNearFrames } from "../src/renderer/mapcity/cell-plan";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import { venueBoards } from "../src/renderer/mapcity/venue-plan";
import { MeshSink } from "../src/renderer/mesh-sink";

/** The venues' fronts of the Asian Shop Pack in the shop districts (ADR-0096 rule 6). */
const read = (name: string): ArrayBuffer => {
  const f = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer;
};
const props = mergeCityProps(parseCityProps(read("city-props.glb")), parseCityProps(read("extra-props.glb")));
const ring = cleanRing([
  { x: 0, z: 0 },
  { x: 30, z: 0 },
  { x: 30, z: 12 },
  { x: 0, z: 12 },
]);
const venues = [
  { x: 5, z: -0.5, name: "KAWA", color: "#ff2e88" },
  { x: 16, z: -0.5, name: "LOMBARD NOCNY 24H", color: "#00e5ff" },
];
const building = (over: Partial<MapBuilding> = {}): MapBuilding => ({ id: 3, ring, base: 0, foot: 0, height: 15, levels: 4, use: "commercial", look: 77, shopfront: true, venues, ...over });
const fronts = (b: MapBuilding): PropSlot[] => {
  const out: PropSlot[] = [];
  planShopfronts(facadeFrame(b, () => null), (s) => out.push(s) > 0);
  return out;
};

describe("the venues' fronts (ADR-0096 rule 6)", () => {
  it("stand under each venue's board in the shop districts, as wide as the board, up to its bottom", () => {
    const f = facadeFrame(building({ shopfronts: true }), () => null);
    const boards = venueBoards(f);
    const slots = fronts(building({ shopfronts: true }));
    expect(slots).toHaveLength(boards.length);
    expect(boards.length).toBe(2);
    slots.forEach((s, k) => {
      const b = boards[k]!;
      expect(s.width).toBeCloseTo(b.width, 6);
      expect(s.at.y).toBe(0);
      expect(s.height!).toBeCloseTo(b.y - b.height / 2 - 0.05, 6);
      expect(s.out).toEqual({ x: b.wall.nx, y: 0, z: b.wall.nz });
      expect(s.kind.startsWith("shopfront-")).toBe(true);
      // The model stretched to the slot: its width and height, its back on the wall.
      const [p] = placeSlot(props, s, false);
      expect(p!.model.key.startsWith("ex-front-")).toBe(true);
    });
  });

  it("are none on the Old Town and Krakowskie (no `shopfronts`), the same twice", () => {
    expect(fronts(building())).toEqual([]);
    expect(fronts(building({ shopfronts: true }))).toEqual(fronts(building({ shopfronts: true })));
  });

  it("are left out on phones, with the awnings", () => {
    const slots: PropSlot[] = [];
    planNearFrames(new MeshSink(), [facadeFrame(building({ shopfronts: true }), () => null)], true, (s) => slots.push(s) > 0, () => []);
    expect(slots.some((s) => s.kind.startsWith("shopfront-"))).toBe(false);
  });

  it("take each front for some building, the whole shopfront only on a stretch of 4.5 m and more", () => {
    const kinds = new Set<string>();
    for (let look = 1; look < 60; look++) for (const s of fronts(building({ shopfronts: true, look }))) {
      kinds.add(s.kind);
      if (s.kind === "shopfront-wide") expect(s.width!).toBeGreaterThanOrEqual(4.5);
    }
    expect(kinds.has("shopfront-door") && kinds.has("shopfront-counter")).toBe(true);
  });
});
