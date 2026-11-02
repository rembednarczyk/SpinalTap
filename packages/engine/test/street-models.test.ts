// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { WORLD_STREET_PROPS } from "@seki/sim";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { type CityProps, mergeCityProps, parseCityProps, transformProp, triangleCount } from "../src/renderer/city-props";
import { ToonMaterials } from "../src/npr/toon-material";
import { hasLanterns, lanternModel, lanternXforms, streetModel } from "../src/renderer/mapcity/street-models";
import { toWorld } from "../src/renderer/mapcity/prop-batch";
import { StreetProps } from "../src/renderer/mapcity/street-props";

/** The CC-BY street furniture of `street-props.glb` (ADR-0063, second Sketchfab pack). */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const streetBytes = file("street-props.glb");
const street = parseCityProps(streetBytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), street);

/**
 * The solids of the kinds with models (sim `content/lublin/furniture.ts`, `PARTS`): half sides and
 * top, centred on the foot. A model must not stick out of what the body collides with.
 */
const SOLIDS: Partial<Record<StreetPropKind, { hx: number; hz: number; top: number }>> = {
  "vending-machine": { hx: 0.5, hz: 0.38, top: 1.9 },
  "ticket-machine": { hx: 0.28, hz: 0.2, top: 1.75 },
};

const piece = (prop: StreetPropKind, x: number, z: number, yaw: number): StreetPropItem => ({ prop, x, y: 0.3, z, yaw, variant: 0 });
/** One of each, far apart, in one 256 m block. */
const PIECES: StreetPropItem[] = [
  piece("vending-machine", 10, 10, 0.7),
  piece("vending-machine", 30, 10, -2.1),
  piece("ticket-machine", 50, 10, 1.2),
  piece("ticket-machine", 70, 10, 3.0),
  piece("cctv", 90, 10, -0.4),
  piece("market-stall", 110, 10, 2.4),
];

