// @ts-expect-error The engine is typed for the browser; the test reads the file off disk.
import { readFileSync } from "node:fs";
import { FIGURE_BODIES, FIGURE_POSES, FIGURE_SEAT, FIGURE_SEATS, type FigureLayout, type StreetPropKind, figureVariant } from "@seki/core";
import { describe, expect, it } from "vitest";
import { hexColor } from "../src/renderer/mesh-sink";
import { mergeCityProps, parseCityProps, triangleCount } from "../src/renderer/city-props";
import { MeshSink } from "../src/renderer/mesh-sink";
import { FIGURE_COLORS, bakeFigure, drawnOnPhone, figureModel } from "../src/renderer/mapcity/figure-models";
import type { WorldProp } from "../src/renderer/mapcity/prop-batch";
import { buildPropModel } from "../src/renderer/mapcity/prop-models";

/**
 * The still crowd of ADR-0058 stage 8: the people of `crowd-props.glb` (Quaternius, CC0), the seats of
 * the furniture they sit on, and the figures the renderer bakes from a piece.
 */

const file = (name: string): ArrayBuffer => {
  const b = (readFileSync as (url: URL) => Uint8Array)(new URL(`../../app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const crowdBytes = file("crowd-props.glb");
const crowd = parseCityProps(crowdBytes);
const props = mergeCityProps(parseCityProps(file("city-props.glb")), crowd);
/** The node extras of the file, by key. */
const extras = new Map(
  (
    JSON.parse(new TextDecoder().decode(new Uint8Array(crowdBytes, 20, new DataView(crowdBytes, 12, 4).getUint32(0, true)))) as {
      nodes: { name: string; extras: { seat?: number } }[];
    }
  ).nodes.map((n) => [n.name, n.extras]),
);

const piece = (f: FigureLayout, y = 0): WorldProp => ({ prop: "figure", x: 0, y, z: 0, yaw: 0, shape: 0, scale: 1, variant: figureVariant(f) });
const ys = (s: MeshSink) => s.positions.filter((_, i) => i % 3 === 1);

/** The top of a model's surfaces right over (x, z), under `below`: the highest triangle there. */
const topAt = (s: MeshSink, x: number, z: number, below: number): number => {
  let best = -Infinity;
  for (let t = 0; t < s.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => {
      const i = s.indices[t + k]! * 3;
      return { x: s.positions[i]!, y: s.positions[i + 1]!, z: s.positions[i + 2]! };
    }) as [{ x: number; y: number; z: number }, { x: number; y: number; z: number }, { x: number; y: number; z: number }];
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-9) continue;
    const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
    const y = u * a.y + v * b.y + (1 - u - v) * c.y;
    if (y <= below) best = Math.max(best, y);
  }
  return best;
};

describe("crowd-props.glb (ADR-0058 stage 8)", () => {
  it("has every pose of both builds, the phones' cheap version of each, light and on the props' palette", () => {
    for (const pose of FIGURE_POSES)
      for (const body of FIGURE_BODIES) {
        const f = { pose, body, seat: 0.45, look: 0 };
        expect(figureModel(props, f, false), `${pose} ${body}`).not.toBeNull();
        expect(figureModel(props, f, true)!.styles).toContain("lite");
      }
    for (const m of crowd.models.values()) expect(triangleCount(m), m.key).toBeLessThanOrEqual(m.styles.includes("lite") ? 260 : 1100);
    expect(crowdBytes.byteLength).toBeLessThan(360 * 1024);
    expect(crowd.swatches).toEqual(props.swatches);
  });

  it("seats its sitters as the core's FIGURE_SEAT says, and keeps a standing figure's hand", () => {
    for (const m of crowd.models.values()) {
      const [, pose, build] = /^cr-(\w+)-([ab])\d/.exec(m.key)!;
      if (pose === "sit" || pose === "perch") {
        expect(extras.get(m.key)?.seat, m.key).toBe(FIGURE_SEAT[pose][build as "a" | "b"]);
        // The seat's middle is the origin: the model's lowest point is its feet, `seat` under it.
        expect(Math.min(...Array.from(m.positions).filter((_, i) => i % 3 === 1))).toBeCloseTo(-FIGURE_SEAT[pose][build as "a" | "b"], 1);
      } else expect(m.lights?.length, m.key).toBe(1);
    }
  });
});

describe("the seats of the furniture (ADR-0058 stage 8)", () => {
  it("lie on the tops of the models the renderer draws", () => {
    for (const [kind, seats] of Object.entries(FIGURE_SEATS) as [StreetPropKind, NonNullable<(typeof FIGURE_SEATS)[StreetPropKind]>][]) {
      for (const shape of kind === "bench" ? [0, 1] : [0]) {
        const model = buildPropModel(kind, shape).sink;
        for (const s of seats(shape)) {
          // Round the hips' middle (a bench's slats 0.1 m apart): the seat is under them, a back or a table over them is not.
          for (const [dx, dz] of [
            [0, 0],
            [0.08, 0.1],
            [-0.08, -0.1],
          ] as const)
            expect(topAt(model, s.x + dx, s.z + dz, s.top + 0.1), `${kind} ${shape} at ${s.x}, ${s.z}`).toBeCloseTo(s.top, 2);
        }
      }
    }
  });
});

describe("the still figures the renderer bakes (ADR-0058 stage 8)", () => {
  it("puts a sitter's hips on its seat and its feet the model's seat under them, a standing one's soles on its foot", () => {
    const sink = new MeshSink();
    expect(bakeFigure(sink, props, piece({ pose: "sit", body: "a", seat: 0.45, look: 0 }, 2), "high")).toBe(true);
    expect(Math.min(...ys(sink))).toBeCloseTo(2 + 0.45 - FIGURE_SEAT.sit.a, 2);
    const stand = new MeshSink();
    bakeFigure(stand, props, piece({ pose: "stand", body: "b", seat: 0, look: 4 }, 2), "high");
    expect(Math.min(...ys(stand))).toBeCloseTo(2, 1);
    expect(Math.max(...ys(stand))).toBeGreaterThan(2 + 1.6);
  });

  it("paints the parts from the look: a skin of its tones, clothes off the palette, never the pack's own colours", () => {
    const skins = FIGURE_COLORS.skin.map((h) => hexColor(h).slice(0, 3).join(","));
    const seen = new Set<string>();
    for (let look = 0; look < 32; look++) {
      const sink = new MeshSink();
      bakeFigure(sink, props, piece({ pose: "stand", body: look % 2 ? "a" : "b", seat: 0, look }), "high");
      const colors = new Set<string>();
      for (let i = 0; i < sink.colors.length; i += 4) colors.add(sink.colors.slice(i, i + 3).join(","));
      const skin = [...colors].filter((c) => skins.includes(c));
      expect(skin.length, `look ${look}`).toBe(1);
      seen.add(skin[0]!);
    }
    // Over the looks every tone shows.
    expect(seen.size).toBe(FIGURE_COLORS.skin.length);
  });

  it("gives a smoker an ember in its hand, and nobody before the file loads", () => {
    const plain = new MeshSink();
    const smoker = new MeshSink();
    bakeFigure(plain, props, piece({ pose: "stand", body: "a", seat: 0, look: 2 }), "high");
    bakeFigure(smoker, props, piece({ pose: "smoke", body: "a", seat: 0, look: 2 }), "high");
    expect(smoker.vertexCount).toBeGreaterThan(plain.vertexCount);
    const empty = new MeshSink();
    expect(bakeFigure(empty, null, piece({ pose: "sit", body: "a", seat: 0.45, look: 0 }), "high")).toBe(false);
    expect(empty.empty).toBe(true);
  });

  it("draws half the figures on phones, each the cheap model", () => {
    let drawn = 0;
    for (let look = 0; look < 32; look++) {
      const f = { pose: "hips" as const, body: "b" as const, seat: 0, look };
      const sink = new MeshSink();
      const did = bakeFigure(sink, props, piece(f), "low");
      expect(did).toBe(drawnOnPhone(f));
      if (did) {
        drawn++;
        expect(sink.indices.length / 3).toBeLessThanOrEqual(260);
      }
    }
    expect(drawn).toBe(16);
  });
});
