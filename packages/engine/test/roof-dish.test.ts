// @ts-expect-error The engine is typed for the browser; the test reads the files off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LUBLIN_CHUNKS, buildingView } from "@seki/sim/lublin";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { type PropSlot, placeSlot } from "../src/renderer/mapcity/facade-props";
import { facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { mapBuilding } from "../src/renderer/mapcity/map-building";
import { MeshSink } from "../src/renderer/mesh-sink";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import { planNearVertical, stackTiers, streetSide } from "../src/renderer/mapcity/vertical-plan";

/** The ground station's dish on the big roofs (ADR-0096 stage 3): one in four, the dish of `extra-props.glb`, facing its slot's way. */

const read = (name: string): ArrayBuffer => {
  const f = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength) as ArrayBuffer;
};
const props = mergeCityProps(parseCityProps(read("city-props.glb")), parseCityProps(read("extra-props.glb")));
const SOUTH = { x: 0, y: 0, z: -1 };
const slot = (x: number, z: number): PropSlot => ({ kind: "dish-big", at: { x, y: 20, z }, out: SOUTH });
const spots = Array.from({ length: 400 }, (_, i) => slot((i % 20) * 13.7, Math.floor(i / 20) * 11.3));

describe("the big roof dish (ADR-0096 stage 3)", () => {
  it("stands on about one big roof in four, the same spots every time", () => {
    const placed = spots.filter((s) => placeSlot(props, s, false).length > 0);
    expect(placed.length / spots.length).toBeGreaterThan(0.18);
    expect(placed.length / spots.length).toBeLessThan(0.32);
    expect(spots.filter((s) => placeSlot(props, s, false).length > 0)).toEqual(placed);
  });

  it("is the ground station of extra-props.glb, at its size, its front to the slot's way", () => {
    const s = spots.find((x) => placeSlot(props, x, false).length > 0)!;
    const [p] = placeSlot(props, s, false);
    expect(p!.model.key).toBe("ex-dish");
    expect(p!.model.size.y).toBeCloseTo(3.4, 1);
    expect(p!.xf.origin).toEqual(s.at);
    // The model's front (glTF +z, Babylon -z) along the slot's way: its z axis against it.
    expect(p!.xf.axes[2].z).toBeCloseTo(-SOUTH.z, 6);
    expect(p!.xf.axes[1]).toEqual({ x: 0, y: 1, z: 0 });
  });

  it("is not drawn on phones (no cheap version, the slot is not one of theirs)", () => {
    const s = spots.find((x) => placeSlot(props, x, false).length > 0)!;
    expect(placeSlot(props, s, true).every((p) => p.model.key === "ex-dish")).toBe(true);
  });

  it("stands by the roof's edge over the street, its dish to the street; none where every wall faces a neighbour", () => {
    let id = 0;
    let checked = 0;
    for (const c of LUBLIN_CHUNKS) {
      for (const b of c.buildings) {
        id += 1;
        const view = buildingView(b, c.district);
        if (view.kind !== "building") continue;
        const at = { x: b.x, y: b.y, z: b.z };
        const f = facadeFrame(mapBuilding(id, { ring: cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))), view, at }, () => null), () => null);
        const slots: PropSlot[] = [];
        planNearVertical(new MeshSink(), f, (slot) => slots.push(slot) > 0);
        const dish = slots.find((s) => s.kind === "dish-big");
        if (!dish) continue;
        checked += 1;
        const street = streetSide(f)!;
        expect(dish.out).toEqual(street);
        // On the street's half of the top tier: nearer the street than the roof's middle.
        const tier = stackTiers(f).at(-1)!;
        const xs = tier.ring.map((p) => p.x);
        const zs = tier.ring.map((p) => p.z);
        const mid = { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
        expect((dish.at.x - mid.x) * street.x + (dish.at.z - mid.z) * street.z).toBeGreaterThan(0.5);
        // With every wall against a neighbour, no street side and no dish.
        const shut = { ...f, walls: f.walls.map((w) => ({ ...w, blind: true })) };
        const none: PropSlot[] = [];
        planNearVertical(new MeshSink(), shut, (slot) => none.push(slot) > 0);
        expect(none.some((s) => s.kind === "dish-big")).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("stands on a few dozen superstructures of the city, only on the big ones", () => {
    let id = 0;
    const dishes: PropSlot[] = [];
    const big: PropSlot[] = [];
    for (const c of LUBLIN_CHUNKS) {
      for (const b of c.buildings) {
        id += 1;
        const view = buildingView(b, c.district);
        if (view.kind !== "building") continue;
        const at = { x: b.x, y: b.y, z: b.z };
        const f = facadeFrame(mapBuilding(id, { ring: cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))), view, at }, () => null), () => null);
        planNearVertical(new MeshSink(), f, (slot) => {
          if (slot.kind === "dish-big") {
            big.push(slot);
            if (placeSlot(props, slot, false).length > 0) dishes.push(slot);
          }
          return true;
        });
      }
    }
    expect(big.length).toBeGreaterThan(dishes.length);
    expect(dishes.length).toBeGreaterThan(5);
    expect(dishes.length).toBeLessThan(200);
    // 62 big superstructure roofs and 13 dishes on them on 20.11.
  });
});
