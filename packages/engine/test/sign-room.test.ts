import { describe, expect, it } from "vitest";
import { MeshSink } from "../src/renderer/mesh-sink";
import { planCanyonSigns } from "../src/renderer/mapcity/canyon-signs";
import { type MapBuilding, type NeighbourAt, type NeighboursNear, facadeFrame } from "../src/renderer/mapcity/facade-frame";
import { type Box2, cleanRing } from "../src/renderer/mapcity/polygon";
import { MAP_SIGN_KIND, planBuildingSigns } from "../src/renderer/mapcity/sign-plan";
import { planVenueSigns, venueBoards } from "../src/renderer/mapcity/venue-plan";

/**
 * Signs keep out of a neighbour that stands out in front of their wall (G-157, G-159): the wall
 * stays a street wall (two of its three samples are clear), but the banners, blades, holo-ads,
 * venue boards and neon tubes near its ends move off the neighbour, get narrower or are left out.
 */

const rect = (x0: number, z0: number, x1: number, z1: number) => cleanRing([{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]);

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
  readonly top: number;
}

const lookup =
  (boxes: readonly Box[]): NeighbourAt =>
  (x, z) => {
    const tops = boxes.filter((b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1).map((b) => b.top);
    return tops.length ? Math.max(...tops) : null;
  };

/** Sign quads of `kinds` with a point of their edges (every 0.1 m) inside a box, under its top. */
const intruders = (sink: MeshSink, kinds: readonly number[], boxes: readonly Box[]): number => {
  let n = 0;
  for (let v = 0; v + 3 < sink.vertexCount; v += 4) {
    if (!kinds.includes(sink.uvs2[v * 2 + 1]!)) continue;
    const c = [0, 1, 2, 3].map((k) => [0, 1, 2].map((j) => sink.positions[(v + k) * 3 + j]!));
    let hit = false;
    for (let k = 0; k < 4 && !hit; k++) {
      const a = c[k]!;
      const b = c[(k + 1) % 4]!;
      for (let t = 0; t <= 1 && !hit; t += 0.02) {
        const [x, y, z] = [0, 1, 2].map((j) => a[j]! + (b[j]! - a[j]!) * t) as [number, number, number];
        hit = boxes.some((o) => x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && y < o.top);
      }
    }
    if (hit) n++;
  }
  return n;
};

const count = (sink: MeshSink, kind: number): number => Array.from({ length: sink.vertexCount / 4 }, (_, q) => sink.uvs2[q * 8 + 1]).filter((k) => k === kind).length;

/** A tall house on the south side of a street (z < 0), its walls 18 x 12 m. */
const house = (look: number, extra: Partial<MapBuilding> = {}): MapBuilding => ({ id: 5, ring: rect(0, 0, 18, 12), base: 0, foot: 0, height: 30, levels: 8, use: "residential", look, roof: 0, shopfront: true, clutter: 1, rise: 0, ...extra });

/** Two taller neighbours standing 3 m out in front of the south wall's ends. */
const OUT_FRONT: readonly Box[] = [
  { x0: -6, x1: 3, z0: -3, z1: 0, top: 40 },
  { x0: 15, x1: 24, z0: -3, z1: 0, top: 40 },
];

describe("signs in front of a wall a neighbour stands out in front of (G-157, G-159)", () => {
  it("hang the banners and blades off the neighbours, every one still hung", () => {
    let banners = 0;
    let blades = 0;
    for (let look = 1; look <= 40; look++) {
      const sink = new MeshSink();
      const f = facadeFrame(house(look), lookup(OUT_FRONT));
      planBuildingSigns(sink, f, () => null);
      planCanyonSigns(sink, [f], [], false);
      expect(intruders(sink, [MAP_SIGN_KIND.ad, MAP_SIGN_KIND.blade], OUT_FRONT)).toBe(0);
      const open = new MeshSink();
      const g = facadeFrame(house(look), () => null);
      planBuildingSigns(open, g, () => null);
      planCanyonSigns(open, [g], [], false);
      expect(count(sink, MAP_SIGN_KIND.ad)).toBe(count(open, MAP_SIGN_KIND.ad));
      expect(count(sink, MAP_SIGN_KIND.blade)).toBe(count(open, MAP_SIGN_KIND.blade));
      banners += count(sink, MAP_SIGN_KIND.ad);
      blades += count(sink, MAP_SIGN_KIND.blade);
    }
    expect(banners).toBeGreaterThan(0);
    expect(blades).toBeGreaterThan(0);
  });

  it("end the neon tube under the cornice short of a neighbour in front of its wall (G-170)", () => {
    let tubes = 0;
    let open = 0;
    for (let look = 1; look <= 80; look++) {
      const sink = new MeshSink();
      planBuildingSigns(sink, facadeFrame(house(look), lookup(OUT_FRONT)), () => null);
      expect(intruders(sink, [MAP_SIGN_KIND.tube], OUT_FRONT)).toBe(0);
      tubes += count(sink, MAP_SIGN_KIND.tube);
      const free = new MeshSink();
      planBuildingSigns(free, facadeFrame(house(look), () => null), () => null);
      open += count(free, MAP_SIGN_KIND.tube);
    }
    // The south wall keeps its tube between the neighbours, the other walls theirs whole.
    expect(open).toBeGreaterThan(0);
    expect(tubes).toBe(open);
  });

  it("keep the tube of a short wall no neighbour cuts (G-170)", () => {
    // A corner cut off 0.3 x 0.3 m: the samples end that wall a hair (1 ulp) short of its length.
    const ring = cleanRing([{ x: 0.3, z: 0 }, { x: 18, z: 0 }, { x: 18, z: 12 }, { x: 0, z: 12 }, { x: 0, z: 0.3 }]);
    let short = 0;
    let lit = 0;
    for (let look = 1; look <= 80; look++) {
      const sink = new MeshSink();
      const f = facadeFrame(house(look, { ring }), () => null);
      planBuildingSigns(sink, f, () => null);
      if (count(sink, MAP_SIGN_KIND.tube) === 0) continue;
      lit++;
      for (let v = 0; v < sink.vertexCount; v += 4) {
        const p = (k: number, j: number) => sink.positions[(v + k) * 3 + j]!;
        if (sink.uvs2[v * 2 + 1] === MAP_SIGN_KIND.tube && Math.abs(Math.hypot(p(1, 0) - p(0, 0), p(1, 2) - p(0, 2)) - Math.hypot(0.3, 0.3)) < 1e-9) short++;
      }
    }
    expect(lit).toBeGreaterThan(0);
    expect(short).toBe(lit);
  });

  it("lay the same tubes when the frame knows the neighbours' bounds (G-170)", () => {
    const quads = (boxes: readonly Box[], near?: NeighboursNear): number[] => {
      const all: number[] = [];
      for (let look = 1; look <= 80; look++) {
        const sink = new MeshSink();
        planBuildingSigns(sink, facadeFrame(house(look), lookup(boxes), near), () => null);
        all.push(...sink.positions);
      }
      return all;
    };
    const bounds = OUT_FRONT.map((b) => ({ minX: b.x0, maxX: b.x1, minZ: b.z0, maxZ: b.z1 }));
    const meets = (box: Box2) => bounds.filter((b) => b.minX <= box.maxX && b.maxX >= box.minX && b.minZ <= box.maxZ && b.maxZ >= box.minZ);
    expect(quads(OUT_FRONT, meets)).toEqual(quads(OUT_FRONT));
    expect(quads([], () => [])).toEqual(quads([]));
  });

  it("narrow a holo-ad on a firewall to the stretch a taller neighbour leaves clear", () => {
    // A low neighbour against the east wall, a taller one standing out in front of its north end.
    const boxes: readonly Box[] = [
      { x0: 18, x1: 30, z0: -2, z1: 14, top: 8 },
      { x0: 17, x1: 30, z0: 9, z1: 20, top: 40 },
    ];
    let holos = 0;
    for (let look = 1; look <= 20; look++) {
      const sink = new MeshSink();
      planBuildingSigns(sink, facadeFrame(house(look, { shopfront: false }), lookup(boxes)), () => null);
      expect(intruders(sink, [MAP_SIGN_KIND.holo], boxes)).toBe(0);
      holos += count(sink, MAP_SIGN_KIND.holo);
    }
    expect(holos).toBeGreaterThan(0);
  });

  it("move a venue's board along the wall off the neighbour by its point", () => {
    const f = facadeFrame(house(7, { venues: [{ x: 16.5, z: 0.5, name: "KUCHNIA SPOD ARARATU", color: "#ffb000" }] }), lookup(OUT_FRONT));
    const sink = new MeshSink();
    expect(planVenueSigns(sink, f)).toBe(1);
    expect(intruders(sink, [MAP_SIGN_KIND.venue, MAP_SIGN_KIND.glyph], OUT_FRONT)).toBe(0);
  });

  it("take a venue's board to the next wall when the neighbours leave its own too little of it", () => {
    // Only 2 m of the south wall stay clear, less than the shortest wall that takes a board.
    const boxes: readonly Box[] = [
      { x0: -6, x1: 8, z0: -3, z1: 0, top: 40 },
      { x0: 10, x1: 24, z0: -3, z1: 0, top: 40 },
    ];
    const f = facadeFrame(house(7, { venues: [{ x: 9, z: 0.5, name: "ZIELONY CZAROWNIK", color: "#39ff8a" }] }), lookup(boxes));
    const [b] = venueBoards(f);
    expect(b).toBeDefined();
    expect(b!.wall.nz).toBeGreaterThan(-0.5);
    const sink = new MeshSink();
    planVenueSigns(sink, f);
    expect(intruders(sink, [MAP_SIGN_KIND.venue, MAP_SIGN_KIND.glyph], boxes)).toBe(0);
  });

  it("keep the holo-ads of a narrow tower with no neighbours, as before the fit (G-157)", () => {
    // Walls of 5 m: an ad of half the wall, 2.5 m, is under the 3 m a cut-down ad keeps at least.
    let holos = 0;
    for (let look = 1; look <= 200; look++) {
      const sink = new MeshSink();
      planBuildingSigns(sink, facadeFrame(house(look, { ring: rect(0, 0, 5, 5), shopfront: false }), () => null), () => null);
      holos += count(sink, MAP_SIGN_KIND.holo);
    }
    expect(holos).toBeGreaterThan(0);
  });
});

