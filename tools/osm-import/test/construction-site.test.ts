import { describe, expect, it } from "vitest";
import { SITE_CABIN, SITE_CRANE, SITE_FENCE, SITE_SCAFFOLD, siteCraneLayout, siteFenceLayout, siteGateLayout, siteScaffoldLayout } from "../../../packages/core/src/world/sites.ts";
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { enSite } from "../../../packages/ui/src/i18n/en/site.ts";
import { plSite } from "../../../packages/ui/src/i18n/pl/site.ts";
import { DIG_CELL, type SiteGround, lineDistance } from "../src/construction-ground.ts";
import { FLIGHT_CELL } from "../../../packages/sim/src/content/lublin/shape.ts";
import { distanceToPiece } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { BOARD_KEYS, SETS, planSite, siteSeed, siteSet } from "../src/construction-site.ts";
import { FENCE_INSET, insetRing } from "../src/construction-fence.ts";
import { scaffoldBox } from "../src/construction-scaffold.ts";
import { planCrane } from "../src/construction-crane.ts";
import { COURTYARD, HERITAGE_CLEAR, courtyardDepth, ringDistance } from "../src/construction-heritage.ts";
import { boardWalls } from "../src/construction-table.ts";
import { type Pt, pointInRing } from "../src/geometry.ts";

/**
 * The building sites' generator (ADR-0087 stage 1) on a plan: a site `w` x `d` m from (0, 0),
 * a pavement up to 0.1 m over its south edge, a carriageway south of it with a street on
 * its axis, a building in its north-east corner, the terrain falling to the west.
 */
const plan = (w: number, d: number, opts: { street?: boolean; building?: boolean; wall?: boolean } = {}) => {
  const outline: Pt[] = [
    { x: 0, z: 0 },
    { x: w, z: 0 },
    { x: w, z: d },
    { x: 0, z: d },
  ];
  const building: Pt[] = [
    { x: w - 8, z: d - 8 },
    { x: w + 4, z: d - 8 },
    { x: w + 4, z: d + 4 },
    { x: w - 8, z: d + 4 },
  ];
  const street = [
    { x: -50, z: -6 },
    { x: w + 50, z: -6 },
  ];
  // Stage 2: a tenement north of the site, its south wall on the outline from x 4 to w - 14.
  const tenement: Pt[] = [
    { x: 4, z: d },
    { x: w - 14, z: d },
    { x: w - 14, z: d + 12 },
    { x: 4, z: d + 12 },
  ];
  const neighbours = [...(opts.building !== false ? [{ ring: building, top: 12 }] : []), ...(opts.wall ? [{ ring: tenement, top: 18 }] : [])];
  const surface = (p: Pt): "road" | "walk" | "building" | null => {
    if (opts.building !== false && pointInRing(p, building)) return "building";
    if (opts.wall && pointInRing(p, tenement)) return "building";
    if (p.z < -3 && p.z > -9) return "road";
    if (p.z <= 0.1 && p.z >= -3) return "walk";
    return null;
  };
  const ground: SiteGround = {
    free: (p) => surface(p) === null,
    open: (p) => surface(p) !== "building",
    heightAt: (p) => 0.03 * p.x + 0.005 * p.z,
    cellAt: () => 2.5,
    driveDistance: (p) => (opts.street === false ? Infinity : lineDistance(p, street)),
    walkDistance: (p) => Math.abs(p.z + 1.5),
    neighbours,
  };
  return { outline, ground, surface };
};

/** Points of a piece's footprint in the world: along its local x and across its local z. */
const footprint = (p: StreetPropItem, hx: number, hz: number): Pt[] => {
  const out: Pt[] = [];
  const [c, s] = [Math.cos(p.yaw), Math.sin(p.yaw)];
  for (let i = -4; i <= 4; i++)
    for (const k of [-1, 0, 1]) {
      const [x, z] = [(hx * i) / 4, hz * k];
      out.push({ x: p.x + x * c + z * s, z: p.z - x * s + z * c });
    }
  return out;
};

