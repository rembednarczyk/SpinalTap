import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import {
  ALCHEMIA_PROPS,
  CAFE_TABLES,
  FOUNTAIN,
  FOUNTAIN_CENTRE,
  FOUNTAIN_RADIUS,
  FOUNTAIN_RIM,
  FRONT_PLAZA_PROPS,
  MAIN_WAY_X,
  MALL_LEVELS,
  PLAZA_CROWD,
  PLAZA_FLOOR,
  PLAZA_GOING,
  PLAZA_KIOSKS,
  PLAZA_RISER,
  PLAZA_STEPS,
  PLAZA_TOP,
  PODIUM,
  P1_RAMP,
  Simulation,
  WORLD_SCENERY,
  WORLD_STREET_PROPS,
  gangerEntity,
  groundY,
  kioskSpots,
  surfaceY,
  plazaCafePieces,
  plazaCafeSolids,
  plazaFloorPieces,
  ROOM_DETAILS,
  DEPTAK_NIGHT_SOLID_PROPS,
} from "../src";
import { DEPTAK_SOLID_PROPS, FRONT_O5_PROPS, FRONT_PLAZA_SOLID_PROPS } from "../src/content/alchemia";
import { surfacesAt } from "../src/content/lublin/roads";
import { lineOfSight } from "../src/world/hitscan";
import { teleportPlayer } from "./helpers";

/*
 * The square before Alchemia's front (ADR-0074 C5, the board 1:1): a podium before the house with
 * arcades, wide stairs down to Bajkowskiego and round its corner, a round fountain with its hologram,
 * food kiosks with awnings, tables under umbrellas, the game's drinks machines, bins, planters and a
 * tree. Measured by its pieces and by a stepped player.
 */

const PIECES = [...plazaFloorPieces(), ...plazaCafePieces()];
const SOLIDS = [...PIECES.filter((p) => p.solid), ...plazaCafeSolids()];
type R = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
const apart = (a: R, b: R, gap: number): boolean => a.maxX + gap <= b.minX || b.maxX + gap <= a.minX || a.maxZ + gap <= b.minZ || b.maxZ + gap <= a.minZ;
const rectOf = (b: { x0: number; x1: number; z0: number; z1: number }): R => ({ minX: b.x0, maxX: b.x1, minZ: b.z0, maxZ: b.z1 });

/** A world with the player at (x, z) on the ground (or `y`) facing north, nobody else in it. */
const start = (x: number, z: number, y = groundY(x, z)): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, { x, y: y + 0.05, z }, 0);
  sim.step();
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  return sim;
};

/** Runs to each point in turn: the seconds it took, the highest and lowest the feet went, or null if stuck. */
const runThrough = (sim: Simulation, points: readonly { x: number; z: number }[], limit = 30): { seconds: number; highest: number; lowest: number } | null => {
  let steps = 0;
  let [highest, lowest] = [-Infinity, Infinity];
  for (const q of points) {
    for (;;) {
      const p = sim.player()!;
      if (Math.hypot(q.x - p.position.x, q.z - p.position.z) < 0.4) break;
      if (steps++ > 60 * limit) return null;
      const want = Math.atan2(q.x - p.position.x, q.z - p.position.z);
      sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
      highest = Math.max(highest, sim.player()!.position.y);
      lowest = Math.min(lowest, sim.player()!.position.y);
    }
  }
  return { seconds: steps / 60, highest, lowest };
};

