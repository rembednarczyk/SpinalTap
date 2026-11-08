import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_LIFT,
  ALCHEMIA_NAV,
  ALCHEMIA_PIECES,
  ALCHEMIA_PROPS,
  FOODHALL,
  KUROSAWA_SPOT,
  P1_RAMP,
  P1_STAIR,
  PARAPET_BEDS,
  PERGOLA_DOOR,
  ROOF_LAWNS,
  ROOF_PLANTERS,
  SQUARE_GARLANDS,
  STAIR_HOUSE,
  Simulation,
  gangerEntity,
  garlandAt,
  groundY,
  p1RampY,
} from "../src";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { teleportPlayer } from "./helpers";

/**
 * T0's square over P-1 and the food hall's green roof (ADR-0074 stage 7): its pergolas, lanterns and
 * beds on the map's square where the car park was, laid round the level graph's ways on T0, the
 * people waiting there and the map's lawns, and the roof's lawns clear of what stands on the roof.
 */

type Box = (typeof ALCHEMIA_PIECES)[number]["box"];

const SQUARE_KINDS = new Set(["pergola", "lantern", "lawn"]);
const square = ALCHEMIA_PIECES.filter((p) => SQUARE_KINDS.has(p.kind) || (p.kind === "green" && p.box.z1 < FOODHALL.minZ));
const solids = square.filter((p) => p.solid);
const gap = (b: Box, x: number, z: number): number => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });

/** The level graph's nodes on T0 (the car park's ground, not P-1 under it or the hall's floor). */
const t0Nodes = ALCHEMIA_NAV.nodes.filter((n) => n.at.z < FOODHALL.minZ + 0.5 && Math.abs(n.at.y - groundY(n.at.x, n.at.z)) < 0.3);

