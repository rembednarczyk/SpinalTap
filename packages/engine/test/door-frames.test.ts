// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { type BuildingUse, DOOR_MODELS, type DoorModel, doorVariant } from "@seki/core";
import { describe, expect, it } from "vitest";
import { mergeCityProps, parseCityProps } from "../src/renderer/city-props";
import { MeshSink } from "../src/renderer/mesh-sink";
import { planNearFrames } from "../src/renderer/mapcity/cell-plan";
import { bakeDoor } from "../src/renderer/mapcity/door-models";
import { type MapBuilding, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { facadeStyle } from "../src/renderer/mapcity/facade-style";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import type { WorldProp } from "../src/renderer/mapcity/prop-batch";

/**
 * The doors' surrounds (G-270): a frame that reads apart from the leaf and from the wall from a few
 * metres, on the facades' doors (ADR-0058 stage 9, with the leaves of `door-props.glb` and without)
 * and round the game's doorways (the clinic, Neon Koi, the capsule room). Measured on the baked
 * vertices, not on the renderer's constants.
 */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const props = mergeCityProps(parseCityProps(file("city-props.glb")), parseCityProps(file("door-props.glb")));

/** Relative luminance of a vertex colour (linear from sRGB). */
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luma = (r: number, g: number, b: number) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hexLuma = (hex: string) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return luma(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

interface V {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly key: string;
  readonly l: number;
  /** Self-lit (a pane, a code panel): left out of a leaf's tone. */
  readonly lit: boolean;
}
const verts = (s: MeshSink): V[] =>
  Array.from({ length: s.vertexCount }, (_, i) => {
    const c = s.colors.slice(i * 4, i * 4 + 3);
    return { x: s.positions[i * 3]!, y: s.positions[i * 3 + 1]!, z: s.positions[i * 3 + 2]!, key: c.map((v) => v.toFixed(3)).join(","), l: luma(c[0]!, c[1]!, c[2]!), lit: s.colors[i * 4 + 3] !== 1 };
  });
const mean = (vs: readonly V[]) => vs.reduce((s, v) => s + v.l, 0) / vs.length;

const piece = (model: DoorModel, width: number, height: number): WorldProp => ({ prop: "door", x: 0, y: 0, z: 0, yaw: 0, shape: DOOR_MODELS.indexOf(model), scale: 1, variant: doorVariant({ model, width, height }) });

/** The plasters of every facade a door may stand on (no church's). */
const PLASTERS = [
  ...new Set(
    (["residential", "commercial", "historic", "other", "civic", "industrial", "garage"] as BuildingUse[]).flatMap((use) =>
      Array.from({ length: 200 }, (_, look) => facadeStyle({ use, levels: 4, height: 16, roof: 4, look, area: 300, width: 12 }).plaster),
    ),
  ),
];

/** A door's jambs, its leaf and how they read: the jamb's colour is the one on its outer face at x = w/2. */
const measure = (sink: MeshSink, w: number, h: number) => {
  const vs = verts(sink);
  const jamb = vs.find((v) => Math.abs(v.x - w / 2) < 1e-3 && v.y > 0.5)!;
  const frame = vs.filter((v) => v.key === jamb.key);
  const inner = Math.min(...frame.filter((v) => v.x > 0 && v.y < h - 0.3).map((v) => v.x));
  // Between the jambs, over the sill and under the lintel, painted (not a pane or a panel).
  const leaf = vs.filter((v) => Math.abs(v.x) <= inner + 1e-3 && v.y > 0.04 && v.y < h - 0.14 + 1e-3 && v.key !== jamb.key && !v.lit);
  return { jamb: w / 2 - inner, frameLuma: jamb.l, leafLuma: mean(leaf), leafWidth: 2 * inner, frameFront: Math.max(...frame.map((v) => v.z)), leafFront: Math.max(...leaf.map((v) => v.z)) };
};

describe("the surround of a facade's door (G-270)", () => {
  for (const withFile of [true, false]) {
    it(`is wider than a hairline, light against its leaf and the plaster, out in front of the leaf, with${withFile ? "" : "out"} the leaves' file`, () => {
      for (const model of DOOR_MODELS) {
        for (const [w, h] of [
          [1.2, 2.3],
          [2.6, 3.2],
        ] as const) {
          const sink = new MeshSink();
          bakeDoor(sink, withFile ? props : null, piece(model, w, h));
          const m = measure(sink, w, h);
          const at = `${model} ${w}x${h}`;
          expect(m.jamb, at).toBeGreaterThanOrEqual(0.12);
          expect(m.jamb, at).toBeLessThanOrEqual(0.15);
          expect(m.frameLuma - m.leafLuma, at).toBeGreaterThan(0.4);
          for (const p of PLASTERS) expect(Math.abs(m.frameLuma - hexLuma(p)), `${at} on ${p}`).toBeGreaterThan(0.1);
          // Out from the wall's face (z = 0) and a step in front of the leaf: the ink outlines both.
          expect(m.frameFront, at).toBeGreaterThan(0.05);
          expect(m.frameFront - m.leafFront, at).toBeGreaterThanOrEqual(0.03);
        }
      }
    });
  }

  it("leaves a narrow door a leaf to walk through: its jambs get thinner", () => {
    for (const model of DOOR_MODELS) {
      const sink = new MeshSink();
      bakeDoor(sink, props, piece(model, 0.8, 2.4));
      expect(measure(sink, 0.8, 2.4).leafWidth, model).toBeGreaterThanOrEqual(0.6);
    }
  });
});

const rect = (x0: number, z0: number, x1: number, z1: number) => cleanRing([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);
const building = (shopfront: boolean): MapBuilding => ({
  id: 7,
  ring: rect(0, 0, 18, 12),
  base: 0,
  foot: 0,
  height: 16,
  levels: 4,
  use: "residential",
  look: 1241,
  roof: 4,
  shopfront,
  // The game's door in the wall along z = 0 (its outside is -z), 1.6 m wide, 2.6 m tall.
  doorways: [{ x: 9, z: 0, width: 1.6, bottom: 0, top: 2.6 }],
});

describe("the surround of the game's doorways (G-270)", () => {
  for (const shopfront of [true, false]) {
    it(`frames the opening on the wall's face, out from it and light against the plaster, never in it (${shopfront ? "a shop front" : "a tenement"})`, () => {
      const f = facadeFrame(building(shopfront), () => null);
      const sink = new MeshSink();
      planNearFrames(sink, [f], true, undefined, () => []);
      const vs = verts(sink);
      const plaster = hexLuma(f.style.plaster);
      // In front of the wall and apart from its plaster; a box has its vertices at its corners.
      const framed = vs.filter((v) => v.z < -0.05 && Math.abs(v.l - plaster) > 0.1);
      for (const [x0, x1] of [
        [8.2 - 0.15, 8.2],
        [9.8, 9.8 + 0.15],
      ] as const) {
        // A jamb beside the opening from the floor to over its top, at least 12 cm wide.
        const j = framed.filter((v) => v.x >= x0 - 1e-3 && v.x <= x1 + 1e-3 && v.y > -1e-3);
        expect(j.length, `${x0}`).toBeGreaterThan(0);
        expect(Math.min(...j.map((v) => v.y)), `${x0}`).toBeLessThan(0.01);
        expect(Math.max(...j.map((v) => v.y)), `${x0}`).toBeGreaterThan(2.7);
        expect(Math.max(...j.map((v) => v.x)) - Math.min(...j.map((v) => v.x)), `${x0}`).toBeGreaterThanOrEqual(0.12);
      }
      // A lintel over it, its underside at the opening's top.
      expect(framed.filter((v) => v.x > 8.2 - 1e-3 && v.x < 9.8 + 1e-3 && Math.abs(v.y - 2.6) < 1e-3).length).toBeGreaterThan(0);
      // Nothing in the opening the bodies walk through.
      expect(vs.filter((v) => v.x > 8.21 && v.x < 9.79 && v.y > 0.05 && v.y < 2.55 && Math.abs(v.z) < 0.3)).toEqual([]);
    });
  }
});
