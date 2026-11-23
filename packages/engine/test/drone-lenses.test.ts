// @ts-expect-error The engine is typed for the browser; the test reads the kit off disk.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCityKit, swatchUv } from "../src/renderer/city-kit-data";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { boxDrone, propsDrone } from "../src/renderer/drones/drone-models";
import { withLenses } from "../src/renderer/drones/drone-lenses";
import { PATROL_FLASH, patrolTemplates } from "../src/renderer/drones/patrol-models";
import { ToonPointLights } from "../src/npr/toon-point-lights";
import { MAX_POINT_LIGHTS } from "../src/npr/toon-shader";

/*
 * The drones' lights as lenses (the user's note of 22.11: lamps, not blocks): no triangle of a light's swatch is left of
 * the old boxes, every lens faces out as the kit's boxes do, the patrol's bar flashes red and blue in turn and its
 * navigation lights do not.
 */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const data = parseCityKit(file("city-kit.glb"));
const props = mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("drone-props.glb")));

type T = { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array };
const p = (t: T, v: number) => [t.positions[v * 3]!, t.positions[v * 3 + 1]!, t.positions[v * 3 + 2]!] as const;
/** Each triangle's face normal against its first vertex's normal: +1 out as wound, -1 in, 0 degenerate. */
const facing = (t: T, i: number): number => {
  const [a, b, c] = [p(t, t.indices[i]!), p(t, t.indices[i + 1]!), p(t, t.indices[i + 2]!)];
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [u[1]! * w[2]! - u[2]! * w[1]!, u[2]! * w[0]! - u[0]! * w[2]!, u[0]! * w[1]! - u[1]! * w[0]!];
  const len = Math.hypot(n[0]!, n[1]!, n[2]!);
  if (len < 1e-9) return 0;
  const v = t.indices[i]!;
  return Math.sign(n[0]! * t.normals[v * 3]! + n[1]! * t.normals[v * 3 + 1]! + n[2]! * t.normals[v * 3 + 2]!);
};
const onSwatch = (t: T, v: number, s: string) => {
  const uv = swatchUv(data, s);
  return Math.abs(t.uvs[v * 2]! - uv[0]) < 1e-4 && Math.abs(t.uvs[v * 2 + 1]! - uv[1]) < 1e-4;
};

describe("the drones' lights as lenses", () => {
  for (const [name, model] of [
    ["the patrol's model", propsDrone(data, props, "patrol")!],
    ["the patrol's boxes", boxDrone(data, "patrol")],
  ] as const) {
    it(`draws ${name}'s lights as lenses, wound as the kit's boxes`, () => {
      const box = boxDrone(data, "patrol");
      const out = Array.from({ length: box.indices.length / 3 }, (_, k) => facing(box, k * 3)).find((s) => s !== 0)!;
      const lensed = withLenses(data, model, PATROL_FLASH);
      // The old boxes' light triangles are gone: what is on a light's swatch now is the lenses' (past the model's vertices).
      for (let i = 0; i < lensed.indices.length; i += 3) {
        const v = lensed.indices[i]!;
        if (["neon-red", "neon-blue", "neon-green"].some((s) => onSwatch(lensed, v, s))) expect(v).toBeGreaterThanOrEqual(model.vertexCount);
      }
      const added = Array.from({ length: lensed.indices.length / 3 }, (_, k) => k * 3).filter((i) => lensed.indices[i]! >= model.vertexCount);
      expect(added.length).toBeGreaterThan(100);
      for (const i of added) expect(facing(lensed, i), `triangle ${i}`).not.toBe(-out);
    });
  }

  it("flashes the patrol's bar, red and blue half a cycle apart, its fans' lights steady", () => {
    const { near } = patrolTemplates(data, props);
    expect(near.flashes?.map((f) => f.phase).sort()).toEqual([0, 0.5]);
    for (const f of near.flashes ?? []) {
      const ys = Array.from({ length: f.to - f.from }, (_, k) => near.positions[(f.from + k) * 3 + 1]!);
      // On the drone's top.
      expect(Math.min(...ys)).toBeGreaterThan(0.1);
    }
  });

  it("gives the searchlight a shader slot before the street's lamps registered earlier (its priority)", () => {
    const lights = new ToonPointLights();
    lights.setFocus(0, 0);
    for (let k = 0; k < MAX_POINT_LIGHTS; k++) lights.add(`lamp-${k}`, { position: { x: k, y: 5, z: 0 }, color: "#ffffff", range: 10, intensity: 1 });
    const search = { position: { x: 0, y: 3, z: 0 }, color: "#e2ecff", range: 6, intensity: 1.6, priority: 1 };
    lights.add("drone-searchlight", search);
    expect(lights.count).toBe(MAX_POINT_LIGHTS);
    const slots: unknown[] = [];
    const m = { setArray4: (n: string, v: number[]) => n === "pointPos" && slots.push(v.slice(0, 4)), setArray2: () => undefined, setFloat: () => undefined };
    lights.apply(m as never);
    expect(slots[0]).toEqual([0, 3, 0, 6]);
  });
});
