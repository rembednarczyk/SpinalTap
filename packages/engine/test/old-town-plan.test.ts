import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { bracketSpots } from "../src/renderer/mapcity/bracket-plan";
import { type MapBuilding, type WorldPassage, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { planFarBuilding, planNearBuilding } from "../src/renderer/mapcity/facade-plan";
import { planPassages } from "../src/renderer/mapcity/passage-plan";
import { type P2, cleanRing, pointInRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, planBuildingSigns } from "../src/renderer/mapcity/sign-plan";

/**
 * The Old Town's additions to the map city (ADR-0048): linings of the gates' passages, the
 * covered footbridge on a soffit and the shop signs on wrought-iron brackets.
 */

const ring = (pts: readonly [number, number][]): P2[] => cleanRing(pts.map(([x, z]) => ({ x, z })));
const rect = (x0: number, z0: number, x1: number, z1: number) => ring([[x0, z0], [x1, z0], [x1, z1], [x0, z1]]);
const none = () => null;

const gate = (passage: WorldPassage, outline = rect(0, 0, 18, 12), extra: Partial<MapBuilding> = {}): MapBuilding => ({
  id: 7,
  ring: outline,
  base: 0,
  foot: 0,
  height: 16,
  levels: 4,
  use: "historic",
  look: 4242,
  roof: 5,
  passages: [passage],
  ...extra,
});

interface V {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

const vertices = (sink: MeshSink): V[] =>
  Array.from({ length: sink.vertexCount }, (_, i) => ({
    x: sink.positions[i * 3]!,
    y: sink.positions[i * 3 + 1]!,
    z: sink.positions[i * 3 + 2]!,
    nx: sink.normals[i * 3]!,
    ny: sink.normals[i * 3 + 1]!,
    nz: sink.normals[i * 3 + 2]!,
  }));

const lining = (b: MapBuilding): V[] => {
  const sink = new MeshSink();
  planPassages(sink, facadeFrame(b, none));
  return vertices(sink);
};

/** Distance from a point to the nearest edge of the ring. */
const toRing = (r: readonly P2[], p: P2): number => {
  let best = Infinity;
  for (let i = 0; i < r.length; i++) {
    const a = r[i]!;
    const b = r[(i + 1) % r.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

describe("passages through the Old Town's gates (ADR-0048)", () => {
  const straight: WorldPassage = { from: { x: -2, z: 6 }, to: { x: 20, z: 6 }, width: 3.6, floor: [0, 0.4], spring: 3, crown: 4.6 };

  it("line both sides up to the springing and vault over them to the crown, from mouth to mouth", () => {
    const v = lining(gate(straight));
    expect(v.length).toBeGreaterThan(0);
    // Side walls at z = 4.2 and 7.8 face into the passage and run the whole depth of the building.
    const wall = (p: V) => p.ny === 0 && Math.abs(p.nx) < 0.5;
    const south = v.filter((p) => Math.abs(p.z - 4.2) < 1e-6 && wall(p));
    const north = v.filter((p) => Math.abs(p.z - 7.8) < 1e-6 && wall(p));
    expect(south.every((p) => p.nz > 0.99)).toBe(true);
    expect(north.every((p) => p.nz < -0.99)).toBe(true);
    expect(Math.min(...south.map((p) => p.x))).toBeCloseTo(0, 6);
    expect(Math.max(...south.map((p) => p.x))).toBeCloseTo(18, 6);
    expect(Math.min(...south.map((p) => p.y))).toBeLessThan(0);
    // The vault: its strips face down into the passage and reach the crown over the middle.
    const vault = v.filter((p) => p.ny < -0.05);
    expect(vault.length).toBeGreaterThan(0);
    expect(Math.max(...vault.map((p) => p.y))).toBeCloseTo(4.6, 6);
    expect(Math.min(...vault.map((p) => p.y))).toBeCloseTo(3, 6);
  });

  it("closes the opening into an arch: spandrels and trim at both mouths face out of the passage", () => {
    const v = lining(gate(straight));
    const west = v.filter((p) => p.nx < -0.99);
    const east = v.filter((p) => p.nx > 0.99);
    expect(west.length).toBeGreaterThan(0);
    expect(east.length).toBeGreaterThan(0);
    // Between the springing and the crown, outside the arch: nothing below the springing.
    expect(Math.min(...west.map((p) => p.y))).toBeGreaterThanOrEqual(3 - 1e-6);
    expect(Math.max(...west.map((p) => p.y))).toBeGreaterThan(4.6);
    expect(west.every((p) => p.x < 0.05)).toBe(true);
    expect(east.every((p) => p.x > 17.95)).toBe(true);
  });

  it("follows a facade it meets slantwise: no lining sticks out of the building", () => {
    // A rhomboid gate tower, its facades at 30 degrees to the passage.
    const outline = ring([[0, 0], [16, 0], [22, 12], [6, 12]]);
    const v = lining(gate({ from: { x: -4, z: 6 }, to: { x: 26, z: 6 }, width: 3.4, floor: [0, 0], spring: 3, crown: 4.2 }, outline));
    expect(v.length).toBeGreaterThan(0);
    for (const p of v) expect(pointInRing(p, outline) || toRing(outline, p) < 0.06).toBe(true);
    // And it reaches both facades.
    const side = v.filter((p) => p.ny === 0 && Math.abs(p.nz) > 0.99 && Math.abs(p.z - 4.3) < 1e-6);
    expect(Math.min(...side.map((p) => p.x))).toBeCloseTo(4.3 / 2, 4);
    expect(Math.max(...side.map((p) => p.x))).toBeCloseTo(16 + 4.3 / 2, 4);
  });

  it("ends open inside the building: a vestibule has no back wall, only the spandrels over its end", () => {
    const v = lining(gate({ from: { x: -2, z: 6 }, to: { x: 6, z: 6 }, width: 2.2, floor: [0, 0], spring: 2.9, crown: 3.65 }));
    const inner = v.filter((p) => p.nx > 0.99);
    expect(inner.length).toBeGreaterThan(0);
    expect(inner.every((p) => Math.abs(p.x - 6.01) < 1e-6 && p.y >= 2.9 - 1e-6)).toBe(true);
    // The trim frames only the mouth in the facade.
    expect(inner.every((p) => p.y <= 3.65 + 1e-6)).toBe(true);
  });

  it("is part of the near facade and of the far block", () => {
    const lined = facadeFrame(gate(straight), none);
    const bare = facadeFrame(gate(straight, rect(0, 0, 18, 12), { passages: [] }), none);
    for (const plan of [planNearBuilding, planFarBuilding]) {
      const a = new MeshSink();
      const b = new MeshSink();
      plan(a, lined);
      plan(b, bare);
      expect(a.vertexCount - b.vertexCount).toBe(lining(gate(straight)).length);
    }
  });
});

describe("the covered footbridge over Grodzka (ADR-0048)", () => {
  const bridge: MapBuilding = { id: 9, ring: rect(0, 0, 16, 3.2), base: -5.6, foot: -1, height: 8, levels: 2, use: "residential", look: 0x6b1ad6e, roof: 1.4, lifted: true };

  it("draws its walls from the soffit up and closes them underneath, with the street free below", () => {
    const sink = new MeshSink();
    planNearBuilding(sink, facadeFrame(bridge, none));
    const v = vertices(sink);
    expect(Math.min(...v.map((p) => p.y))).toBeGreaterThanOrEqual(-1 - 0.25);
    const under = v.filter((p) => p.ny < -0.99 && Math.abs(p.y + 1) < 1e-6);
    expect(under.length).toBeGreaterThanOrEqual(3);
    // Its walls are the first floor of the street's houses: the window grid counts from the street.
    const walls = v.filter((p) => p.ny === 0 && p.y > -0.9);
    expect(walls.length).toBeGreaterThan(0);
  });

  it("has no shop signs on brackets", () => {
    expect(bracketSpots(facadeFrame({ ...bridge, shopfront: true, bracketSigns: true }, none))).toEqual([]);
  });
});

describe("shop signs on wrought-iron brackets (ADR-0048)", () => {
  const shop = (extra: Partial<MapBuilding>): MapBuilding => ({ id: 3, ring: rect(0, 0, 18, 12), base: 0, foot: 0, height: 14, levels: 3, use: "residential", look: 99, roof: 4, shopfront: true, ...extra });
  const kinds = (b: MapBuilding): Set<number> => {
    const sink = new MeshSink();
    planBuildingSigns(sink, facadeFrame(b, none), () => null);
    return new Set(Array.from({ length: sink.vertexCount }, (_, i) => sink.uvs2[i * 2 + 1]!));
  };

  it("replace the boards and blades of the Old Town's shops with round signs hung from brackets", () => {
    const f = facadeFrame(shop({ bracketSigns: true }), none);
    const spots = bracketSpots(f);
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      expect(s.u).toBeGreaterThanOrEqual(1);
      expect(s.u).toBeLessThanOrEqual(s.wall.length - 1);
      expect(s.y).toBeGreaterThan(f.b.base + 3);
    }
    const old = kinds(shop({ bracketSigns: true }));
    expect(old.has(MAP_SIGN_KIND.disc)).toBe(true);
    expect(old.has(MAP_SIGN_KIND.board)).toBe(false);
    expect(old.has(MAP_SIGN_KIND.blade)).toBe(false);
    expect(kinds(shop({})).has(MAP_SIGN_KIND.disc)).toBe(false);
  });

  it("put the iron into the near facade at the same spots, and are a pure function of the building", () => {
    const withIron = new MeshSink();
    const without = new MeshSink();
    planNearBuilding(withIron, facadeFrame(shop({ bracketSigns: true }), none));
    planNearBuilding(without, facadeFrame(shop({}), none));
    expect(withIron.vertexCount).toBeGreaterThan(without.vertexCount);
    expect(bracketSpots(facadeFrame(shop({ bracketSigns: true }), none))).toEqual(bracketSpots(facadeFrame(shop({ bracketSigns: true }), none)));
  });

  it("lay the neon's streaks on the street in front, not at the ground floor of a building on a plinth", () => {
    // A slope: the ground falls 0.1 m per metre towards -z; the building's ground floor is 2 m up.
    const slope = (_x: number, z: number) => z * 0.1;
    for (const bracketSigns of [true, false]) {
      const sink = new MeshSink();
      planBuildingSigns(sink, facadeFrame(shop({ base: 2, foot: -0.6, bracketSigns }), none), () => null, slope);
      let streaks = 0;
      for (let i = 0; i < sink.vertexCount; i++) {
        if (sink.uvs2[i * 2 + 1] !== MAP_SIGN_KIND.reflection) continue;
        streaks += 1;
        expect(sink.positions[i * 3 + 1]).toBeCloseTo(slope(0, sink.positions[i * 3 + 2]!) + 0.02, 5);
      }
      expect(streaks).toBeGreaterThan(0);
    }
  });

  it("leave a building with a game doorway to the game's own sign", () => {
    expect(bracketSpots(facadeFrame(shop({ bracketSigns: true, doorways: [{ x: 9, z: 0, width: 1.6, bottom: 0, top: 2.6 }] }), none))).toEqual([]);
  });
});
