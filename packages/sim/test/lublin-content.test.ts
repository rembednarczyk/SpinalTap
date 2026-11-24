import { describe, expect, it } from "vitest";
import { terrainHeightAt, type GroundPoint } from "@seki/core";
import { LUBLIN_CHUNKS, LUBLIN_DISTRICT_NAMES, buildingView, groundView, terrainView, toPoints } from "../src/content/lublin";
import { buildingProp } from "../src/content/lublin/city";

/** Signed area, positive counter-clockwise (x east, z north). */
const area = (pts: readonly GroundPoint[]): number => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    s += a.x * b.z - b.x * a.z;
  }
  return s / 2;
};

const convex = (pts: readonly GroundPoint[]): boolean =>
  pts.every((a, i) => {
    const b = pts[(i + 1) % pts.length]!;
    const c = pts[(i + 2) % pts.length]!;
    return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x) >= -1e-6;
  });

const buildings = LUBLIN_CHUNKS.flatMap((c) => c.buildings.map((b) => ({ chunk: c, b })));

describe("Lublin from map data (ADR-0042)", () => {
  it("has the four districts, their chunks 150-250 m on a side and unique ids", () => {
    expect(new Set(LUBLIN_CHUNKS.map((c) => c.district))).toEqual(new Set(Object.keys(LUBLIN_DISTRICT_NAMES)));
    expect(new Set(LUBLIN_CHUNKS.map((c) => c.id)).size).toBe(LUBLIN_CHUNKS.length);
    for (const c of LUBLIN_CHUNKS) {
      for (const side of [c.bounds.maxX - c.bounds.minX, c.bounds.maxZ - c.bounds.minZ]) {
        expect(side).toBeGreaterThanOrEqual(150);
        expect(side).toBeLessThanOrEqual(250);
      }
    }
  });

  it("chunks never overlap", () => {
    for (const a of LUBLIN_CHUNKS) {
      for (const b of LUBLIN_CHUNKS) {
        if (a === b) continue;
        const overlap = a.bounds.minX < b.bounds.maxX && b.bounds.minX < a.bounds.maxX && a.bounds.minZ < b.bounds.maxZ && b.bounds.minZ < a.bounds.maxZ;
        expect(overlap, `${a.id} × ${b.id}`).toBe(false);
      }
    }
  });

  it("covers each chunk with its terrain grid", () => {
    for (const c of LUBLIN_CHUNKS) {
      const g = c.terrain;
      expect(g.originX).toBe(c.bounds.minX);
      expect(g.originZ).toBe(c.bounds.minZ);
      expect(g.originX + (g.cols - 1) * g.cell).toBeCloseTo(c.bounds.maxX, 6);
      expect(g.originZ + (g.rows - 1) * g.cell).toBeCloseTo(c.bounds.maxZ, 6);
      expect(g.heights).toHaveLength(g.cols * g.rows);
      expect(g.cell).toBeGreaterThanOrEqual(2);
      expect(g.cell).toBeLessThanOrEqual(10);
      // Central Lublin lies between the Bystrzyca (about 163 m) and the Old Town (about 200 m).
      for (const h of g.heights) expect(h).toBeGreaterThan(-40);
      for (const h of g.heights) expect(h).toBeLessThan(10);
    }
  });

  it("gives every building a counter-clockwise outline, convex parts that fill it and a foot on the terrain", () => {
    expect(buildings.length).toBeGreaterThan(400);
    for (const { chunk, b } of buildings) {
      const outline = toPoints(b.outline);
      const a = area(outline);
      expect(a, b.id).toBeGreaterThan(0);
      const parts = b.parts.map(toPoints);
      for (const p of parts) expect(convex(p), b.id).toBe(true);
      expect(parts.reduce((s, p) => s + area(p), 0)).toBeCloseTo(a, 3);
      expect(b.x).toBeGreaterThanOrEqual(chunk.bounds.minX - 0.1);
      expect(b.x).toBeLessThanOrEqual(chunk.bounds.maxX + 0.1);
      expect(b.height).toBeGreaterThan(b.plinth);
      expect(b.levels).toBeGreaterThanOrEqual(1);
      // The foot never floats above the chunk's terrain.
      expect(b.y).toBeLessThanOrEqual(terrainHeightAt(chunk.terrain, b.x, b.z) + 1e-6);
    }
  });

  it("names the landmarks", () => {
    const names = new Set(buildings.map(({ b }) => b.name));
    for (const n of ["Brama Krakowska", "Wieża Trynitarska", "Trybunał Koronny", "Brama Grodzka", "Zamek w Lublinie", "Hotel Europa", "Urząd Miasta Lublin"]) {
      expect(names.has(n), n).toBe(true);
    }
    expect([...names].some((n) => n?.startsWith("Archikatedra"))).toBe(true);
  });

  it("lays surfaces inside their chunk, with streets and points of interest", () => {
    const surfaces = new Set<string>();
    for (const c of LUBLIN_CHUNKS) {
      for (const g of c.ground) {
        surfaces.add(g.surface);
        for (const p of toPoints(g.outline)) {
          expect(p.x).toBeGreaterThanOrEqual(c.bounds.minX - 0.05);
          expect(p.x).toBeLessThanOrEqual(c.bounds.maxX + 0.05);
          expect(p.z).toBeGreaterThanOrEqual(c.bounds.minZ - 0.05);
          expect(p.z).toBeLessThanOrEqual(c.bounds.maxZ + 0.05);
        }
      }
    }
    expect([...surfaces].sort()).toEqual(expect.arrayContaining(["cobble", "grass", "road", "sidewalk", "square", "water"]));
    const streets = new Set(LUBLIN_CHUNKS.flatMap((c) => c.streets.map((s) => s.name)));
    for (const s of ["Krakowskie Przedmieście", "Grodzka", "Rynek", "Plac Zamkowy"]) expect(streets.has(s), s).toBe(true);
    expect(LUBLIN_CHUNKS.flatMap((c) => c.pois).length).toBeGreaterThan(100);
  });

  it("turns the data into view descriptors", () => {
    const c = LUBLIN_CHUNKS[0]!;
    const b = c.buildings.find((x) => x.roof !== undefined && x.name !== undefined) ?? c.buildings[0]!;
    const v = buildingView(b);
    expect(v.kind).toBe("building");
    if (v.kind === "building") expect(v.outline).toHaveLength(b.outline.length / 2);
    expect(groundView(c.ground[0]!).kind).toBe("ground");
    expect(terrainView(c).kind).toBe("terrain");
  });

  it("lifts the parts of the landmarks onto them: the view and the solid start at the soffit (G-049)", () => {
    const helmet = buildings.find(({ b }) => b.id === "w617763432")?.b;
    expect(helmet?.soffit).toBeDefined();
    const v = buildingView(helmet!, "kanal");
    expect(v.kind === "building" && v.soffit).toBe(helmet!.soffit);
    // A landmark's part carries no superstructure of vertical Lublin (ADR-0051).
    expect(v.kind === "building" && v.vertical).toBeFalsy();
    const prop = buildingProp(helmet!, undefined, "kanal");
    for (const p of prop.prisms ?? []) expect(p).toMatchObject({ bottom: helmet!.soffit, top: helmet!.height });
    // The ground under it stays the tower's, not the helmet's: the outline's prisms start on the ground.
    const tower = buildings.find(({ b }) => b.id === "w66286371")!.b;
    expect(buildingProp(tower).prisms?.every((p) => p.bottom === 0)).toBe(true);
  });
});

describe("edges of the map data (ADR-0044 aprons)", () => {
  it("open only the sides no other chunk lies against", () => {
    const byId = new Map(LUBLIN_CHUNKS.map((c) => [c.id, c]));
    const view = (id: string) => terrainView(byId.get(id)!);
    const sides = (id: string) => {
      const v = view(id);
      return v.kind === "terrain" ? v.open : undefined;
    };
    // The middle of Krakowskie's bottom row: chunks west, east and north of it, the data's edge south.
    expect(sides("krakowskie-1-0")).toEqual({ south: true, north: false, west: false, east: false });
    // The Nabrzeże stands alone 1.2 km east: its outer sides are all open.
    expect(sides("nabrzeze-1-1")).toMatchObject({ north: true, east: true });
    const open = LUBLIN_CHUNKS.filter((c) => {
      const s = sides(c.id);
      return s && (s.south || s.north || s.west || s.east);
    });
    expect(open.length).toBeLessThan(LUBLIN_CHUNKS.length);
  });
});
