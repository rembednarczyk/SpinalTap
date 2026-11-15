import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { LUBLIN_CHUNKS, buildingView, groundView, terrainView } from "@seki/sim/lublin";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Mesh, RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { WATER_NEVER, standingWater } from "../src/npr/water-mask";
import { SURFACE_CODE } from "../src/renderer/mapcity/ground-plan";
import { MapCity, type MapView } from "../src/renderer/mapcity/map-city";
import type { MapEntries } from "../src/renderer/mapcity/map-entries";
import { type P2, pointInRing } from "../src/renderer/mapcity/polygon";

/**
 * Where the rain stands (ADR-0084 stage 1), measured on the ground the map city lays for a few
 * chunks of Lublin: Krakowskie Przedmieście, the Old Town's setts, Podzamcze's wide avenue.
 */
const CHUNKS = ["krakowskie-1-1", "krakowskie-2-0", "stare-miasto-1-1", "podzamcze-1-0", "podzamcze-1-1"];

interface Ground {
  readonly meshes: Mesh[];
  readonly entries: MapEntries;
}

const build = (): { ground: Ground; scene: Scene } => {
  const scene = new Scene(new NullEngine());
  const atlas = RawTexture.CreateRGBATexture(new Uint8Array(4), 1, 1, scene);
  const city = new MapCity({ scene, materials: new ToonMaterials(scene), shadow: null, quality: "high", signAtlas: atlas });
  let id = 1;
  for (const c of LUBLIN_CHUNKS.filter((c) => CHUNKS.includes(c.id))) {
    city.spawn(id++, terrainView(c) as MapView, { x: 0, y: 0, z: 0 });
    for (const b of c.buildings) city.spawn(id++, buildingView(b) as MapView, { x: b.x, y: b.y, z: b.z });
    for (const g of c.ground) city.spawn(id++, groundView(g) as MapView, { x: 0, y: 0, z: 0 });
  }
  city.flush();
  const meshes = city.meshes.filter((m) => m.name.startsWith("map-ground")).sort((a, b) => (a.name < b.name ? -1 : 1));
  return { ground: { meshes, entries: (city as unknown as { entries: MapEntries }).entries }, scene };
};

interface Sample {
  readonly x: number;
  readonly z: number;
  readonly kerb: number;
  readonly hold: number;
  readonly standing: number;
}

/** Points of a lattice of `step` metres on the up-facing triangles of surface `code`, the field read between their corners. */
const samples = (meshes: readonly Mesh[], code: number, step = 0.3): Sample[] => {
  const out: Sample[] = [];
  for (const m of meshes) {
    const p = m.getVerticesData("position") ?? [];
    const n = m.getVerticesData("normal") ?? [];
    const meta = m.getVerticesData("uv2") ?? [];
    const f = m.getVerticesData("uv3") ?? [];
    const ix = m.getIndices() ?? [];
    for (let t = 0; t + 2 < ix.length; t += 3) {
      const [a, b, c] = [ix[t] as number, ix[t + 1] as number, ix[t + 2] as number];
      if (Math.round(meta[a * 2] ?? -1) !== code || (n[a * 3 + 1] ?? 0) < 0.9) continue;
      const ax = p[a * 3] ?? 0, az = p[a * 3 + 2] ?? 0;
      const bx = p[b * 3] ?? 0, bz = p[b * 3 + 2] ?? 0;
      const cx = p[c * 3] ?? 0, cz = p[c * 3 + 2] ?? 0;
      const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
      if (Math.abs(det) < 1e-9) continue;
      for (let x = Math.ceil(Math.min(ax, bx, cx) / step) * step; x < Math.max(ax, bx, cx); x += step) {
        for (let z = Math.ceil(Math.min(az, bz, cz) / step) * step; z < Math.max(az, bz, cz); z += step) {
          const u = ((x - ax) * (cz - az) - (cx - ax) * (z - az)) / det;
          const v = ((bx - ax) * (z - az) - (x - ax) * (bz - az)) / det;
          if (u < 0 || v < 0 || u + v > 1) continue;
          const w = 1 - u - v;
          const kerb = w * (f[a * 2] ?? 0) + u * (f[b * 2] ?? 0) + v * (f[c * 2] ?? 0);
          const hold = w * (f[a * 2 + 1] ?? 0) + u * (f[b * 2 + 1] ?? 0) + v * (f[c * 2 + 1] ?? 0);
          out.push({ x, z, kerb, hold, standing: standingWater(kerb, hold, x, z) });
        }
      }
    }
  }
  return out;
};