describe("T0's square and the green roof (ADR-0074 stage 7)", () => {
  it("has pergolas with lanterns, beds along the trench and lawns on the hall's roof", () => {
    const count = (k: string) => square.filter((p) => p.kind === k).length;
    expect(count("pergola")).toBeGreaterThan(30);
    expect(count("lantern")).toBeGreaterThan(15);
    expect(count("green")).toBeGreaterThan(8);
    expect(count("lawn")).toBe(4);
    // Its solids are one prop of Alchemia's, the last one: no id of the content moves.
    const last = ALCHEMIA_PROPS[ALCHEMIA_PROPS.length - 1]!;
    expect(last.prisms).toHaveLength(solids.length);
  });

  it("keeps its posts and beds 0.8 m off the level graph's nodes on T0 and the people waiting there", () => {
    expect(t0Nodes.length).toBeGreaterThanOrEqual(8);
    const spots = [...t0Nodes.map((n) => ({ id: n.id, at: n.at })), { id: "kurosawa", at: KUROSAWA_SPOT }];
    for (const s of spots) for (const p of solids) expect(gap(p.box, s.at.x, s.at.z), s.id).toBeGreaterThan(0.8);
  });

  it("leaves the level graph's edges on T0 and the walk from the ramp's top to the stair house's door clear by half a metre", () => {
    const at = new Map(ALCHEMIA_NAV.nodes.map((n) => [n.id, n.at]));
    const ids = new Set(t0Nodes.map((n) => n.id));
    const walks = ALCHEMIA_NAV.edges.filter((e) => ids.has(e.a) && ids.has(e.b)).map((e) => [at.get(e.a)!, at.get(e.b)!] as const);
    walks.push([at.get("alchemia-p1-ramp-east")!, at.get("alchemia-p1-stair-out")!]);
    for (const [a, b] of walks) {
      for (let t = 0; t <= 1; t += 0.02) {
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        for (const p of solids) expect(gap(p.box, x, z), `${x.toFixed(1)},${z.toFixed(1)}`).toBeGreaterThan(0.5);
      }
    }
  });

  it("lays its beds against the trench's parapets, within their length", () => {
    expect(PARAPET_BEDS[0].x1).toBeCloseTo(P1_RAMP.minX - 0.3, 6);
    expect(PARAPET_BEDS[1].x0).toBeCloseTo(P1_RAMP.maxX + 0.3, 6);
    for (const b of PARAPET_BEDS) {
      expect(b.z0).toBeGreaterThanOrEqual(P1_RAMP.top);
      expect(b.z1).toBeLessThanOrEqual(P1_RAMP.covered);
    }
    // Knee high over the ground beside them, rooted in it.
    for (const p of square.filter((q) => q.kind === "green")) {
      const b = p.box;
      const top = Math.max(groundY(b.x0, b.z0), groundY(b.x1, b.z0), groundY(b.x0, b.z1), groundY(b.x1, b.z1));
      expect(b.y1 - top).toBeGreaterThan(0.3);
      expect(b.y1 - top).toBeLessThan(0.6);
      expect(b.y0).toBeLessThan(Math.min(groundY(b.x0, b.z0), groundY(b.x1, b.z1)));
    }
  });

  it("roofs the stair house's door with a pergola from its posts to the house's wall", () => {
    const beams = square.filter((p) => p.kind === "pergola" && !p.solid && p.box.x0 >= PERGOLA_DOOR.west - 0.3 && p.box.x1 <= PERGOLA_DOOR.east + 0.5 && p.box.z0 >= PERGOLA_DOOR.south - 0.01 && p.box.z1 <= P1_STAIR.minZ + 0.01);
    expect(beams.some((p) => p.box.z1 === P1_STAIR.minZ && p.box.z0 === PERGOLA_DOOR.south)).toBe(true);
    // The door's 2.3 m opening goes under it.
    const under = Math.min(...beams.map((p) => p.box.y0));
    expect(under - P1_STAIR.top).toBeGreaterThan(P1_STAIR.door.top + 0.2);
  });

  it("hangs its lanterns and beams over every head", () => {
    for (const p of square.filter((q) => q.kind === "lantern")) expect(p.box.y0 - groundY((p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2)).toBeGreaterThan(2.0);
    for (const p of square.filter((q) => q.kind === "pergola" && !q.solid)) expect(p.box.y0 - groundY((p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2)).toBeGreaterThan(2.6);
  });

  it("hangs its garlands crosswise from a pergola's corner to another's, over every head and the ramp's cars (user's request 7.11)", () => {
    expect(SQUARE_GARLANDS).toHaveLength(4);
    const posts = square.filter((p) => p.kind === "pergola" && p.solid).map((p) => p.box);
    const beams = square.filter((p) => p.kind === "pergola" && !p.solid).map((p) => p.box);
    for (const g of SQUARE_GARLANDS) {
      // Each end on a beam's top over a post, or on a beam by the stair house's wall.
      for (const e of [g.from, g.to]) {
        expect(posts.some((b) => gap(b, e.x, e.z) < 0.35) || beams.some((b) => gap(b, e.x, e.z) < 0.05), `${e.x},${e.z}`).toBe(true);
        expect(beams.some((b) => Math.abs(b.y1 - e.y) < 0.01 && gap(b, e.x, e.z) < 0.35), `${e.x},${e.z} on a beam`).toBe(true);
      }
      for (let t = 0; t <= 1; t += 0.05) {
        const p = garlandAt(g, t);
        expect(p.y - groundY(p.x, p.z), `${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBeGreaterThan(2.4);
        // Over the ramp, a car's roof (1.6 m) well under it.
        if (p.x > P1_RAMP.minX && p.x < P1_RAMP.maxX && p.z < P1_RAMP.covered) expect(p.y - p1RampY(p.z)).toBeGreaterThan(3);
      }
    }
    // Two by two they cross: each pair's spans meet in plan.
    const meet = (a: (typeof SQUARE_GARLANDS)[number], b: (typeof SQUARE_GARLANDS)[number]) => {
      const d = (p: { x: number; z: number }, q: { x: number; z: number }, r: { x: number; z: number }) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
      return d(a.from, a.to, b.from) * d(a.from, a.to, b.to) < 0 && d(b.from, b.to, a.from) * d(b.from, b.to, a.to) < 0;
    };
    expect(meet(SQUARE_GARLANDS[0]!, SQUARE_GARLANDS[1]!)).toBe(true);
    expect(meet(SQUARE_GARLANDS[2]!, SQUARE_GARLANDS[3]!)).toBe(true);
  });

  it("stands its posts and beds on the square's paving, off the map's lawns, footways and roads", () => {
    const chunk = MAP_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!;
    const inside = (x: number, z: number, o: readonly number[]) => {
      let hit = false;
      for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
        if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
      }
      return hit;
    };
    const surfaceAt = (x: number, z: number) => chunk.ground.reduce<string | null>((s, g) => (inside(x, z, g.outline) ? g.surface : s), null);
    for (const p of solids) {
      const [x, z] = [(p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2];
      expect(surfaceAt(x, z), `${x.toFixed(1)},${z.toFixed(1)}`).toBe("square");
    }
  });

  it("lays the roof's lawns on its slab, clear of the stair house, the lift's kiosk and the planters", () => {
    const L = ALCHEMIA_LIFT;
    const kiosk = { x0: L.centre.x - L.half - L.wall, x1: L.centre.x + L.half + L.wall, z0: L.centre.z - L.half - L.wall - 1.2, z1: L.centre.z + L.half + L.wall };
    for (const b of ROOF_LAWNS) {
      expect(b.y0).toBe(FOODHALL.roof);
      expect(b.x0).toBeGreaterThan(FOODHALL.minX + 1);
      expect(b.x1).toBeLessThan(FOODHALL.maxX - 1);
      expect(b.z0).toBeGreaterThan(STAIR_HOUSE.maxZ + 1);
      expect(b.z0).toBeGreaterThan(kiosk.z1 + 1);
      for (const q of ROOF_PLANTERS) expect(b.z1 < q.z0 || b.z0 > q.z1).toBe(true);
    }
  });

  /** Seconds an alerted brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
  const chase = (from: Vec3, to: Vec3, seconds: number, seed: number): number | null => {
    const sim = Simulation.create({ seed });
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9001, { key: "t0-chaser", position: { ...from }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    for (let i = 0; i < 60 * seconds; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
    }
    return null;
  };

  it("an alerted brawler under the walk's pergola gets round the trench to the player at the stair house's door, and back", () => {
    for (const seed of [3, 11]) {
      expect(chase(onGround(406.6, 12), onGround(420, 10.5), 40, seed), `across, seed ${seed}`).not.toBeNull();
      expect(chase(onGround(420, 10.5), onGround(406.6, 12), 40, seed), `back, seed ${seed}`).not.toBeNull();
    }
  });
});
