// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { furniturePrisms } from "@seki/sim";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { mergeCityProps, parseCityProps, transformProp, triangleCount } from "../src/renderer/city-props";
import type { MeshSink } from "../src/renderer/mesh-sink";
import { ToonMaterials } from "../src/npr/toon-material";
import { RACK_SHAPES } from "../src/renderer/mapcity/prop-e2";
import { buildPropModel } from "../src/renderer/mapcity/prop-models";
import { PROP_SHAPES, bandOf } from "../src/renderer/mapcity/prop-shapes";
import { rackXforms, streetModel } from "../src/renderer/mapcity/street-models";
import { StreetProps } from "../src/renderer/mapcity/street-props";

/** The procedural street furniture of ADR-0058 stage 2 (phones, and before the props files load). */

/** Half sides and top of a kind's solid in the simulation, unturned. */
const solidBox = (prop: StreetPropKind) => {
  const prisms = furniturePrisms({ prop, x: 0, y: 0, z: 0, yaw: 0, variant: 0 });
  const pts = prisms.flatMap((p) => p.points);
  return { hx: Math.max(...pts.map((q) => Math.abs(q.x))), hz: Math.max(...pts.map((q) => Math.abs(q.z))), top: Math.max(...prisms.map((p) => p.top)) };
};

const bounds = (s: MeshSink) => {
  const at = (k: number) => s.positions.filter((_, i) => i % 3 === k);
  return { x: Math.max(...at(0).map(Math.abs)), y: Math.max(...at(1)), z: Math.max(...at(2).map(Math.abs)) };
};

describe("procedural street furniture of ADR-0058 stage 2", () => {
  it("draws each new kind inside its solid and about as big", () => {
    for (const kind of ["atm", "hydrant", "food-cart", "container", "bike-rack"] as const) {
      const box = solidBox(kind);
      for (let s = 0; s < (PROP_SHAPES[kind] ?? 1); s++) {
        const b = bounds(buildPropModel(kind, s).sink);
        expect(b.x, `${kind}:${s}`).toBeLessThanOrEqual(box.hx + 0.03);
        expect(b.z, `${kind}:${s}`).toBeLessThanOrEqual(box.hz + 0.03);
        expect(b.y, `${kind}:${s}`).toBeLessThanOrEqual(box.top + 0.03);
        expect(b.y, `${kind}:${s}`).toBeGreaterThan(box.top * 0.75);
      }
    }
  });

  it("parks bikes at the racks by their shape, and draws hydrants only close by", () => {
    expect(RACK_SHAPES).toHaveLength(PROP_SHAPES["bike-rack"]!);
    const verts = RACK_SHAPES.map((_, s) => buildPropModel("bike-rack", s).sink.vertexCount);
    // Two bikes, one, the other, a bike and a scooter (a bike on phones).
    expect(verts[1]).toBe(verts[2]);
    expect(verts[0]).toBeGreaterThan(verts[1]!);
    expect(bandOf("hydrant")).toBe("small");
    expect(bandOf("container")).toBe("medium");
  });
});

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const props = mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("street-props.glb")));

/** World positions of a model placed by an xform. */
const corners = (positions: Float32Array | number[]) => {
  const out: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < positions.length; i += 3) out.push({ x: positions[i]!, y: positions[i + 1]!, z: positions[i + 2]! });
  return out;
};

const KINDS = ["atm", "hydrant", "food-cart", "container"] as const;

describe("street furniture models of ADR-0058 stage 2 (street-props.glb)", () => {
  it("has a light model for each new kind, the parked bike and scooter and a planter, each inside its solid", () => {
    for (const kind of [...KINDS, "planter", "parked-bike", "parked-scooter"]) {
      const models = props.byStyle.get(kind) ?? [];
      expect(models.length, kind).toBeGreaterThan(0);
      for (const m of models) expect(triangleCount(m), m.key).toBeLessThanOrEqual(1000);
    }
    expect(props.byStyle.get("container")!.map((m) => m.key)).toEqual(["st-container-rust", "st-container-dumpster"]);
    for (const kind of KINDS) {
      const box = solidBox(kind);
      for (const m of props.byStyle.get(kind)!) {
        expect(m.size.x / 2, m.key).toBeLessThanOrEqual(box.hx);
        expect(m.size.z / 2, m.key).toBeLessThanOrEqual(box.hz);
        expect(m.size.y, m.key).toBeLessThanOrEqual(box.top);
        expect(m.size.y, m.key).toBeGreaterThan(box.top * 0.9);
      }
    }
  });

  it("parks the bikes and the scooter across a rack's hoops, inside the rack's solid", () => {
    const box = solidBox("bike-rack");
    const rack = { prop: "bike-rack" as const, x: 10, y: 1, z: -4, yaw: 0.7, shape: 3, scale: 1 };
    const parked = rackXforms(props, rack);
    expect(parked.map((b) => b.model.key)).toEqual(["st-bike", "st-scooter"]);
    expect(rackXforms(props, { ...rack, shape: 1 }).map((b) => b.model.key)).toEqual(["st-bike"]);
    expect(rackXforms(null, rack)).toEqual([]);
    const c = Math.cos(rack.yaw);
    const s = Math.sin(rack.yaw);
    for (const b of parked)
      for (const q of corners(transformProp(b.model, b.xf).positions)) {
        // Back into the rack's frame (`turnLocal` inverted).
        const dx = q.x - rack.x;
        const dz = q.z - rack.z;
        expect(Math.abs(dx * c - dz * s)).toBeLessThanOrEqual(box.hx + 1e-3);
        expect(Math.abs(dx * s + dz * c)).toBeLessThanOrEqual(box.hz + 1e-3);
        expect(q.y - rack.y).toBeLessThanOrEqual(box.top + 1e-3);
      }
  });

  it("bakes them into the block's mesh where the pieces stand: more vertices, no more meshes; phones keep the procedural ones", () => {
    const piece = (prop: StreetPropKind, x: number, variant = 0): StreetPropItem => ({ prop, x, y: 0, z: 10, yaw: 0.4, variant });
    const pieces = [piece("atm", 10), piece("hydrant", 20), piece("food-cart", 35), piece("container", 55, 1), piece("planter", 75), piece("bike-rack", 90, 3)];
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
    const before = make("high", false);
    const after = make("high", true);
    expect(after.length).toBe(before.length);
    expect(count(after)).not.toBe(count(before));
    expect(count(make("low", true))).toBe(count(make("low", false)));
    for (const p of pieces.slice(0, 5)) expect(streetModel(props, { ...p, shape: p.variant % (PROP_SHAPES[p.prop] ?? 1), scale: 1 })?.styles, p.prop).toContain(p.prop);
    expect(streetModel(props, { ...pieces[3]!, shape: 1, scale: 1 })?.key).toBe("st-container-dumpster");
  });
});