const reach = (p: StreetPropItem): [number, number] =>
  p.prop === "site-fence"
    ? [siteFenceLayout(p.variant).length / 2, SITE_FENCE.thick / 2]
    : p.prop === "site-cabin"
      ? [SITE_CABIN.hx, SITE_CABIN.hz]
      : p.prop === "site-gate"
        ? [siteGateLayout(p.variant).width / 2 + 0.24, 0.12]
        : p.prop === "site-crane"
          ? [SITE_CRANE.base, SITE_CRANE.base]
          : [1.2, 0.03];

describe("the building sites' generator (ADR-0087 stage 1)", () => {
  it("gives the same site twice and another for another outline's id", () => {
    const { outline, ground } = plan(40, 30);
    const a = planSite({ id: "w1", ring: outline }, ground);
    expect(planSite({ id: "w1", ring: outline }, ground)).toEqual(a);
    const b = planSite({ id: "w2", ring: outline }, ground);
    expect(b.seed).not.toBe(a.seed);
    expect(JSON.stringify(b.pieces)).not.toBe(JSON.stringify(a.pieces));
    expect(siteSeed("w1")).toBe(siteSeed("w1"));
  });

  it("lays no piece on a carriageway, a pavement or in a wall, the fence 0.3 m in", () => {
    const { outline, ground, surface } = plan(40, 30);
    for (const id of ["w1", "w2", "w3", "r7"]) {
      const s = planSite({ id, ring: outline }, ground);
      expect(s.pieces.length).toBeGreaterThan(20);
      for (const p of s.pieces) {
        const [hx, hz] = reach(p);
        expect(footprint(p, hx, hz).filter((q) => surface(q) !== null), `${id} ${p.prop} at ${p.x},${p.z}`).toEqual([]);
      }
      const [outer, inner] = [insetRing(outline, FENCE_INSET - 0.01), insetRing(outline, FENCE_INSET + 0.01)];
      for (const p of s.pieces.filter((q) => q.prop === "site-fence")) expect([pointInRing(p, outer), pointInRing(p, inner)]).toEqual([true, false]);
      // The panels stop short of the gate's posts and its parked leaf.
      const gate = s.pieces.find((q) => q.prop === "site-gate")!;
      for (const p of s.pieces.filter((q) => q.prop === "site-fence")) {
        const [hx] = reach(p);
        expect(Math.min(...footprint(p, hx, 0.04).map((q) => distanceToPiece(gate, q.x, q.z))), `panel at ${p.x},${p.z}`).toBeGreaterThan(0.01);
      }
      // The building's corner is left out of the fence.
      expect(s.unfenced).toBeGreaterThan(0);
    }
  });

  it("puts the gate on the side by the street, a wicket with no street a vehicle takes", () => {
    const { outline, ground } = plan(40, 30);
    for (const id of ["w1", "w2", "w3"]) {
      const s = planSite({ id, ring: outline }, ground);
      const gate = s.pieces.find((p) => p.prop === "site-gate")!;
      expect(siteGateLayout(gate.variant).wicket).toBe(false);
      // The south side, 0.3 m in from the outline: the gate faces the street (local +z to -z).
      expect(gate.z).toBeCloseTo(FENCE_INSET, 5);
      expect(Math.cos(gate.yaw)).toBeCloseTo(-1, 5);
      expect(s.board?.name).toMatch(/^site\.board\.name\.\d$/);
    }
    const walk = plan(40, 30, { street: false });
    const s = planSite({ id: "w1", ring: walk.outline }, walk.ground);
    expect(siteGateLayout(s.pieces.find((p) => p.prop === "site-gate")!.variant).wicket).toBe(true);
  });

  it("scales the set by the area: the fence alone, a yard, the full set", () => {
    expect([siteSet(SETS.fence), siteSet(SETS.fence + 1), siteSet(SETS.yard), siteSet(SETS.yard + 1)]).toEqual(["fence", "yard", "yard", "full"]);
    const count = (w: number, d: number, id: string) => {
      const { outline, ground } = plan(w, d, { building: false });
      const s = planSite({ id, ring: outline }, ground);
      return { set: s.set, cabins: s.pieces.filter((p) => p.prop === "site-cabin").length, dig: s.dig };
    };
    for (const id of ["w1", "w2", "w3", "w4"]) {
      const small = count(12, 10, id);
      expect(small).toEqual({ set: "fence", cabins: 0, dig: null });
      const yard = count(28, 20, id);
      expect(yard.set).toBe("yard");
      expect(yard.cabins).toBeGreaterThanOrEqual(1);
      expect(yard.cabins).toBeLessThanOrEqual(2);
      const full = count(50, 36, id);
      expect(full.set).toBe("full");
      expect(full.cabins).toBeGreaterThanOrEqual(2);
      expect(full.cabins).toBeLessThanOrEqual(3);
      expect(full.dig).not.toBeNull();
    }
  });

  it("digs the lowest free ground inside the fence, its blend and a cell past it on free ground", () => {
    const { outline, ground } = plan(50, 36, { building: false });
    const s = planSite({ id: "w5", ring: outline }, ground);
    const dig = s.dig!;
    expect(dig.area).toBeGreaterThanOrEqual(0.15 * s.area);
    expect(dig.area).toBeLessThanOrEqual(0.55 * s.area + 1);
    const xs = dig.outline.map((p) => p.x);
    // The terrain falls to the west: the dig keeps to the west half, its floor under the terrain in it.
    expect(Math.min(...xs)).toBeLessThan(25);
    expect(dig.y).toBeLessThan(Math.min(...dig.outline.map((p) => ground.heightAt(p))) - 1.1);
    const margin = dig.blend + 2.5 * Math.SQRT2;
    const inset = insetRing(outline, FENCE_INSET + margin - 0.01);
    for (const p of dig.outline) expect(pointInRing(p, inset)).toBe(true);
  });

  it("keeps the dig and its blend off a chunk of a coarser terrain grid", () => {
    expect(DIG_CELL).toBe(FLIGHT_CELL);
    const { outline, ground } = plan(50, 36, { building: false });
    // The west half's chunk on a 5 m grid: the dig on the east, its blend and a cell past it short of x 25.
    const s = planSite({ id: "w5", ring: outline }, { ...ground, cellAt: (p) => (p.x < 25 ? 5 : 2.5) });
    expect(Math.min(...s.dig!.outline.map((p) => p.x)) - s.dig!.blend).toBeGreaterThan(25 + DIG_CELL);
  });

  it("draws the board's texts from keys both catalogs hold", () => {
    for (const [pool, n] of Object.entries(BOARD_KEYS))
      for (let k = 0; k < n; k++) {
        const key = `site.board.${pool}.${k}`;
        expect(Object.keys(enSite)).toContain(key);
        expect(Object.keys(plSite)).toContain(key);
      }
    expect(Object.keys(enSite)).toHaveLength(Object.values(BOARD_KEYS).reduce((a, b) => a + b, 0));
  });
});

