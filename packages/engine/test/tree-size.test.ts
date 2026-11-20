import { TREE_CROWN, TREE_KIND, TREE_SPECIES, TREE_SPREADS, TREE_TOP, measuredTreeVariant, narrowTreeVariant, treeHeight, treeScale, withTreeSpecies } from "@seki/core";
import { describe, expect, it } from "vitest";
import { bake, toWorld } from "../src/renderer/mapcity/prop-batch";
import { MeshSink } from "../src/renderer/mesh-sink";
import { tree } from "../src/renderer/mapcity/prop-green";
import { TREE_STYLES, treeSpeciesOf, treeStyleAt } from "../src/renderer/mapcity/prop-shapes";

const top = (shape: number): number => {
  const p = tree(shape).positions;
  let y = -Infinity;
  for (let i = 1; i < p.length; i += 3) y = Math.max(y, p[i]!);
  return y;
};

/** How far the crown's vertices reach from the trunk's axis (m). */
const reach = (shape: number): number => {
  const p = tree(shape).positions;
  let r = 0;
  for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i]!, p[i + 2]!));
  return r;
};

/** How far the trunk reaches from its axis a metre over the ground (m). */
const girth = (shape: number): number => {
  const p = tree(shape).positions;
  let r = 0;
  for (let i = 0; i < p.length; i += 3) if (p[i + 1]! < 1) r = Math.max(r, Math.hypot(p[i]!, p[i + 2]!));
  return r;
};

describe("tree sizes (G-422)", () => {
  it("draws each species' crown, in either style, up to the top the importer sizes it by", () => {
    for (let m = 0; m < TREE_SPECIES * TREE_STYLES; m++) expect(top(m)).toBeCloseTo(TREE_TOP[treeSpeciesOf(m)]!, 1);
  });

  it("keeps each species' crown, in either style, within the reach the importer clears of the walls", () => {
    for (let m = 0; m < TREE_SPECIES * TREE_STYLES; m++) {
      const s = treeSpeciesOf(m);
      expect(reach(m)).toBeLessThanOrEqual(TREE_CROWN[s]!);
      expect(reach(m)).toBeGreaterThan(TREE_CROWN[s]! - 0.3);
    }
  });

  it("mixes the original trees in with the leafy ones, about a third, by the tree's place (20.11)", () => {
    let classic = 0;
    let n = 0;
    for (let x = -200; x < 200; x += 7.3)
      for (let z = -200; z < 200; z += 6.1) {
        classic += treeStyleAt(x, z);
        n++;
      }
    expect(classic / n).toBeGreaterThan(0.28);
    expect(classic / n).toBeLessThan(0.42);
    expect(treeStyleAt(12.34, -56.78)).toBe(treeStyleAt(12.34, -56.78));
  });

  it("draws a measured tree as tall as its height", () => {
    for (const seed of [0, 1, 2, 4097]) {
      const variant = measuredTreeVariant(seed, 18.5);
      const [p] = toWorld([{ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant }], { x: 0, y: 0, z: 0 });
      expect(treeSpeciesOf(p!.shape)).toBe(seed % 3);
      expect(top(p!.shape) * p!.scale).toBeCloseTo(treeHeight(variant), 1);
      expect(Math.abs(treeHeight(variant) - 18.5)).toBeLessThan(0.1);
    }
  });

  it("draws a tree OSM names an oak or a poplar with the oak's or the poplar's model (G-423)", () => {
    for (const seed of [0, 1, 2, 4097]) {
      for (const species of [TREE_KIND.oak, TREE_KIND.poplar]) {
        const variant = withTreeSpecies(measuredTreeVariant(seed, 20), species);
        const [p] = toWorld([{ prop: "tree", x: 0, y: 0, z: 0, yaw: 0, variant }], { x: 0, y: 0, z: 0 });
        expect(treeSpeciesOf(p!.shape)).toBe(species);
        expect(top(p!.shape) * p!.scale).toBeCloseTo(treeHeight(variant), 1);
      }
    }
  });

  it("draws the oak's crown about as wide as the tree is tall, the poplar's tall and narrower, both on thicker trunks (G-423)", () => {
    expect(2 * reach(TREE_KIND.oak)).toBeGreaterThan(0.9 * top(TREE_KIND.oak));
    expect(top(TREE_KIND.poplar)).toBeGreaterThan(3 * reach(TREE_KIND.poplar));
    expect(reach(TREE_KIND.oak)).toBeGreaterThan(reach(TREE_KIND.maple) + 0.8);
    for (const s of [TREE_KIND.oak, TREE_KIND.poplar]) expect(girth(s)).toBeGreaterThan(1.5 * girth(TREE_KIND.lime));
  });

  it("draws a tree narrowed by walls as tall as its height, its crown within the narrowed reach (G-814)", () => {
    for (const species of [TREE_KIND.lime, TREE_KIND.oak]) {
      for (const w of TREE_SPREADS) {
        const variant = narrowTreeVariant(withTreeSpecies(measuredTreeVariant(1, 18), species), w)!;
        const [p] = toWorld([{ prop: "tree", x: 10, y: 0, z: -4, yaw: 0.7, variant }], { x: 0, y: 0, z: 0 });
        const sink = new MeshSink();
        bake(sink, tree(p!.shape), p!);
        let [y, r] = [0, 0];
        for (let i = 0; i < sink.vertexCount; i++) {
          y = Math.max(y, sink.positions[i * 3 + 1]!);
          r = Math.max(r, Math.hypot(sink.positions[i * 3]! - 10, sink.positions[i * 3 + 2]! + 4));
        }
        expect(y).toBeCloseTo(treeHeight(variant), 1);
        expect(r).toBeLessThanOrEqual(TREE_CROWN[species]! * treeScale(variant) * w + 1e-6);
        expect(r).toBeGreaterThan((TREE_CROWN[species]! - 0.3) * treeScale(variant) * w);
        for (let i = 0; i < sink.vertexCount; i++) expect(Math.hypot(sink.normals[i * 3]!, sink.normals[i * 3 + 1]!, sink.normals[i * 3 + 2]!)).toBeCloseTo(1, 5);
      }
    }
  });
});