const mean = (s: readonly Sample[]): number => s.reduce((a, b) => a + b.standing, 0) / Math.max(1, s.length);

describe("the water on the streets (ADR-0084)", () => {
  let scene: Scene;
  let ground: Ground;
  beforeAll(() => {
    ({ ground, scene } = build());
  });
  afterAll(() => scene.dispose());

  it("stands on 5-12% of the carriageway in the rain, more by the kerb than on the axis", () => {
    const road = samples(ground.meshes, SURFACE_CODE.road);
    const cover = mean(road);
    const kerb = mean(road.filter((s) => s.kerb < 0.6));
    const axis = mean(road.filter((s) => s.kerb > 2.8 && s.kerb < 6));
    console.log(JSON.stringify({ samples: road.length, cover, kerb, axis }));
    expect(road.length).toBeGreaterThan(100000);
    expect(cover).toBeGreaterThanOrEqual(0.05);
    expect(cover).toBeLessThanOrEqual(0.12);
    expect(kerb).toBeGreaterThan(2 * axis);
  });

  it("stands on the paving only in hollows, on few of it", () => {
    const paving = [SURFACE_CODE.sidewalk, SURFACE_CODE.square, SURFACE_CODE.footway].flatMap((c) => samples(ground.meshes, c, 0.5));
    const cover = mean(paving);
    console.log(JSON.stringify({ paving: paving.length, cover }));
    expect(cover).toBeLessThan(0.05);
    expect(mean(paving.filter((s) => s.hold < 0.05))).toBe(0);
  });

  it("never stands on zebras, decks, kerbs, walls or lawns", () => {
    const zebras = [...ground.entries.grounds.values()].filter((g) => g.surface === "crossing" || g.deck).map((g) => g.ring);
    expect(zebras.length).toBeGreaterThan(0);
    const inZebra = (p: P2) => zebras.some((r) => pointInRing(p, r));
    let checked = 0;
    for (const m of ground.meshes) {
      const p = m.getVerticesData("position") ?? [];
      const n = m.getVerticesData("normal") ?? [];
      const meta = m.getVerticesData("uv2") ?? [];
      const f = m.getVerticesData("uv3") ?? [];
      expect(f.length, m.name).toBe((p.length / 3) * 2);
      for (let v = 0; v < p.length / 3; v++) {
        const code = Math.round(meta[v * 2] ?? 0);
        const never = (n[v * 3 + 1] ?? 0) < 0.9 || code === SURFACE_CODE.kerb || code === SURFACE_CODE.grass;
        // A vertex well inside a zebra or a deck (its edge is shared with the asphalt round it).
        const x = p[v * 3] ?? 0;
        const z = p[v * 3 + 2] ?? 0;
        const inside = [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([dx, dz]) => inZebra({ x: x + (dx ?? 0), z: z + (dz ?? 0) }));
        if (!never && !inside) continue;
        checked++;
        expect(f[v * 2 + 1], `${m.name} vertex ${v}`).toBe(WATER_NEVER);
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it("is the same on every run", () => {
    const again = build();
    const field = (g: Ground) => g.meshes.map((m) => [...(m.getVerticesData("uv3") ?? [])]);
    expect(field(again.ground)).toEqual(field(ground));
    again.scene.dispose();
  });
});
