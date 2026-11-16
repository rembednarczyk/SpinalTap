import { SITE_FENCE, SITE_GATE, SITE_LEAF, siteFenceLayout, siteGateLayout } from "@seki/core";
import { MeshSink } from "../../mesh-sink";
import type { RenderQuality } from "../../../npr/quality";
import { ADS, GRAPHITE, GRAPHITE_LIGHT, HAZARD, HAZARD_DARK, LEDS, STEEL, facing, slab } from "./site-slab";

/**
 * A stretch of a building site's fence (ADR-0087 stage 1): a graphite hoarding between two posts,
 * a hazard band at its foot on the street side, the LED strip along its top and, on every few
 * panels, a developer's hologram on the street side. The phones (`low`) go without the band.
 */
export const fenceModel = (variant: number, quality: RenderQuality): MeshSink => {
  const f = siteFenceLayout(variant);
  const sink = new MeshSink();
  const s = { rise: f.rise, length: f.length };
  const [hl, ht, top] = [f.length / 2, SITE_FENCE.thick / 2, SITE_FENCE.height];
  slab(sink, s, -hl, hl, -ht, ht, 0, top - 0.06, GRAPHITE);
  for (const x of [-hl, hl]) slab(sink, s, x - SITE_FENCE.post, x + SITE_FENCE.post, -ht - 0.03, ht + 0.03, 0, top, GRAPHITE_LIGHT);
  slab(sink, s, -hl, hl, -ht - 0.01, ht + 0.01, top - 0.06, top, LEDS[f.led]!);
  if (quality !== "low") facing(sink, s, ht + 0.005, -hl + 0.05, hl - 0.05, 0.05, 0.25, HAZARD);
  if (f.ad !== null && f.length > 1.2) {
    const [field, band] = ADS[f.ad]!;
    const [x0, x1] = [-hl + 0.2, hl - 0.2];
    facing(sink, s, ht + 0.012, x0, x1, 0.55, 1.85, field);
    facing(sink, s, ht + 0.018, x0 + 0.1, x1 - 0.1, 1.45, 1.6, band);
    facing(sink, s, ht + 0.018, x0 + 0.1, x0 + 0.1 + (x1 - x0 - 0.2) * 0.55, 0.8, 0.9, band);
  }
  return sink;
};

/**
 * The open gate: two posts with hazard stripes, a beam over the opening carrying the LED strip,
 * and the leaf of mesh in a steel frame slid behind the fence on its side (`leaf`).
 */
export const gateModel = (variant: number): MeshSink => {
  const g = siteGateLayout(variant);
  const sink = new MeshSink();
  const flat = { rise: 0, length: 1 };
  const [hw, p, h] = [g.width / 2, SITE_GATE.post, SITE_GATE.height];
  for (const x of [-hw - p, hw + p]) {
    slab(sink, flat, x - p, x + p, -p, p, 0, h, HAZARD_DARK);
    for (let k = 0; k < 4; k++) slab(sink, flat, x - p - 0.005, x + p + 0.005, -p - 0.005, p + 0.005, 0.3 + k * 0.5, 0.55 + k * 0.5, HAZARD);
  }
  slab(sink, flat, -hw - 2 * p, hw + 2 * p, -0.08, 0.08, h - 0.22, h, GRAPHITE_LIGHT);
  slab(sink, flat, -hw - 2 * p, hw + 2 * p, -0.09, 0.09, h - 0.06, h - 0.02, LEDS[g.led]!);
  // The leaf: its frame and a darker mesh, parked behind the fence beside the opening.
  const [a, b] = g.leaf === 1 ? [hw, hw + g.width + SITE_LEAF.over] : [-hw - g.width - SITE_LEAF.over, -hw];
  const z = -SITE_LEAF.behind;
  slab(sink, flat, a, b, z - 0.03, z + 0.03, 0.05, 0.12, STEEL);
  slab(sink, flat, a, b, z - 0.03, z + 0.03, 2.08, 2.15, STEEL);
  for (const x of [a, b]) slab(sink, flat, x - 0.03, x + 0.03, z - 0.03, z + 0.03, 0.05, 2.15, STEEL);
  slab(sink, flat, a + 0.03, b - 0.03, z - 0.01, z + 0.01, 0.12, 2.08, GRAPHITE);
  return sink;
};
