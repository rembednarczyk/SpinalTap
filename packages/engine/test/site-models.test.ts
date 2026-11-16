import { SITE_CABIN, SITE_FENCE, SITE_GATE, type StreetPropItem, siteFenceVariant, siteGateVariant } from "@seki/core";
import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { bakeSitePiece, siteModel } from "../src/renderer/mapcity/construction";
import { buildFar, nearSink, newBlock } from "../src/renderer/mapcity/prop-block";
import { type WorldProp, toWorld } from "../src/renderer/mapcity/prop-batch";
import type { PropPoles } from "../src/renderer/mapcity/prop-poles";
import { DRESS_FLAG } from "../src/renderer/mesh-sink";

/** The building sites' kit (ADR-0087 stage 1) as the renderer bakes it with the furniture. */

const bounds = (s: MeshSink) => {
  const at = (k: number) => s.positions.filter((_, i) => i % 3 === k);
  return { x0: Math.min(...at(0)), x1: Math.max(...at(0)), y0: Math.min(...at(1)), y1: Math.max(...at(1)), z0: Math.min(...at(2)), z1: Math.max(...at(2)) };
};

/** Vertices of a sink that are self-lit (the LED strips, the holograms, the windows). */
const lit = (s: MeshSink) => Array.from({ length: s.vertexCount }, (_, i) => s.colors[i * 4 + 3]!).filter((a) => Math.abs(a - DRESS_FLAG.lit) < 1e-6).length;

const poles = { isPole: () => false, pole: null, props: null, models: null, dog: null, far: null } as unknown as PropPoles;

describe("the building sites' kit in the renderer (ADR-0087)", () => {
  it("draws a fence panel along its local x at its length and height, from under the ground, the LED on top and the ad on the street side", () => {
    const plain = siteModel("site-fence", siteFenceVariant({ length: 2.3, rise: 0, ad: null, led: 0 }), "high");
    const b = bounds(plain);
    expect(b.x1 - b.x0).toBeCloseTo(2.3 + 2 * SITE_FENCE.post, 5);
    expect(b.y1).toBeCloseTo(SITE_FENCE.height, 5);
    expect(b.y0).toBeLessThan(0);
    const ad = siteModel("site-fence", siteFenceVariant({ length: 2.3, rise: 0, ad: 2, led: 0 }), "high");
    expect(lit(ad)).toBeGreaterThan(lit(plain));
    // The hologram faces the street (+z), off the hoarding.
    const litZ = (m: MeshSink) => Math.max(...Array.from({ length: m.vertexCount }, (_, i) => (Math.abs(m.colors[i * 4 + 3]! - DRESS_FLAG.lit) < 1e-6 ? m.positions[i * 3 + 2]! : -Infinity)));
    expect(litZ(ad)).toBeGreaterThan(SITE_FENCE.thick / 2 + 0.01);
    expect(litZ(plain)).toBeLessThan(SITE_FENCE.thick / 2 + 0.011);
    // On a slope the panel climbs with the ground.
    const slope = bounds(siteModel("site-fence", siteFenceVariant({ length: 2.5, rise: 1, ad: null, led: 0 }), "high"));
    expect(slope.y1).toBeCloseTo(SITE_FENCE.height + 0.5, 1);
    // The phones go without the hazard band.
    expect(siteModel("site-fence", siteFenceVariant({ length: 2.3, rise: 0, ad: null, led: 0 }), "low").vertexCount).toBeLessThan(plain.vertexCount);
  });

  it("draws the gate's opening clear between its posts and its leaf behind the fence, a cabin at its size", () => {
    const gate = siteModel("site-gate", siteGateVariant(false, 1, true), "high");
    const b = bounds(gate);
    expect(b.z0).toBeLessThan(-0.15);
    expect(b.y1).toBeCloseTo(SITE_GATE.height, 5);
    // Nothing between the posts below the beam, on the fence's line.
    const inOpening = Array.from({ length: gate.vertexCount }, (_, i) => [gate.positions[i * 3]!, gate.positions[i * 3 + 1]!, gate.positions[i * 3 + 2]!] as const).filter(
      ([x, y, z]) => Math.abs(x) < SITE_GATE.gate / 2 - 0.01 && y < SITE_GATE.height - 0.3 && z > -0.1,
    );
    expect(inOpening).toEqual([]);
    const cabin = bounds(siteModel("site-cabin", 1, "high"));
    expect([cabin.x1 - cabin.x0, cabin.y1]).toEqual([expect.closeTo(2 * SITE_CABIN.hx + 0.12, 5), expect.closeTo(SITE_CABIN.height, 5)]);
  });

  it("bakes into the block's mesh with the furniture at its own variant, near only", () => {
    const item: StreetPropItem = { prop: "site-fence", x: 5200, y: 2, z: 5200, yaw: Math.PI / 2, variant: siteFenceVariant({ length: 2, rise: 0, ad: 1, led: 3 }) };
    const [p] = toWorld([item], { x: 0, y: 0, z: 0 }) as [WorldProp];
    expect(p.variant).toBe(item.variant);
    const sink = new MeshSink();
    bakeSitePiece(sink, p, "high");
    const b = bounds(sink);
    // Turned a quarter: along the world's z.
    expect(b.z1 - b.z0).toBeCloseTo(2 + 2 * SITE_FENCE.post, 5);
    const block = { ...newBlock("20:20"), pieces: new Map([[1, [p]]]) };
    expect(nearSink({ quality: "high", poles }, block).vertexCount).toBe(sink.vertexCount);
    buildFar({ scene: null as never, materials: null as never, quality: "high", poles }, block);
    expect(block.far).toBeNull();
  });
});