describe("the building sites' crane and scaffold (ADR-0087 stage 2)", () => {
  const ids = ["w1", "w2", "w3", "w4", "r9"];

  it("puts a crane on the full set whose jib reaches every corner, its top 8 m over the tallest neighbour", () => {
    const { outline, ground } = plan(50, 36);
    for (const id of ids) {
      const s = planSite({ id, ring: outline }, ground);
      const piece = s.pieces.find((p) => p.prop === "site-crane")!;
      const c = siteCraneLayout(piece.variant);
      for (const p of outline) expect(Math.hypot(p.x - piece.x, p.z - piece.z), `${id} corner ${p.x},${p.z}`).toBeLessThanOrEqual(c.jib);
      expect(c.jib).toBe(Math.ceil((s.crane!.reach + 1) * 2) / 2);
      expect(c.height).toBeCloseTo(Math.max(SITE_CRANE.least, 12 - ground.heightAt(piece) + SITE_CRANE.over), 1);
      // The base on free ground inside the fence, off the dig.
      for (const q of footprint(piece, SITE_CRANE.base, SITE_CRANE.base)) {
        expect(ground.free(q) && pointInRing(q, insetRing(outline, FENCE_INSET))).toBe(true);
        expect(pointInRing(q, s.dig!.outline)).toBe(false);
      }
      // The shortest reach of a clear point: with nothing to keep off it stands at the raster's best point.
      let least = Infinity;
      for (let x = 0; x <= 50; x++) for (let z = 0; z <= 36; z++) least = Math.min(least, Math.max(...outline.map((p) => Math.hypot(p.x - x, p.z - z))));
      expect(s.crane!.reach).toBeGreaterThanOrEqual(least - 1e-9);
      const open = planCrane(outline, insetRing(outline, FENCE_INSET), ground, { boxes: [], gate: null, way: null }, null)!;
      expect(open.reach).toBeCloseTo(least, 9);
    }
  });

  it("puts no crane on a yard, a fence alone or a narrow site", () => {
    for (const id of ids) {
      for (const [w, d] of [
        [28, 20],
        [12, 10],
        [120, 24],
      ] as const) {
        const { outline, ground } = plan(w, d, { building: false });
        const s = planSite({ id, ring: outline }, ground);
        expect(s.pieces.some((p) => p.prop === "site-crane"), `${id} ${w}x${d}`).toBe(false);
      }
    }
  });

  it("puts the scaffold up along the neighbour's wall on the outline, the fence giving way, the yard and the dig off it", () => {
    const { outline, ground } = plan(50, 36, { wall: true });
    const banners = new Set<number>();
    for (const id of ids) {
      const s = planSite({ id, ring: outline }, ground);
      const piece = s.pieces.find((p) => p.prop === "site-scaffold")!;
      const l = siteScaffoldLayout(piece.variant);
      banners.add(l.banner);
      // Along the north wall (x 4 to 36), its gap off it, into the site.
      expect(piece.z).toBeCloseTo(36 - SITE_SCAFFOLD.gap, 5);
      expect(l.length).toBeGreaterThan(25);
      // Its local +z, (sin yaw, cos yaw), into the site: south.
      expect(Math.cos(piece.yaw)).toBeCloseTo(-1, 5);
      expect(l.height).toBeCloseTo(18 - ground.heightAt(piece) + 1, 1);
      const box = scaffoldBox(s.scaffold!);
      const fence = s.pieces.filter((p) => p.prop === "site-fence");
      for (const p of fence) expect(pointInRing(p, box), `panel at ${p.x},${p.z}`).toBe(false);
      for (const p of s.pieces.filter((q) => q.prop === "site-cabin")) for (const q of footprint(p, SITE_CABIN.hx, SITE_CABIN.hz)) expect(pointInRing(q, box)).toBe(false);
      for (const q of s.dig!.outline) expect(pointInRing(q, scaffoldBox(s.scaffold!, s.dig!.blend))).toBe(false);
      // Without the wall the fence runs along the north side.
      const bare = planSite({ id, ring: outline }, plan(50, 36).ground);
      expect(bare.scaffold).toBeNull();
      expect(bare.pieces.filter((p) => p.prop === "site-fence").length).toBeGreaterThan(fence.length);
    }
    expect(banners.size).toBeGreaterThan(1);
  });

  it("puts no scaffold before a venue's board: another wall, or none (G-893)", () => {
    const { outline, ground } = plan(50, 36, { wall: true });
    // The board on the tenement's south wall (x 4 to 36 on the outline), the only wall the scaffold could take.
    const boarded = { ...ground, neighbours: ground.neighbours.map((n) => (n.top === 18 ? { ...n, boardWalls: [[n.ring[0]!, n.ring[1]!] as const] } : n)) };
    expect(boarded.neighbours.find((n) => n.top === 18)!.ring.slice(0, 2)).toEqual([
      { x: 4, z: 36 },
      { x: 36, z: 36 },
    ]);
    for (const id of ids) {
      expect(planSite({ id, ring: outline }, ground).scaffold, id).not.toBeNull();
      const s = planSite({ id, ring: outline }, boarded);
      expect(s.scaffold, id).toBeNull();
      expect(s.pieces.some((p) => p.prop === "site-scaffold")).toBe(false);
    }
  });

  it("finds the walls of a building a board hangs on, its frame's wall over two of the outline's edges (G-893)", () => {
    const ring: Pt[] = [
      { x: 0, z: 0 },
      { x: 6, z: 0 },
      { x: 12, z: 0.05 },
      { x: 12, z: 10 },
      { x: 0, z: 10 },
    ];
    const board = { a: { x: 7, z: 0 }, b: { x: 9, z: 0 }, nx: 0, nz: -1, bottom: 2.4, top: 3.1, wallA: { x: 0, z: 0 }, wallB: { x: 12, z: 0 }, text: "FRYZURA" };
    expect(boardWalls(ring, [board])).toEqual([
      [ring[0], ring[1]],
      [ring[1], ring[2]],
    ]);
    expect(boardWalls(ring, [{ ...board, wallA: { x: 12, z: 0 }, wallB: { x: 12, z: 10 } }])).toEqual([[ring[2], ring[3]]]);
  });

  /** A site 100 x 40 m round a listed palace, its front to the street (south), with a shallow niche in it or a courtyard behind. */
  const palace = (courtyard: boolean, heritage = true) => {
    const { outline, ground } = plan(100, 40, { building: false });
    const ring: Pt[] = courtyard
      ? [
          { x: 5, z: 12 },
          { x: 95, z: 12 },
          { x: 95, z: 34 },
          { x: 65, z: 34 },
          { x: 65, z: 18 },
          { x: 35, z: 18 },
          { x: 35, z: 34 },
          { x: 5, z: 34 },
        ]
      : [
          { x: 5, z: 12 },
          { x: 40, z: 12 },
          { x: 40, z: 18 },
          { x: 60, z: 18 },
          { x: 60, z: 12 },
          { x: 95, z: 12 },
          { x: 95, z: 34 },
          { x: 5, z: 34 },
        ];
    const g: SiteGround = { ...ground, free: (p) => ground.free(p) && !pointInRing(p, ring), open: (p) => ground.open(p) && !pointInRing(p, ring), neighbours: [{ ring, top: 14, heritage }] };
    return { outline, ground: g, ring };
  };

  it("keeps the crane out of a listed building's front: no crane where it has no courtyard (G-894)", () => {
    for (const id of ids) {
      const { outline, ground, ring } = palace(false);
      // Not listed, the crane stands in the palace's front, by its facade.
      const plain = planSite({ id, ring: outline }, { ...ground, neighbours: [{ ring, top: 14 }] }).crane!;
      expect(ringDistance(plain.at, ring), id).toBeLessThan(HERITAGE_CLEAR);
      expect(planSite({ id, ring: outline }, ground).crane, id).toBeNull();
    }
  });

  it("puts the crane of a listed building's site in its courtyard (G-894)", () => {
    for (const id of ids) {
      const { outline, ground, ring } = palace(true);
      const c = planSite({ id, ring: outline }, ground).crane!;
      expect(courtyardDepth(c.at, ring), `${id} at ${c.at.x},${c.at.z}`).toBeGreaterThanOrEqual(COURTYARD);
      expect(c.at.z).toBeGreaterThan(18);
    }
  });

  it("keeps stage 1's draws: the fence, the board and the containers as before the crane", () => {
    const { outline, ground } = plan(50, 36);
    const s = planSite({ id: "w1", ring: outline }, ground);
    const without = planSite({ id: "w1", ring: outline }, { ...ground, neighbours: [] });
    expect(s.pieces.filter((p) => p.prop !== "site-crane")).toEqual(without.pieces.filter((p) => p.prop !== "site-crane"));
    expect(s.board).toEqual(without.board);
  });
});
