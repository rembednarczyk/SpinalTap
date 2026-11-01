// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { FOOD_STALL, WORLD_STREET_PROPS, furniturePrisms } from "@seki/sim";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { mergeCityProps, parseCityProps, transformProp, triangleCount } from "../src/renderer/city-props";
import type { MeshSink } from "../src/renderer/mesh-sink";
import { ToonMaterials } from "../src/npr/toon-material";
import { counterGoods, hasCounterGoods, hasLanterns, hasNoren, lanternModel, lanternXforms, pieceXform } from "../src/renderer/mapcity/market-models";
import { toWorld } from "../src/renderer/mapcity/prop-batch";
import { buildPropModel } from "../src/renderer/mapcity/prop-models";
import { PROP_SHAPES } from "../src/renderer/mapcity/prop-shapes";
import { streetModel } from "../src/renderer/mapcity/street-models";
import { StreetProps } from "../src/renderer/mapcity/street-props";

/** The market's furniture of ADR-0058 stage 3: procedural (phones), the models of `market-props.glb`, the stalls' dressing. */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const marketBytes = file("market-props.glb");
const market = parseCityProps(marketBytes);
const props = mergeCityProps(mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("street-props.glb"))), market);

/** Half sides and top of a piece's solid, unturned; the booth's from its parts. */
const solidBox = (prop: StreetPropKind, variant = 0) => {
  const prisms = furniturePrisms({ prop, x: 0, y: 0, z: 0, yaw: 0, variant });
  const pts = prisms.flatMap((p) => p.points);
  return { x0: Math.min(...pts.map((q) => q.x)), x1: Math.max(...pts.map((q) => q.x)), z0: Math.min(...pts.map((q) => q.z)), z1: Math.max(...pts.map((q) => q.z)), top: Math.max(...prisms.map((p) => p.top)) };
};

const bounds = (s: MeshSink) => {
  const at = (k: number) => s.positions.filter((_, i) => i % 3 === k);
  return { x0: Math.min(...at(0)), x1: Math.max(...at(0)), y: Math.max(...at(1)), z0: Math.min(...at(2)), z1: Math.max(...at(2)) };
};

const world = (prop: StreetPropKind, x: number, shape = 0, yaw = 0.4) => ({ prop, x, y: 0, z: 10, yaw, shape, scale: 1 });

describe("procedural market furniture of ADR-0058 stage 3", () => {
  it("draws the stock of each shape inside its solid and about as tall", () => {
    expect(PROP_SHAPES["market-goods"]).toBe(4);
    for (let s = 0; s < 4; s++) {
      const box = solidBox("market-goods", s);
      const b = bounds(buildPropModel("market-goods", s).sink);
      expect(b.x0, `shape ${s}`).toBeGreaterThanOrEqual(box.x0 - 0.03);
      expect(b.x1, `shape ${s}`).toBeLessThanOrEqual(box.x1 + 0.03);
      expect(b.z0, `shape ${s}`).toBeGreaterThanOrEqual(box.z0 - 0.03);
      expect(b.z1, `shape ${s}`).toBeLessThanOrEqual(box.z1 + 0.03);
      expect(b.y, `shape ${s}`).toBeLessThanOrEqual(box.top + 0.03);
      expect(b.y, `shape ${s}`).toBeGreaterThan(box.top * 0.75);
    }
  });

  it("draws the booth over its solid: posts on its posts, stools in front, the roof at its height", () => {
    const box = solidBox("food-stall");
    const b = bounds(buildPropModel("food-stall", 0).sink);
    // The roof overhangs the posts by 0.25 m behind; the rest stays within the solid's footprint.
    expect(b.x0).toBeGreaterThanOrEqual(box.x0 - 0.15);
    expect(b.x1).toBeLessThanOrEqual(box.x1 + 0.15);
    expect(b.z1).toBeLessThanOrEqual(box.z1 + 0.03);
    expect(b.z0).toBeGreaterThanOrEqual(box.z0 - 0.25);
    expect(b.y).toBeGreaterThan(FOOD_STALL.roof);
    expect(b.y).toBeLessThan(FOOD_STALL.roof + 0.4);
  });
});

