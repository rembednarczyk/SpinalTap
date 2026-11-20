import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_NAV,
  ALCHEMIA_PIECES,
  ALCHEMIA_PROPS,
  MALL_PROPS,
  SHOP_SOLID_PROPS,
  FOODHALL_SOLID_PROPS,
  P2_PROPS,
  P2_ROBOTS,
  SHELTER_PROPS,
  CAR_LIFT_PROPS,
  FOODHALL,
  KUROSAWA_SPOT,
  P1_RAMP,
  PARAPET_BEDS,
  Simulation,
  frontDressPieces,
  frontPieces,
  gangerEntity,
  groundY,
} from "../src";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { teleportPlayer } from "./helpers";

/**
 * T0 over P-1 (ADR-0074 stage 7) under the front's storeys (B1, 19.11): the beds along the trench
 * and the front's solids standing on T0 (its wings, green steps and the passage's columns) laid
 * round the level graph's ways on T0, the people waiting there and the map's lawns; the roof's
 * lawns clear of what stands on the roof.
 */

type Box = (typeof ALCHEMIA_PIECES)[number]["box"];

const inBed = (b: Box) => PARAPET_BEDS.some((r) => b.x0 >= r.x0 - 1e-6 && b.x1 <= r.x1 + 1e-6 && b.z0 >= r.z0 - 1e-6 && b.z1 <= r.z1 + 1e-6);
const square = ALCHEMIA_PIECES.filter((p) => p.kind === "green" && p.box.z1 < FOODHALL.minZ && inBed(p.box));
/** The front's solids standing on T0, under L1's roof: its wings, green steps and the passage's columns. */
const front = [...frontPieces(), ...frontDressPieces()].filter((p) => p.solid && p.box.y0 < groundY((p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2) + 1);
const solids = [...square.filter((p) => p.solid), ...front];
const gap = (b: Box, x: number, z: number): number => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1));
const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });

/** The level graph's nodes on T0 (the car park's ground, not P-1 under it or the hall's floor). */
const t0Nodes = ALCHEMIA_NAV.nodes.filter((n) => n.at.z < FOODHALL.minZ + 0.5 && Math.abs(n.at.y - groundY(n.at.x, n.at.z)) < 0.3);

describe("T0 under the front's storeys (ADR-0074 stage 7, B1)", () => {
  it("keeps the beds along the trench, the pergolas gone with the square (19.11)", () => {
    expect(square.length).toBeGreaterThan(8);
    expect(ALCHEMIA_PIECES.filter((p) => (p.kind === "pergola" || p.kind === "lantern") && p.box.z1 < FOODHALL.minZ)).toEqual([]);
    // Its solids are still one prop of Alchemia's, the last before stage 10's passage, P-2's (stage 5a), the front's (B1), P-2's robots (5b), the shelter, the car lift and the gallery (ADR-0093 O1, which took the tiers' two away).
    const beds = ALCHEMIA_PROPS[ALCHEMIA_PROPS.length - 3 - P2_PROPS.length - P2_ROBOTS.length - SHELTER_PROPS.length - CAR_LIFT_PROPS.length - MALL_PROPS.length - SHOP_SOLID_PROPS.length - FOODHALL_SOLID_PROPS.length]!;
    expect(beds.prisms).toHaveLength(square.filter((p) => p.solid).length);
  });

  it("keeps its beds and the front's solids 0.8 m off the level graph's nodes on T0 and the people waiting there", () => {
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

  it("stands its beds on the square's paving, off the map's lawns, footways and roads", () => {
    const chunk = MAP_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!;
    const inside = (x: number, z: number, o: readonly number[]) => {
      let hit = false;
      for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
        if (o[i + 1]! > z !== o[j + 1]! > z && x < ((o[j]! - o[i]!) * (z - o[i + 1]!)) / (o[j + 1]! - o[i + 1]!) + o[i]!) hit = !hit;
      }
      return hit;
    };
    const surfaceAt = (x: number, z: number) => chunk.ground.reduce<string | null>((s, g) => (inside(x, z, g.outline) ? g.surface : s), null);
    for (const p of square.filter((q) => q.solid)) {
      const [x, z] = [(p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2];
      expect(surfaceAt(x, z), `${x.toFixed(1)},${z.toFixed(1)}`).toBe("square");
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

  it("an alerted brawler in the passage west of the trench gets round it to the player at the stair house's door, and back", () => {
    for (const seed of [3, 11]) {
      expect(chase(onGround(406.6, 12), onGround(420, 10.5), 40, seed), `across, seed ${seed}`).not.toBeNull();
      expect(chase(onGround(420, 10.5), onGround(406.6, 12), 40, seed), `back, seed ${seed}`).not.toBeNull();
    }
  });
});
