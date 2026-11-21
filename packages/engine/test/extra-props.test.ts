// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import type { StreetPropItem } from "@seki/core";
import { describe, expect, it } from "vitest";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { streetModel } from "../src/renderer/mapcity/street-models";
import { toWorld } from "../src/renderer/mapcity/prop-batch";

/** The extra CC-BY props of `extra-props.glb` (ADR-0096 stage 1, `tools/city_extras.py`). */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const bytes = file("extra-props.glb");
const extras = parseCityProps(bytes);
const props = mergeCityProps(mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("street-props.glb"))), extras);

const KEYS = [
  "ex-barrier-concrete",
  "ex-barrier-red",
  "ex-railing-a",
  "ex-railing-a-bent",
  "ex-railing-b",
  "ex-railing-b-bent",
  "ex-cone",
  "ex-barrel",
  "ex-bin-boarded",
  "ex-bag-a",
  "ex-bag-b",
  "ex-box-a",
  "ex-box-b",
  "ex-bottle",
  "ex-cup",
  "ex-hydrant",
  "ex-atm-wall",
  "ex-dish",
  "ex-exit-door",
  "ex-blade-frame",
  "ex-blade-narrow",
  "ex-blade-led",
];

/** Real heights (m) the models were scaled to. */
const HEIGHTS: Readonly<Record<string, number>> = { "ex-barrier-concrete": 0.81, "ex-cone": 0.75, "ex-hydrant": 0.9, "ex-dish": 3.4, "ex-exit-door": 2.1 };

describe("extra-props.glb (ADR-0096 stage 1)", () => {
  it("holds one model per thing, CC-BY with its credit, under the 6 thousand triangles and small", () => {
    expect([...extras.models.keys()]).toEqual(KEYS);
    for (const m of extras.models.values()) expect(triangleCount(m), m.key).toBeLessThanOrEqual(6000);
    expect(bytes.byteLength).toBeLessThan(2.5 * 1024 * 1024);
    expect(extras.swatches).toEqual(props.swatches);
    const json = new TextDecoder().decode(new Uint8Array(bytes, 20, new DataView(bytes, 12, 4).getUint32(0, true)));
    for (const id of ["sketchfab-street-asset-pack", "sketchfab-mini-atm", "sketchfab-satellite-comms", "sketchfab-fire-escape-doors", "sketchfab-taiwan-signboard", "sketchfab-cyberpunk-led-neon-sign"]) expect(json).toContain(`"credit":"${id}"`);
  });

  it("stands each model on the ground at its real height", () => {
    for (const [key, h] of Object.entries(HEIGHTS)) expect(extras.models.get(key)!.size.y, key).toBeCloseTo(h, 2);
    // On the ground, but the cash machine in a wall: its bottom 0.8 m up (`LIFT` of the bake).
    for (const m of extras.models.values()) {
      let lo = Infinity;
      for (let i = 1; i < m.positions.length; i += 3) lo = Math.min(lo, m.positions[i]!);
      expect(lo, m.key).toBeCloseTo(m.key === "ex-atm-wall" ? 0.8 : 0, 3);
    }
  });

  it("names in `sources.json` only models the file has, each under its pack", () => {
    const sources = (JSON.parse((readFileSync as (url: URL, enc: string) => string)(new URL("../../../tools/assets/sources.json", import.meta.url), "utf8")) as {
      sources: { id: string; used?: string[] }[];
    }).sources;
    const used = sources.flatMap((s) => (s.used ?? []).filter((k) => k.startsWith("ex-")).map((k) => ({ id: s.id, k })));
    expect(used.map((u) => u.k).sort()).toEqual([...KEYS].sort());
    expect(used.find((u) => u.k === "ex-dish")!.id).toBe("sketchfab-satellite-comms");
  });

  it("puts the second hydrant in the hydrants' pool, by position", () => {
    const at = (x: number): StreetPropItem => ({ prop: "hydrant", x, y: 0, z: 0, yaw: 0, variant: 0 });
    const picked = new Set(Array.from({ length: 40 }, (_, i) => streetModel(props, toWorld([at(i * 7.3)], { x: 0, y: 0, z: 0 })[0]!)?.key));
    expect([...picked].sort()).toEqual(["ex-hydrant", "st-hydrant"]);
  });
});
