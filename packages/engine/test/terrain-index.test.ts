import { describe, expect, it } from "vitest";
import { MapEntries } from "../src/renderer/mapcity/map-entries";
import { TerrainEntries, type TerrainEntry } from "../src/renderer/mapcity/terrain-index";

/** A level 10 m square terrain at `y`, its south-west corner at (x, z). */
const level = (x: number, y: number, z = 0): TerrainEntry => ({
  grid: { originX: x, originZ: z, cell: 10, cols: 2, rows: 2, heights: [y, y, y, y] },
  open: undefined,
  bounds: { minX: x, maxX: x + 10, minZ: z, maxZ: z + 10 },
  mesh: null,
});

// The bins are sorted on the first lookup (G-444): every change after it has to drop them, or the
// streamed chunks keep the ground of the ones they replaced (G-469).
describe("terrain entries after a lookup", () => {
  it("answer for a terrain set after it", () => {
    const t = new TerrainEntries();
    expect(t.heightAt(5, 5)).toBeNull();
    t.set(1, level(0, 1));
    expect(t.heightAt(5, 5)).toBe(1);
    t.set(2, level(10, 2));
    expect(t.heightAt(15, 5)).toBe(2);
    // A chunk two bins away, sorted into bins the first lookup never made.
    t.set(3, level(200, 3, -300));
    expect(t.heightAt(205, -295)).toBe(3);
  });

  it("take the new grid of a terrain set again, which keeps its place", () => {
    const t = new TerrainEntries();
    t.set(1, level(0, 1));
    t.set(2, level(10, 2));
    expect(t.heightAt(10, 5)).toBe(1); // the shared edge: the first spawned
    t.set(1, level(0, 5));
    expect(t.heightAt(5, 5)).toBe(5);
    expect(t.heightAt(10, 5)).toBe(5);
    // Moved away, it leaves its old box.
    t.set(1, level(100, 6));
    expect(t.heightAt(5, 5)).toBeNull();
    expect(t.heightAt(105, 5)).toBe(6);
  });

  it("forget a deleted terrain, and one deleted and spawned again comes last", () => {
    const t = new TerrainEntries();
    t.set(1, level(0, 1));
    t.set(2, level(10, 2));
    expect(t.heightAt(10, 5)).toBe(1);
    expect(t.delete(1)).toBe(true);
    expect(t.heightAt(5, 5)).toBeNull();
    expect(t.heightAt(10, 5)).toBe(2);
    t.set(1, level(0, 3));
    expect(t.heightAt(10, 5)).toBe(2);
    expect(t.heightAt(5, 5)).toBe(3);
    expect(t.delete(9)).toBe(false);
    expect(t.heightAt(15, 5)).toBe(2);
  });

  it("forget every terrain on clear", () => {
    const t = new TerrainEntries();
    t.set(1, level(0, 1));
    t.set(2, level(10, 2));
    expect(t.heightAt(15, 5)).toBe(2);
    t.clear();
    expect(t.heightAt(5, 5)).toBeNull();
    expect(t.heightAt(15, 5)).toBeNull();
    t.set(2, level(10, 4));
    expect(t.heightAt(15, 5)).toBe(4);
  });

  it("feed the map's ground queries with the streamed chunks", () => {
    const e = new MapEntries();
    e.terrains.set(1, level(0, 1));
    expect(e.heightAt(5, 5)).toBe(1);
    expect(e.drawnGround(5, 5)).toBe(1);
    e.terrains.set(1, level(0, 7));
    expect(e.heightAt(5, 5)).toBe(7);
    expect(e.drawnGround(5, 5)).toBe(7);
    e.terrains.delete(1);
    expect(e.drawnGround(5, 5)).toBeNull();
  });
});