describe("market-props.glb (ADR-0058 stage 3)", () => {
  it("names in `sources.json` only models the file has, and every model under some source", () => {
    const sources = (JSON.parse((readFileSync as (url: URL, enc: string) => string)(new URL("../../../tools/assets/sources.json", import.meta.url), "utf8")) as {
      sources: { id: string; used?: string[] }[];
    }).sources;
    const used = sources.flatMap((s) => (s.used ?? []).filter((k) => k.startsWith("mk-")).map((k) => ({ id: s.id, k })));
    for (const { id, k } of used) expect(market.models.has(k), `${id}: ${k}`).toBe(true);
    for (const k of market.models.keys()) expect(used.some((u) => u.k === k), k).toBe(true);
    // The parts of `tools/city_market.py`: the booth from three packs, the crates from the Mini Market alone.
    const by = (k: string) => used.filter((u) => u.k === k).map((u) => u.id).sort();
    expect(by("mk-yatai")).toEqual(["kenney-food-kit", "kenney-furniture-kit", "kenney-survival-kit"]);
    expect(by("mk-crates")).toEqual(["kenney-mini-market"]);
    expect(by("mk-counter-drinks")).toEqual(["kenney-food-kit"]);
  });

  it("is small, on the city kit's palette, CC0 (no credits), every model light", () => {
    expect(marketBytes.byteLength).toBeLessThan(256 * 1024);
    expect(market.swatches).toEqual(props.swatches);
    expect([...market.models.keys()]).toEqual(["mk-cartons", "mk-barrels", "mk-crates", "mk-canvas", "mk-yatai", "mk-counter-ramen", "mk-counter-produce", "mk-counter-drinks"]);
    for (const m of market.models.values()) expect(triangleCount(m), m.key).toBeLessThanOrEqual(1500);
    // The glTF's JSON chunk: no node carries a credit.
    const head = new DataView(marketBytes, 12, 8);
    const json = new TextDecoder().decode(new Uint8Array(marketBytes, 20, head.getUint32(0, true)));
    expect(json).not.toContain('"credit"');
  });

  it("fits the stock of each shape into its solid, in shape order", () => {
    const goods = props.byStyle.get("market-goods")!;
    expect(goods.map((m) => m.key)).toEqual(["mk-cartons", "mk-barrels", "mk-crates", "mk-canvas"]);
    goods.forEach((m, s) => {
      const box = solidBox("market-goods", s);
      expect(m.size.x, m.key).toBeLessThanOrEqual(box.x1 - box.x0 + 1e-3);
      expect(m.size.z, m.key).toBeLessThanOrEqual(box.z1 - box.z0 + 1e-3);
      expect(m.size.y, m.key).toBeLessThanOrEqual(box.top + 1e-3);
      expect(m.size.y, m.key).toBeGreaterThan(box.top - 0.1);
      expect(streetModel(props, world("market-goods", 0, s))?.key).toBe(m.key);
    });
  });

  it("puts the goods on a stall's counter: within its top and under the canopy", () => {
    for (const m of props.byStyle.get("counter-goods")!) {
      const stall = world("market-stall", 0, 0, 0);
      for (const q of chunks(transformProp(m, pieceXform(stall, { x: 0, y: 1.03, z: 0.55 })).positions)) {
        expect(Math.abs(q.x), m.key).toBeLessThanOrEqual(1.1);
        expect(Math.abs(q.z - stall.z - 0.55), m.key).toBeLessThanOrEqual(0.3);
        expect(q.y, m.key).toBeGreaterThanOrEqual(1.02);
        expect(q.y, m.key).toBeLessThan(1.7);
      }
    }
  });

  it("hangs the booth's lanterns under its roof, in front of the noren", () => {
    const lantern = lanternModel(props)!;
    const booth = world("food-stall", 0, 0, 0);
    for (const xf of lanternXforms(booth, lantern))
      for (const q of chunks(transformProp(lantern, xf).positions)) {
        expect(q.y).toBeLessThanOrEqual(FOOD_STALL.roof);
        expect(q.y).toBeGreaterThan(1.8);
        expect(Math.abs(q.x)).toBeLessThan(1.05);
      }
  });
});

/** Points of a flat position array. */
const chunks = (positions: Float32Array | number[]) => {
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < positions.length; i += 3) out.push({ x: positions[i]!, y: positions[i + 1]!, z: positions[i + 2]! });
  return out;
};

describe("the market's dressing in the furniture's blocks (ADR-0058 stage 3)", () => {
  const pieces: StreetPropItem[] = [
    ...[0, 1, 2, 3].map((v): StreetPropItem => ({ prop: "market-goods", x: 10 + v * 4, y: 0, z: 10, yaw: 0.4, variant: v })),
    { prop: "food-stall", x: 40, y: 0, z: 10, yaw: -1, variant: 0 },
    ...Array.from({ length: 12 }, (_, k): StreetPropItem => ({ prop: "market-stall", x: 50 + k * 3, y: 0, z: 10 + (k % 2) * 3, yaw: 0, variant: k })),
  ];
  const make = (quality: "high" | "low", withProps: boolean) => {
    const scene = new Scene(new NullEngine());
    const sp = new StreetProps({ scene, materials: new ToonMaterials(scene), quality });
    sp.spawn(1, pieces, { x: 0, y: 0, z: 0 });
    sp.flush();
    if (withProps) sp.setProps(props);
    for (let i = 0; i < 5; i++) sp.update({ x: 50, y: 2, z: 12 });
    return sp.meshes.filter((m) => m.name.startsWith("props-") && !m.name.startsWith("props-far") && m.name !== "props-halo" && m.isEnabled());
  };
  const count = (ms: ReturnType<typeof make>) => ms.reduce((n, m) => n + m.getTotalVertices(), 0);

  it("bakes the models and the stalls' goods into the block's mesh: more vertices, no more meshes; phones keep the procedural ones", () => {
    const before = make("high", false);
    const after = make("high", true);
    expect(after.length).toBe(before.length);
    expect(count(after)).toBeGreaterThan(count(before));
    expect(count(make("low", true))).toBe(count(make("low", false)));
  });

  it("dresses about half the city's stalls with goods and a noren on some of the rest, lanterns on a third, all by position", () => {
    const stalls = Object.values(WORLD_STREET_PROPS)
      .flatMap((items) => toWorld(items, { x: 0, y: 0, z: 0 }))
      .filter((p) => p.prop === "market-stall");
    const share = (f: (p: (typeof stalls)[number]) => boolean) => stalls.filter(f).length / stalls.length;
    expect(share(hasCounterGoods)).toBeGreaterThan(0.4);
    expect(share(hasCounterGoods)).toBeLessThan(0.6);
    expect(share(hasNoren)).toBeGreaterThan(0.25);
    expect(share(hasNoren)).toBeLessThan(0.42);
    for (const s of stalls) expect(hasNoren(s) && hasLanterns(s)).toBe(false);
    // The three goods all show up.
    expect(new Set(stalls.filter(hasCounterGoods).map((s) => counterGoods(props, s)?.key)).size).toBe(3);
  });
});
