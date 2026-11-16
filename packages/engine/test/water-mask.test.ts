import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { LUBLIN_CHUNKS, buildingView, groundView, terrainView } from "@seki/sim/lublin";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Mesh, RawTexture, Scene } from "../src/babylon";
import { ToonMaterials } from "../src/npr/toon-material";
import { TOON_FRAGMENT } from "../src/npr/toon-shader";
import { WATER_FAR, WATER_NEVER, standingWater, waterLevel } from "../src/npr/water-mask";
import { planDressing } from "../src/renderer/dressing-plan";
import { deckHeight } from "../src/renderer/mapcity/deck-plan";
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

  it("stands on the Old Town's setts in many small puddles", () => {
    const setts = samples(ground.meshes, SURFACE_CODE.cobble);
    const cover = mean(setts);
    // A standing point with a dry neighbour on the lattice: the puddles' rims. Small puddles are mostly rim.
    const key = (s: Sample) => `${Math.round(s.x / 0.3)}:${Math.round(s.z / 0.3)}`;
    const wet = new Set(setts.filter((s) => s.standing > 0).map(key));
    const rim = setts.filter((s) => s.standing > 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([i, k]) => !wet.has(`${Math.round(s.x / 0.3) + (i ?? 0)}:${Math.round(s.z / 0.3) + (k ?? 0)}`))).length;
    console.log(JSON.stringify({ setts: setts.length, cover, rim: rim / Math.max(1, wet.size) }));
    expect(setts.length).toBeGreaterThan(20000);
    expect(cover).toBeGreaterThanOrEqual(0.04);
    expect(cover).toBeLessThanOrEqual(0.12);
    expect(rim / wet.size).toBeGreaterThan(0.45);
  });

  it("stands on the paving only in hollows, on few of it", () => {
    const paving = [SURFACE_CODE.sidewalk, SURFACE_CODE.square, SURFACE_CODE.footway].flatMap((c) => samples(ground.meshes, c, 0.5));
    const cover = mean(paving);
    console.log(JSON.stringify({ paving: paving.length, cover }));
    expect(cover).toBeLessThan(0.05);
    expect(mean(paving.filter((s) => s.hold < 0.05))).toBe(0);
  });

  it("never stands on zebras, decks, kerbs, walls or lawns", () => {
    const zebras = [...ground.entries.grounds.values()].filter((g) => g.surface === "crossing" || g.deck);
    expect(zebras.length).toBeGreaterThan(0);
    // On a deck, not on the way under it.
    const inZebra = (p: P2, y: number) => zebras.some((g) => pointInRing(p, g.ring) && (!g.deck || y > deckHeight(g.deck, p.x, p.z) - 0.5));
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
        // A vertex of the asphalt well inside a zebra or on a deck (the edge is shared with the asphalt round it).
        const x = p[v * 3] ?? 0;
        const z = p[v * 3 + 2] ?? 0;
        // Only the carriageway's own vertices: paving laid over a zebra's outline keeps its own field.
        const inside = code === SURFACE_CODE.road && [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([dx, dz]) => inZebra({ x: x + (dx ?? 0), z: z + (dz ?? 0) }, p[v * 3 + 1] ?? 0));
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

describe("the water mask (ADR-0084)", () => {
  it("gathers by the kerb and in the ruts, leaves the crown dry and never stands where it may not", () => {
    expect(waterLevel(0.2, 0)).toBeGreaterThan(waterLevel(1.35, 0));
    expect(waterLevel(1.35, 0)).toBeGreaterThan(waterLevel(WATER_FAR, 0));
    expect(waterLevel(WATER_FAR, 0)).toBe(0);
    expect(waterLevel(0.2, WATER_NEVER)).toBe(0);
    for (let x = 0; x < 50; x += 0.37) expect(standingWater(0.2, WATER_NEVER, x, x * 0.7)).toBe(0);
  });

  it("darkens the wet street without a colour: the district's tint only in standing water", () => {
    const zone = TOON_FRAGMENT.slice(TOON_FRAGMENT.indexOf("float standing = waterStanding"), TOON_FRAGMENT.indexOf("float moon ="));
    const tinted = zone.split("\n").filter((l) => l.includes("wetTint"));
    expect(tinted).toEqual([expect.stringContaining("standing);")]);
    expect(tinted[0]).toContain("mix(albedo, albedo * 0.2 * wetTint, standing)");
  });

  it("replaces the value noise in the toon shader", () => {
    expect(TOON_FRAGMENT).toContain("waterStanding(vWater, vWorldPos.xz)");
    expect(TOON_FRAGMENT).not.toContain("vnoise(vWorldPos.xz * 0.45)");
  });

  it("lays the dressing's puddles on a block of asphalt only where the mask has standing water", () => {
    const block = { center: { x: 41.3, y: 0.1, z: -17.6 }, size: { x: 40, y: 0.2, z: 14 }, material: "asphalt" as const };
    const sink = planDressing({ blocks: [block], world: [block], signs: [], kit: false });
    const centres: { x: number; z: number }[] = [];
    // A disc is quads from its centre: the first corner of each is the centre.
    for (let q = 0; q * 4 < sink.vertexCount; q++) {
      const x = sink.positions[q * 12] ?? 0;
      const z = sink.positions[q * 12 + 2] ?? 0;
      if (sink.positions[q * 12 + 9] === x && sink.positions[q * 12 + 10] === sink.positions[q * 12 + 1] && sink.positions[q * 12 + 11] === z && !centres.some((c) => c.x === x && c.z === z)) centres.push({ x, z });
    }
    expect(centres.length).toBeGreaterThan(0);
    for (const c of centres) {
      const kerb = Math.min(block.size.x / 2 - Math.abs(c.x - block.center.x), block.size.z / 2 - Math.abs(c.z - block.center.z));
      expect(standingWater(kerb, 0, c.x, c.z)).toBe(1);
    }
  });
});
