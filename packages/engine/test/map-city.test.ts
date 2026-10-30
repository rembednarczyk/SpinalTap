import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import type { ViewDescriptor } from "@seki/core";
import { LUBLIN_CHUNKS, buildingView, groundView, terrainView } from "@seki/sim/lublin";
import { describe, expect, it } from "vitest";
import { RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { MeshSink } from "../src/renderer/mesh-sink";
import { type MapBuilding, facadeFrame, hiddenWall, seedBin, wallMeta } from "../src/renderer/mapcity/facade-frame";
import { planFarBuilding, planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { SHOPFRONT_BIT, WINDOW_STYLE, facadeStyle } from "../src/renderer/mapcity/facade-style";
import { MAP_LOD, MapCity, type MapView } from "../src/renderer/mapcity/map-city";
import { cleanRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, planBuildingSigns } from "../src/renderer/mapcity/sign-plan";
import { stackTiers } from "../src/renderer/mapcity/vertical-plan";

const rect = (x0: number, z0: number, x1: number, z1: number) => cleanRing([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);

const tenement = (id: number, ring = rect(0, 0, 18, 12), extra: Partial<MapBuilding> = {}): MapBuilding => ({ id, ring, base: 0, foot: 0, height: 16, levels: 4, use: "residential", look: 1234 + id, roof: 4, ...extra });

const none = () => null;

describe("facades of map buildings (ADR-0044)", () => {
  it("are a pure function of the descriptor: same look, same geometry; another look, another facade", () => {
    const a = new MeshSink();
    const b = new MeshSink();
    planNearBuilding(a, facadeFrame(tenement(1), none));
    planNearBuilding(b, facadeFrame(tenement(1), none));
    expect(a.positions).toEqual(b.positions);
    expect(a.colors).toEqual(b.colors);
    expect(a.uvs2).toEqual(b.uvs2);
    const looks = new Set(Array.from({ length: 24 }, (_, i) => JSON.stringify(facadeStyle({ use: "residential", levels: 4, height: 16, roof: 4, look: i * 7919, area: 216, width: 12 }))));
    expect(looks.size).toBeGreaterThan(12);
  });

  it("gives a slender old-town tower tall windows in tiers and no shops, and leaves a tenement as it was", () => {
    // Wieża Trynitarska: 42 m on a plan 14 m across, mapped as historic.
    for (let look = 0; look < 20; look++) {
      const tower = facadeStyle({ use: "historic", levels: 13, height: 42, roof: 6, look, area: 220, width: 13.9 });
      expect(tower.window).toBe(WINDOW_STYLE.civic);
      expect(tower.freeTower).toBe(true);
      expect(tower.shopfront).toBe(false);
      expect(tower.signs).toBe(0);
      const tenement = facadeStyle({ use: "historic", levels: 4, height: 16, roof: 4, look, area: 220, width: 13.9 });
      expect(tenement.window).toBe(WINDOW_STYLE.tenement);
    }
  });

  it("encodes storeys, bays, style and seed so the shader reads them back", () => {
    const [x, y] = wallMeta(3.6, 2.87, WINDOW_STYLE.tenement + SHOPFRONT_BIT, 0.4);
    expect(Math.floor(x + 0.0005) / 10).toBeCloseTo(3.6, 9);
    expect(Math.floor((x % 1) * 1000 + 0.5) / 100).toBeCloseTo(2.87, 9);
    expect(Math.floor(y)).toBe(WINDOW_STYLE.tenement + SHOPFRONT_BIT);
    expect(y % 1).toBe(seedBin(0.4));
  });

  it("follows the map's shop fronts and fits whole bays to every wall", () => {
    const shop = facadeFrame(tenement(2, rect(0, 0, 18, 12), { shopfront: true }), none);
    const plain = facadeFrame(tenement(2, rect(0, 0, 18, 12), { shopfront: false }), none);
    expect(shop.style.shopfront).toBe(true);
    expect(plain.style.shopfront).toBe(false);
    for (const w of shop.walls) expect(Math.abs(w.length / w.bay - Math.round(w.length / w.bay))).toBeLessThan(1e-9);
    const signs = new MeshSink();
    planBuildingSigns(signs, shop, () => null);
    const kinds = new Set(Array.from({ length: signs.vertexCount }, (_, i) => signs.uvs2[i * 2 + 1]));
    expect(kinds.has(MAP_SIGN_KIND.board)).toBe(true);
    // A room the game cut into it hangs the game's own sign: no shop boards of the map's (ADR-0045).
    const cut = facadeFrame(tenement(2, rect(0, 0, 18, 12), { shopfront: true, doorways: [{ x: 9, z: 0, width: 1.6, bottom: 0, top: 2.6 }] }), none);
    const cutSigns = new MeshSink();
    planBuildingSigns(cutSigns, cut, () => null);
    const cutKinds = new Set(Array.from({ length: cutSigns.vertexCount }, (_, i) => cutSigns.uvs2[i * 2 + 1]));
    expect(cutKinds.has(MAP_SIGN_KIND.board)).toBe(false);
  });

  it("leaves the walls against a neighbour blank, skips those it hides and hangs holo on the firewall above it", () => {
    const low = tenement(10, rect(18, 0, 30, 12), { height: 8, levels: 2 });
    const tall = tenement(11, rect(0, 0, 18, 12), { height: 24, levels: 6, use: "commercial" });
    const neighbour = (others: MapBuilding[]) => (x: number, z: number, self: number) => {
      for (const o of others) if (o.id !== self && x > o.ring[0]!.x && x < o.ring[2]!.x && z > o.ring[0]!.z && z < o.ring[2]!.z) return o.base + o.height;
      return null;
    };
    const fTall = facadeFrame(tall, neighbour([low]));
    const fLow = facadeFrame(low, neighbour([tall]));
    expect(fTall.walls.filter((w) => w.blind)).toHaveLength(1);
    expect(fTall.walls.filter((w) => hiddenWall(fTall, w))).toHaveLength(0);
    expect(fLow.walls.filter((w) => hiddenWall(fLow, w))).toHaveLength(1);
    const near = new MeshSink();
    const nearAlone = new MeshSink();
    planNearBuilding(near, fLow);
    planNearBuilding(nearAlone, facadeFrame(low, none));
    expect(near.vertexCount).toBeLessThan(nearAlone.vertexCount);
  });

  it("draws a church with a tower above its roof, and the far block much lighter than the near one", () => {
    const church = facadeFrame(tenement(20, rect(0, 0, 40, 16), { use: "church", height: 18, roof: 8 }), none);
    const near = new MeshSink();
    const far = new MeshSink();
    planNearBuilding(near, church);
    planFarBuilding(far, church);
    const top = (s: MeshSink) => Math.max(...s.positions.filter((_, i) => i % 3 === 1));
    expect(top(near)).toBeGreaterThan(18 + 8);
    expect(top(far)).toBeGreaterThan(18 + 8);
    expect(far.vertexCount * 4).toBeLessThan(near.vertexCount);
  });

  it("gives a tenement under a superstructure a flat terrace instead of the pitched roof the tiers would cut through", () => {
    let checked = 0;
    for (let id = 0; id < 40; id++) {
      const f = facadeFrame(tenement(id, rect(0, 0, 18, 12), { rise: 9 }), none);
      if (f.style.roof !== "hip" || stackTiers(f).length === 0) continue;
      checked += 1;
      const top = (s: MeshSink) => Math.max(...s.positions.filter((_, i) => i % 3 === 1));
      const near = new MeshSink();
      const far = new MeshSink();
      planNearBuilding(near, f);
      planFarBuilding(far, f);
      expect(top(near)).toBeLessThanOrEqual(f.top + 0.15);
      expect(top(far)).toBeLessThanOrEqual(f.top + 0.01);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("keeps a tenement's pitched roof in the far block, up to the same ridge as near", () => {
    let checked = 0;
    for (let id = 0; id < 40; id++) {
      const f = facadeFrame(tenement(id), none);
      if (f.style.roof !== "hip") continue;
      checked += 1;
      const near = new MeshSink();
      const far = new MeshSink();
      planNearBuilding(near, f);
      planFarBuilding(far, f);
      const top = (s: MeshSink) => Math.max(...s.positions.filter((_, i) => i % 3 === 1));
      expect(top(far)).toBeCloseTo(top(near), 1);
      expect(top(far)).toBeGreaterThan(f.top + 3);
    }
    expect(checked).toBeGreaterThan(0);
  });
});

const makeCity = (quality: "high" | "low" = "high") => {
  const scene = new Scene(new NullEngine());
  const atlas = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene);
  return new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality, signAtlas: atlas });
};

const building = (outline: { x: number; z: number }[], look: number): MapView => ({ kind: "building", outline, height: 14, levels: 4, use: "commercial", look, shopfront: true });

describe("map city batches (ADR-0044)", () => {
  it("merges the buildings of a cell into one far mesh, builds the near mesh on demand and lets go of it", () => {
    const city = makeCity();
    const square = [
      { x: -5, z: -5 },
      { x: 5, z: -5 },
      { x: 5, z: 5 },
      { x: -5, z: 5 },
    ];
    for (let i = 0; i < 6; i++) city.spawn(i + 1, building(square, i), { x: 10 + i * 14, y: 0, z: 10 });
    city.flush();
    expect(city.stats.cells).toBe(1);
    city.update(0.016, { x: 2000, y: 2, z: 0 }, false);
    expect(city.lodAt(10, 10)).toBe("off");
    city.update(0.016, { x: 600, y: 2, z: 10 }, false);
    expect(city.lodAt(10, 10)).toBe("far");
    const farOnly = city.meshes.length;
    city.update(0.016, { x: 40, y: 2, z: 10 }, false);
    expect(city.lodAt(10, 10)).toBe("near");
    expect(city.meshes.length).toBe(farOnly + 1);
    city.update(0.016, { x: 40 + MAP_LOD.high.near * 2 + 200, y: 2, z: 10 }, false);
    expect(city.meshes.length).toBe(farOnly);
    for (let i = 0; i < 6; i++) city.despawn(i + 1);
    city.flush();
    expect(city.stats.cells).toBe(0);
    expect(city.meshes).toHaveLength(0);
  });

  it("stands buildings on the terrain and keeps the ground floor above the plinth", () => {
    const city = makeCity();
    const grid = { originX: 0, originZ: 0, cell: 5, cols: 9, rows: 9, heights: Array.from({ length: 81 }, (_, i) => (i % 9) * 0.5) };
    city.spawn(1, { kind: "terrain", grid }, { x: 0, y: 0, z: 0 });
    city.spawn(2, { ...building([{ x: -6, z: -4 }, { x: 6, z: -4 }, { x: 6, z: 4 }, { x: -6, z: 4 }], 3), plinth: 2.4 } as ViewDescriptor as MapView, { x: 20, y: 1.4, z: 20 });
    city.spawn(3, { kind: "ground", surface: "grass", outline: [{ x: 1, z: 1 }, { x: 39, z: 1 }, { x: 39, z: 39 }, { x: 1, z: 39 }] }, { x: 0, y: 0, z: 0 });
    city.flush();
    expect(city.heightAt(20, 20)).toBeCloseTo(2, 9);
    city.update(0.016, { x: 20, y: 2, z: -30 }, false);
    const near = city.meshes.find((m) => m.name.startsWith("map-near"))!;
    const ys = near.getVerticesData("position")!.filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeLessThan(1.4);
    expect(city.stats.terrains).toBe(1);
    expect(city.meshes.some((m) => m.name.startsWith("map-ground"))).toBe(true);
  });

  it("builds the whole generated Lublin with near detail around Plac Litewski and far blocks beyond", () => {
    const city = makeCity();
    let id = 1;
    for (const c of LUBLIN_CHUNKS) {
      city.spawn(id++, terrainView(c) as MapView, { x: 0, y: 0, z: 0 });
      for (const b of c.buildings) city.spawn(id++, buildingView(b) as MapView, { x: b.x, y: b.y, z: b.z });
      for (const g of c.ground) city.spawn(id++, groundView(g) as MapView, { x: 0, y: 0, z: 0 });
    }
    city.flush();
    for (let k = 0; k < 20; k++) city.update(1 / 60, { x: 0, y: 2, z: 0 }, false);
    const s = city.stats;
    expect(s.buildings).toBe(LUBLIN_CHUNKS.reduce((n, c) => n + c.buildings.length, 0));
    expect(city.lodAt(0, 0)).toBe("near");
    expect(s.near).toBeGreaterThan(0);
    expect(s.far).toBeGreaterThan(0);
    // Everything resident at once stays under a million vertices.
    expect(s.vertices).toBeLessThan(1_000_000);
  });
});

describe("roofs over the street (rain stops under them)", () => {
  it("knows a point under a building's roof from one in the open or above it", () => {
    const city = makeCity();
    const square = [
      { x: -5, z: -5 },
      { x: 5, z: -5 },
      { x: 5, z: 5 },
      { x: -5, z: 5 },
    ];
    city.spawn(1, building(square, 1), { x: 100, y: 2, z: 50 });
    expect(city.roofOver(100, 3, 50)).toBe(true);
    expect(city.roofOver(104, 15.9, 46)).toBe(true);
    expect(city.roofOver(100, 16.5, 50)).toBe(false);
    expect(city.roofOver(106, 3, 50)).toBe(false);
    city.despawn(1);
    expect(city.roofOver(100, 3, 50)).toBe(false);
  });
});