describe("the square before Alchemia's front (ADR-0074 C5)", () => {
  it("stands the trunk of the tree in its planter on the planter's box, on the ground (the user's 20.11)", () => {
    const tree = FRONT_PLAZA_PROPS.find((p) => p.prop === "tree" && p.y! < groundY(p.x, p.z) + 1)!;
    const under = plazaCafeSolids().filter((p) => p.box.x0 <= tree.x && p.box.x1 >= tree.x && p.box.z0 <= tree.z && p.box.z1 >= tree.z && p.box.y1 < tree.y! + 0.5);
    expect(under.some((p) => p.box.y0 <= groundY(tree.x, tree.z) && p.box.y1 >= tree.y! - 0.05), "the planter's box").toBe(true);
  });

  it("lays its podium a whole number of risers over the passage's ground and its steps by the rules", () => {
    expect(PLAZA_RISER).toBeGreaterThanOrEqual(0.15);
    expect(PLAZA_RISER).toBeLessThanOrEqual(0.18);
    expect(PLAZA_GOING).toBeGreaterThanOrEqual(0.28);
    expect(PLAZA_GOING).toBeLessThanOrEqual(0.3);
    expect(PLAZA_STEPS.length).toBeGreaterThan(40);
    let worstFoot = 0;
    for (const s of PLAZA_STEPS) {
      const b = s.box;
      // Each step a rise under the one above it, a going deep.
      expect(s.top).toBeCloseTo(PLAZA_TOP - s.k * PLAZA_RISER, 6);
      expect(s.down === "w" ? b.x1 - b.x0 : b.z1 - b.z0).toBeCloseTo(PLAZA_GOING, 6);
      // Coming out of the paving, rooted in the ground.
      const corners = [[b.x0, b.z0], [b.x1, b.z0], [b.x0, b.z1], [b.x1, b.z1]] as const;
      expect(Math.max(...corners.map(([x, z]) => s.top - surfaceY(x, z))), `${s.down}${s.k} ${b.x0},${b.z0}`).toBeGreaterThan(0);
      for (const [x, z] of corners) expect(b.y0).toBeLessThan(groundY(x, z));
      // Down from its nose: the next step a rise lower, or the paving (drawn 8 cm over the ground) no more than a riser under it.
      const len = s.down === "w" ? b.z1 - b.z0 : b.x1 - b.x0;
      for (let t = 0.1; t < len; t += 0.2) {
        const [x, z] = s.down === "w" ? [b.x0 - 0.05, b.z0 + t] : s.down === "s" ? [b.x0 + t, b.z0 - 0.05] : [b.x0 + t, b.z1 + 0.05];
        const below = PLAZA_STEPS.find((q) => q.k === s.k + 1 && x >= q.box.x0 - 1e-6 && x <= q.box.x1 + 1e-6 && z >= q.box.z0 - 1e-6 && z <= q.box.z1 + 1e-6);
        if (below) expect(s.top - below.top).toBeCloseTo(PLAZA_RISER, 6);
        else worstFoot = Math.max(worstFoot, s.top - surfaceY(x, z));
      }
    }
    // The steps die into the slope (the ground falls west): the last one's rise over the paving at most §6's 0.18 m.
    expect(worstFoot).toBeLessThanOrEqual(0.18);
    // No flight longer than a landing's 17 risers (§6).
    expect(Math.max(...PLAZA_STEPS.map((s) => s.k))).toBeLessThanOrEqual(17);
  });

  it("takes a stepped player from Bajkowskiego's footway up the stairs onto the square, under the arcade and on into the main entrance", () => {
    const sim = start(405.5, -10.6);
    const up = runThrough(sim, [{ x: 405.5, z: -6.0 }]);
    expect(up).not.toBeNull();
    expect(sim.player()!.position.y).toBeCloseTo(PLAZA_TOP, 1);
    const on = runThrough(sim, [
      { x: 406.5, z: 0.0 },
      { x: 406.5, z: 3.0 },
      { x: 407.5, z: P1_RAMP.covered + 1.4 },
      { x: MAIN_WAY_X, z: P1_RAMP.covered + 1.4 },
      { x: MAIN_WAY_X, z: 37.6 },
    ]);
    expect(on).not.toBeNull();
    expect(on!.highest).toBeLessThan(PLAZA_TOP + 0.1);
    expect(sim.player()!.position.y).toBeCloseTo(MALL_LEVELS.p1, 1);
    expect(up!.seconds + on!.seconds).toBeLessThan(25);
  });

  it("takes a stepped player up the west stairs from the kiosks and up the south stairs at their high end, and down again", () => {
    const west = start(388.5, -3.8);
    expect(runThrough(west, [{ x: 396.0, z: -3.4 }])).not.toBeNull();
    expect(west.player()!.position.y).toBeCloseTo(PLAZA_TOP, 1);
    const down = runThrough(west, [{ x: 390.5, z: -4.0 }]);
    expect(down).not.toBeNull();
    expect(west.player()!.position.y).toBeCloseTo(groundY(390.5, -4.0), 1);
    const south = start(395.0, -10.8);
    expect(runThrough(south, [{ x: 395.0, z: -6.4 }])).not.toBeNull();
    expect(south.player()!.position.y).toBeCloseTo(PLAZA_TOP, 1);
  });

  it("lets an alerted brawler from the footway get up the stairs to the player by the fountain, and from the kiosks up the west stairs", () => {
    /** Seconds the brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
    const chase = (from: { x: number; z: number }, to: { x: number; z: number; y: number }, seed: number): number | null => {
      const sim = Simulation.create({ seed });
      teleportPlayer(sim, { ...to, y: to.y + 0.05 });
      sim.step();
      const p = sim.player()!;
      const g = gangerEntity(9001, { key: "plaza-chaser", position: { x: from.x, y: groundY(from.x, from.z), z: from.z }, yaw: 0 }, null, 200, "krakowskie-2-1", undefined, "hebi_brawler");
      g.ai!.alerted = true;
      sim.world.add(g);
      const health = p.health!.current;
      for (let i = 0; i < 60 * 40; i++) {
        sim.step();
        if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
      }
      return null;
    };
    const fountain = { x: FOUNTAIN_CENTRE.x + 2.3, z: FOUNTAIN_CENTRE.z - 0.5, y: PLAZA_TOP };
    for (const seed of [3, 11]) {
      expect(chase({ x: 405.5, z: -10.8 }, fountain, seed), `south, seed ${seed}`).not.toBeNull();
      expect(chase({ x: 388.5, z: -3.6 }, { x: 395.2, z: -3.0, y: PLAZA_TOP }, seed), `west, seed ${seed}`).not.toBeNull();
    }
  });

  it("stands a round fountain on the podium: a rim knee high all round, solid, its water and hologram in it", () => {
    const rim = PIECES.filter((p) => p.kind === "paving" && p.outline && p.box.y1 > PLAZA_TOP + 0.3);
    expect(rim.length).toBeGreaterThanOrEqual(16);
    for (const p of rim) {
      expect(p.solid).toBe(true);
      expect(p.box.y1 - PLAZA_TOP).toBeCloseTo(FOUNTAIN_RIM, 2);
      for (const q of p.outline!) {
        const r = Math.hypot(q.x - FOUNTAIN_CENTRE.x, q.z - FOUNTAIN_CENTRE.z);
        expect(r).toBeGreaterThan(FOUNTAIN_RADIUS - 0.3);
        expect(r).toBeLessThan(FOUNTAIN_RADIUS + 1e-6);
      }
    }
    expect(FOUNTAIN_RIM).toBeLessThanOrEqual(0.45);
    const water = PIECES.find((p) => p.kind === "water" && p.outline)!;
    expect(water.outline!.length).toBeGreaterThanOrEqual(16);
    expect(PIECES.some((p) => p.kind === "holo")).toBe(true);
    // On the podium, a step in from its edge: walkers pass round it.
    expect(FOUNTAIN.minZ).toBeGreaterThan(PODIUM.minZ + 0.4);
    expect(FOUNTAIN.minX).toBeGreaterThan(PODIUM.minX + 2);
    // The rim is a body: knee high across it nothing passes.
    const sim = start(FOUNTAIN_CENTRE.x, FOUNTAIN.minZ - 1.5, PLAZA_TOP);
    const y = PLAZA_TOP + 0.25;
    expect(lineOfSight(sim.world, { x: FOUNTAIN_CENTRE.x, y, z: FOUNTAIN.minZ - 0.5 }, { x: FOUNTAIN_CENTRE.x, y, z: FOUNTAIN_CENTRE.z }, false)).toBe(false);
  });

  it("builds its kiosks to the board: a counter with lit food, walls, sign bands, two awnings, a seller inside and customers before it, on the square's paving", () => {
    expect(PLAZA_KIOSKS.length).toBe(2);
    for (const k of PLAZA_KIOSKS) {
      const inK = (b: { x0: number; x1: number; z0: number; z1: number }) => b.x0 >= k.rect.minX - 0.3 && b.x1 <= k.rect.maxX + 0.3 && b.z0 >= k.rect.minZ - 0.3 && b.z1 <= k.rect.maxZ + 0.3;
      const mine = PIECES.filter((p) => inK(p.box));
      expect(mine.some((p) => p.kind === "counter" && p.solid)).toBe(true);
      expect(mine.filter((p) => p.kind === "wall" && p.solid).length).toBe(3);
      expect(mine.some((p) => p.kind === "food")).toBe(true);
      expect(mine.some((p) => p.kind === "sign-red" || p.kind === "sign-amber")).toBe(true);
      expect(PIECES.filter((p) => p.kind === "awning" && apart(rectOf(p.box), k.rect, 0.01) === false).length).toBe(2);
      const s = kioskSpots(k);
      const seller = FRONT_PLAZA_PROPS.find((p) => p.prop === "figure" && Math.hypot(p.x - s.seller.x, p.z - s.seller.z) < 0.01)!;
      expect(seller, k.id).toBeDefined();
      expect(seller.x > k.rect.minX && seller.x < k.rect.maxX && seller.z > k.rect.minZ && seller.z < k.rect.maxZ).toBe(true);
      for (const c of s.customers) {
        expect(c.x > k.rect.minX && c.x < k.rect.maxX && c.z > k.rect.minZ && c.z < k.rect.maxZ).toBe(false);
        expect(Math.hypot(c.x - seller.x, c.z - seller.z)).toBeLessThan(2.2);
        expect(PLAZA_CROWD.some((p) => p.at.x === c.x && p.at.z === c.z)).toBe(true);
      }
      for (const [x, z] of [[k.rect.minX, k.rect.minZ], [k.rect.maxX, k.rect.minZ], [k.rect.minX, k.rect.maxZ], [k.rect.maxX, k.rect.maxZ]] as const) {
        expect(surfacesAt(x, z).at(-1), `${k.id} ${x},${z}`).toBe("square");
      }
      expect(apart(k.rect, PLAZA_FLOOR, 1.5)).toBe(true);
      expect(apart(k.rect, FOUNTAIN, 1)).toBe(true);
    }
  });

  it("seats its café under umbrellas, its furniture and green the game's models, the traces of a moment ago on it", () => {
    expect(CAFE_TABLES.length).toBeGreaterThanOrEqual(4);
    expect(PIECES.filter((p) => p.kind === "umbrella" && p.outline?.length === 8).length).toBe(CAFE_TABLES.length);
    expect(PIECES.filter((p) => p.kind === "table" && p.outline).length).toBe(CAFE_TABLES.length);
    expect(SOLIDS.filter((p) => p.kind === "chair").length).toBeGreaterThanOrEqual(2 * CAFE_TABLES.length);
    for (const t of CAFE_TABLES) expect(PLAZA_CROWD.filter((c) => c.does.includes("sit") && Math.hypot(c.at.x - t.x, c.at.z - t.z) < 0.8).length).toBe(t.chairs.length);
    const count = (k: string) => FRONT_PLAZA_PROPS.filter((p) => p.prop === k).length;
    expect(count("vending-machine")).toBe(2);
    expect(count("waste-bin")).toBeGreaterThanOrEqual(3);
    expect(count("tree")).toBeGreaterThanOrEqual(1);
    expect(count("planter")).toBeGreaterThanOrEqual(3);
    expect(count("bench")).toBeGreaterThanOrEqual(1);
    // Green only of the game's models: no drawn bush or lawn of its own.
    expect(PIECES.filter((p) => p.kind === "green" || p.kind === "lawn")).toEqual([]);
    // The drinks machines against the ramp's parapet, facing the podium; on it.
    for (const m of FRONT_PLAZA_PROPS.filter((p) => p.prop === "vending-machine")) {
      expect(m.x).toBeGreaterThan(PODIUM.maxX - 0.6);
      expect(m.yaw).toBeCloseTo(-Math.PI / 2, 6);
      expect(m.y).toBe(PLAZA_TOP);
    }
    // Steam over cups, a carton, flyers, a chair on its back (§5).
    expect(PIECES.filter((p) => p.kind === "steam").length).toBeGreaterThanOrEqual(CAFE_TABLES.length);
    expect(PIECES.some((p) => p.kind === "paper")).toBe(true);
    expect(PIECES.some((p) => p.kind === "carton")).toBe(true);
    expect(PIECES.some((p) => p.kind === "chair" && p.box.y1 - p.box.y0 < 0.05)).toBe(true);
    // Drawn with the street furniture, a view of the scenery before C7's (the deptak's stalls and the terraces' people, 20.11).
    // Before the deptak's (C7) and the front's rooms' (ADR-0093 O5).
    expect(WORLD_SCENERY.at(-3)!.view).toEqual({ kind: "street-props", items: FRONT_PLAZA_PROPS });
  });

  it("keeps everything off Bajkowskiego's footway and carriageway, the ramp's trench and the main entrance's way, on the square's paving", () => {
    const off: string[] = [];
    const pts = [
      ...SOLIDS.flatMap((p) => (p.outline ?? [{ x: p.box.x0, z: p.box.z0 }, { x: p.box.x1, z: p.box.z0 }, { x: p.box.x0, z: p.box.z1 }, { x: p.box.x1, z: p.box.z1 }])),
      ...FRONT_PLAZA_PROPS.map((p) => ({ x: p.x, z: p.z })),
    ];
    for (const q of pts) {
      // Inset a centimetre: an edge on the square's own edge is on it.
      const s = surfacesAt(q.x + Math.sign(400 - q.x) * 0.01, q.z + 0.01);
      if (s.some((k) => k === "footway" || k === "sidewalk" || k === "road" || k === "crossing")) off.push(`${q.x.toFixed(2)},${q.z.toFixed(2)} ${s.join("+")}`);
    }
    expect(off.slice(0, 10)).toEqual([]);
    for (const p of PIECES) {
      expect(p.box.x1, p.kind).toBeLessThanOrEqual(P1_RAMP.minX);
      expect(p.box.x1).toBeLessThan(MAIN_WAY_X - 2.3);
    }
    // The map's furniture keeps clear of the podium and its stairs (a bench of the map stood under the arcade).
    const map = WORLD_STREET_PROPS["krakowskie-2-1"] ?? [];
    expect(map.filter((i) => i.x > PLAZA_FLOOR.minX && i.x < PLAZA_FLOOR.maxX && i.z > PLAZA_FLOOR.minZ && i.z < PLAZA_FLOOR.maxZ)).toEqual([]);
  });

  it("puts its solids in props of their own, after every earlier one of Alchemia's (only C7's deptak's after them), so every id before them stays", () => {
    expect(FRONT_PLAZA_SOLID_PROPS.length).toBeGreaterThan(0);
    expect(ALCHEMIA_PROPS.slice(-FRONT_PLAZA_SOLID_PROPS.length - DEPTAK_SOLID_PROPS.length - (FRONT_O5_PROPS.length + DEPTAK_NIGHT_SOLID_PROPS.length), -DEPTAK_SOLID_PROPS.length - (FRONT_O5_PROPS.length + DEPTAK_NIGHT_SOLID_PROPS.length))).toEqual(FRONT_PLAZA_SOLID_PROPS);
    const prisms = FRONT_PLAZA_SOLID_PROPS.reduce((n, p) => n + (p.prisms?.length ?? 0), 0);
    expect(prisms).toBeGreaterThanOrEqual(SOLIDS.length);
  });

  it("keeps the crowd's spots on the square in Alchemia's chunk, standers off every solid but the chairs they sit on", () => {
    expect(PLAZA_CROWD.length).toBeGreaterThanOrEqual(10);
    for (const c of PLAZA_CROWD) {
      expect(c.chunk).toBe("krakowskie-2-1");
      const floor = c.at.x >= PODIUM.minX && c.at.x <= PODIUM.maxX && c.at.z >= PODIUM.minZ && c.at.z <= PODIUM.maxZ ? PLAZA_TOP : groundY(c.at.x, c.at.z);
      expect(c.at.y, JSON.stringify(c.at)).toBeCloseTo(floor, 1);
      if (c.does.includes("sit")) continue;
      for (const p of SOLIDS) {
        const inside = c.at.x > p.box.x0 && c.at.x < p.box.x1 && c.at.z > p.box.z0 && c.at.z < p.box.z1 && p.box.y1 > c.at.y + 0.3;
        expect(inside, `${JSON.stringify(c.at)} in ${p.kind}`).toBe(false);
      }
    }
  });
});