/** (x, z) in a piece's frame (`turnLocal` inverted: +z towards +x). */
const local = (p: StreetPropItem, x: number, z: number) => {
  const dx = x - p.x;
  const dz = z - p.z;
  const c = Math.cos(p.yaw);
  const s = Math.sin(p.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
};

const make = (quality: "high" | "low", withProps: CityProps | null) => {
  const scene = new Scene(new NullEngine());
  const s = new StreetProps({ scene, materials: new ToonMaterials(scene), quality });
  s.spawn(1, PIECES, { x: 0, y: 0, z: 0 });
  s.flush();
  if (withProps) s.setProps(withProps);
  for (let i = 0; i < 5; i++) s.update({ x: 60, y: 2, z: 12 });
  return s.meshes.filter((m) => m.name.startsWith("props-") && !m.name.startsWith("props-far") && m.name !== "props-halo" && m.isEnabled());
};

describe("street-props.glb (ADR-0063)", () => {
  it("is small, on the city kit's palette, every model light and credited", () => {
    expect(streetBytes.byteLength).toBeLessThan(512 * 1024);
    expect(street.swatches).toEqual(props.swatches);
    expect([...street.models.keys()].sort()).toEqual([
      "st-atm",
      "st-bike",
      "st-cctv",
      "st-container-dumpster",
      "st-container-rust",
      "st-food-cart",
      "st-hydrant",
      "st-lantern",
      "st-planter",
      "st-scooter",
      "st-ticket-kiosk",
      "st-ticket-terminal",
      "st-vending",
      "st-vending-ramen",
    ]);
    for (const m of street.models.values()) expect(triangleCount(m), m.key).toBeLessThanOrEqual(1500);
  });

  it("refuses two files with the same model", () => {
    expect(() => mergeCityProps(street, street)).toThrow(/both files/);
  });

  it("fits each machine into its kind's solid", () => {
    for (const [kind, solid] of Object.entries(SOLIDS)) {
      const models = props.byStyle.get(kind) ?? [];
      expect(models.length, kind).toBe(2);
      for (const m of models) {
        expect(m.size.x / 2, m.key).toBeLessThanOrEqual(solid.hx);
        expect(m.size.z / 2, m.key).toBeLessThanOrEqual(solid.hz);
        expect(m.size.y, m.key).toBeLessThanOrEqual(solid.top);
        expect(m.size.y, m.key).toBeGreaterThan(solid.top - 0.2);
      }
    }
  });

  it("hangs the camera on its mast at the old camera's height and the lanterns clear of the stall", () => {
    const cam = props.byStyle.get("cctv")![0]!;
    expect(cam.size.y).toBeGreaterThan(4);
    expect(cam.size.y).toBeLessThan(4.5);
    const lantern = lanternModel(props)!;
    const stall = { prop: "market-stall" as const, x: 0, y: 0, z: 0, yaw: 0, shape: 0, scale: 1 };
    expect(triangleCount(lantern)).toBeLessThanOrEqual(250);
    for (const xf of lanternXforms(stall, lantern)) {
      const { positions } = transformProp(lantern, xf);
      for (let i = 0; i < positions.length; i += 3) {
        const [x, y, z] = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
        // Under the canopy (2.32 m), above a head and the counter's goods, off the posts (x ±1.0, z ±0.7) and the string of lights (z 0.92).
        expect(y).toBeLessThanOrEqual(2.33);
        expect(y).toBeGreaterThan(1.8);
        expect(Math.abs(Math.abs(x) - 1)).toBeGreaterThan(0.1);
        expect(z).toBeLessThan(0.87);
      }
    }
  });

  it("bakes the models where the pieces stand, inside their solids: more vertices, no more meshes", () => {
    const before = make("high", null);
    const after = make("high", props);
    expect(after.length).toBe(before.length);
    const count = (ms: typeof after) => ms.reduce((n, m) => n + m.getTotalVertices(), 0);
    expect(count(after)).toBeGreaterThan(count(before));
    const pos = after.flatMap((m) => [...(m.getVerticesData("position") ?? [])]);
    for (const p of PIECES) {
      const solid = SOLIDS[p.prop];
      if (!solid) continue;
      let n = 0;
      for (let i = 0; i < pos.length; i += 3) {
        const l = local(p, pos[i]!, pos[i + 2]!);
        if (Math.hypot(l.x, l.z) > 3) continue;
        n++;
        expect(Math.abs(l.x), p.prop).toBeLessThanOrEqual(solid.hx + 1e-3);
        expect(Math.abs(l.z), p.prop).toBeLessThanOrEqual(solid.hz + 1e-3);
        expect(pos[i + 1]! - p.y, p.prop).toBeLessThanOrEqual(solid.top + 1e-3);
      }
      expect(n, p.prop).toBeGreaterThan(100);
    }
    // Each piece takes a model of its own kind.
    for (const p of PIECES) {
      const m = streetModel(props, { ...p, shape: 0, scale: 1 });
      if (p.prop === "market-stall") expect(m).toBeNull();
      else expect(m?.styles).toContain(p.prop);
    }
  });

  it("gives the drinks machines' shapes side by side different models, the ticket machines one by position", () => {
    const at = (prop: StreetPropKind, x: number, shape: number) => streetModel(props, { prop, x, y: 0, z: 5, yaw: 0, shape, scale: 1 })?.key;
    expect([0, 1, 2].map((s) => at("vending-machine", 5 + s * 2, s))).toEqual(["st-vending", "st-vending-ramen", "st-vending"]);
    expect(new Set([0, 1, 2, 3, 4, 5, 6, 7].map((i) => at("ticket-machine", i * 7, 0))).size).toBe(2);
  });

  it("hangs lanterns on about a third of the city's stalls", () => {
    const stalls = Object.values(WORLD_STREET_PROPS)
      .flatMap((items) => toWorld(items, { x: 0, y: 0, z: 0 }))
      .filter((p) => p.prop === "market-stall");
    expect(stalls.length).toBeGreaterThan(100);
    const share = stalls.filter(hasLanterns).length / stalls.length;
    expect(share).toBeGreaterThan(0.25);
    expect(share).toBeLessThan(0.42);
  });

  it("leaves the phones' blocks as they were", () => {
    const count = (ms: ReturnType<typeof make>) => ms.reduce((n, m) => n + m.getTotalVertices(), 0);
    expect(count(make("low", props))).toBe(count(make("low", null)));
  });

  it("bakes no loose scraps: every part of a model is whole (wheels, handlebars), a cart stands on the ground along its length", () => {
    for (const m of street.models.values()) {
      const sizes = parts(m);
      // A post or a mast added as a box is 10 triangles; anything less is a scrap the clustering left.
      expect(Math.min(...sizes), `${m.key}: ${sizes.join(",")}`).toBeGreaterThanOrEqual(10);
    }
    expect(parts(street.models.get("st-bike")!).length).toBeLessThanOrEqual(3);
    const cart = street.models.get("st-food-cart")!;
    const at = (k: number) => [...cart.positions].filter((_, i) => i % 3 === k);
    const xs = at(0);
    const ys = at(1);
    // Something on the ground at both ends of the 3.9 m cart (its wheels and its corner posts, which
    // stand on y = 0 too), and posts from the counter's height up to its roof.
    const ground = xs.filter((_, i) => ys[i]! < 0.05);
    expect(Math.max(...ground) - Math.min(...ground)).toBeGreaterThan(2.5);
    const spans = Array.from({ length: cart.indices.length / 3 }, (_, t) => [0, 1, 2].map((k) => ys[cart.indices[t * 3 + k]!]!));
    expect(spans.filter((y) => Math.min(...y) < 1.2 && Math.max(...y) > 2.2).length).toBeGreaterThanOrEqual(8);
  });
});

/** Triangle counts of a model's connected parts (vertices joined by position). */
const parts = (m: { positions: Float32Array; indices: Uint32Array }): number[] => {
  const key = (i: number) => `${m.positions[i * 3]!.toFixed(4)},${m.positions[i * 3 + 1]!.toFixed(4)},${m.positions[i * 3 + 2]!.toFixed(4)}`;
  const ids = new Map<string, number>();
  const id = (i: number) => {
    const k = key(i);
    let v = ids.get(k);
    if (v === undefined) ids.set(k, (v = ids.size));
    return v;
  };
  const tri = Array.from({ length: m.indices.length / 3 }, (_, t) => [id(m.indices[t * 3]!), id(m.indices[t * 3 + 1]!), id(m.indices[t * 3 + 2]!)] as const);
  const parent = Array.from({ length: ids.size }, (_, i) => i);
  const find = (a: number): number => (parent[a] === a ? a : (parent[a] = find(parent[a]!)));
  for (const [a, b, c] of tri) {
    parent[find(a)] = find(b);
    parent[find(b)] = find(c);
  }
  const count = new Map<number, number>();
  for (const [a] of tri) count.set(find(a), (count.get(find(a)) ?? 0) + 1);
  return [...count.values()];
};
