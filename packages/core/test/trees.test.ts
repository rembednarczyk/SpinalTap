import { describe, expect, it } from "vitest";
import {
  PLAIN_SPECIES,
  TREE_KIND,
  TREE_SCALE,
  TREE_SPECIES,
  TREE_SPREADS,
  TREE_TOP,
  measuredTreeVariant,
  narrowTreeVariant,
  plainTreeVariant,
  treeHeight,
  treeScale,
  treeSpecies,
  treeSpread,
  withTreeSpecies,
} from "../src";

describe("tree sizes (G-422)", () => {
  it("keeps the old spread of a tree with no measured height", () => {
    expect(treeScale(0)).toBe(0.8);
    expect(treeScale(0xf0)).toBeCloseTo(1.25);
    for (const seed of [0, 0x70, 0xeeff, 0xefff, 0xf000, 0xf2a1, 0xffff]) {
      const v = plainTreeVariant(seed);
      expect(v).toBeLessThan(0xf000);
      expect(v % 3).toBe(seed % 3);
      expect(treeScale(v)).toBeCloseTo(0.8 + 0.45 * (((seed >> 4) % 16) / 15));
    }
    expect(plainTreeVariant(0x1234)).toBe(0x1234);
  });

  it("grows a measured tree to its height, keeping its species", () => {
    for (const seed of [0, 1, 2, 360, 62412, 0xffff]) {
      for (const h of [7, 12.7, 18.3, 20]) {
        const v = measuredTreeVariant(seed, h);
        expect(v % 3).toBe(seed % 3);
        expect(v).toBeLessThanOrEqual(0xffff);
        expect(Math.abs(treeHeight(v) - h)).toBeLessThanOrEqual(TREE_TOP[seed % 3]! * TREE_SCALE.step);
      }
    }
  });

  it("clamps a measured tree to the sizes the variant holds", () => {
    expect(treeScale(measuredTreeVariant(5, 0.4))).toBe(TREE_SCALE.min);
    expect(treeScale(measuredTreeVariant(5, 80))).toBe(TREE_SCALE.max);
    expect(measuredTreeVariant(measuredTreeVariant(7, 15), 15)).toBe(measuredTreeVariant(7, 15));
  });
});

describe("tree species (G-423)", () => {
  it("keeps the species of a seed in variant % 3, measured or not", () => {
    for (const seed of [0, 1, 2, 0x70, 0xeeff, 0xf000, 0xffff]) {
      expect(treeSpecies(plainTreeVariant(seed))).toBe(seed % 3);
      expect(treeSpecies(measuredTreeVariant(seed, 14))).toBe(seed % 3);
    }
  });

  it("gives a tree any species at the same size, the oaks and poplars no seed picks too", () => {
    for (const seed of [0, 0x70, 0xf0, 0xeeff]) {
      for (const v of [plainTreeVariant(seed), measuredTreeVariant(seed, 6), measuredTreeVariant(seed, 21)]) {
        for (let s = 0; s < TREE_SPECIES; s++) {
          const w = withTreeSpecies(v, s);
          expect(treeSpecies(w)).toBe(s);
          expect(treeScale(w)).toBeCloseTo(treeScale(v), 9);
          expect(w).toBeLessThanOrEqual(0xffff);
          expect(withTreeSpecies(w, s)).toBe(w);
        }
      }
    }
    expect(PLAIN_SPECIES).toBe(TREE_KIND.oak);
  });

  it("grows an oak and a poplar to their height over their own crowns' tops", () => {
    for (const s of [TREE_KIND.oak, TREE_KIND.poplar]) {
      for (const h of [10.3, 15, 20, 21]) {
        const v = measuredTreeVariant(0x71, h, s);
        expect(treeSpecies(v)).toBe(s);
        expect(Math.abs(treeHeight(v) - h)).toBeLessThanOrEqual(TREE_TOP[s]! * TREE_SCALE.step);
        expect(measuredTreeVariant(v, h, s)).toBe(v);
      }
      expect(treeScale(measuredTreeVariant(0, 80, s))).toBe(TREE_SCALE.max);
      expect(treeScale(measuredTreeVariant(0, 0.4, s))).toBe(TREE_SCALE.min);
      expect(measuredTreeVariant(0, 80, s)).toBeLessThanOrEqual(0xffff);
    }
  });
});

describe("trees narrowed by walls (G-814)", () => {
  it("keeps a tree's species and height, within a size step of two, at each spread, in 16 bits past every other variant", () => {
    for (const seed of [0, 1, 2, 0x70, 0xf0, 62412, 0xffff])
      for (let s = 0; s < TREE_SPECIES; s++)
        for (const h of [0.4, 6, 12.7, 18.3, 21, 80]) {
          const v = withTreeSpecies(measuredTreeVariant(seed, h), s);
          for (const w of TREE_SPREADS) {
            const n = narrowTreeVariant(v, w)!;
            expect(n).toBeGreaterThan(measuredTreeVariant(0xffff, 80, TREE_KIND.poplar));
            expect(n).toBeLessThanOrEqual(0xffff);
            expect(treeSpecies(n)).toBe(s);
            expect(treeSpread(n)).toBe(w);
            expect(Math.abs(treeScale(n) - treeScale(v))).toBeLessThanOrEqual(TREE_SCALE.step + 1e-9);
            expect(Math.abs(treeHeight(n) - treeHeight(v))).toBeLessThanOrEqual(TREE_TOP[s]! * TREE_SCALE.step + 1e-9);
            // Another species keeps the narrowing; narrowing again changes nothing.
            expect(treeSpread(withTreeSpecies(n, (s + 1) % TREE_SPECIES))).toBe(w);
            expect(narrowTreeVariant(n, w)).toBe(n);
          }
        }
  });

  it("takes the widest spread no wider than asked, none under the narrowest, the tree itself at full width", () => {
    const v = measuredTreeVariant(0x71, 15);
    expect(treeSpread(v)).toBe(1);
    expect(narrowTreeVariant(v, 1)).toBe(v);
    expect(treeSpread(narrowTreeVariant(v, 0.6)!)).toBe(0.55);
    expect(treeSpread(narrowTreeVariant(v, 0.35)!)).toBe(0.35);
    expect(narrowTreeVariant(v, 0.3)).toBeNull();
    expect(treeSpread(plainTreeVariant(0xffff))).toBe(1);
  });
});
