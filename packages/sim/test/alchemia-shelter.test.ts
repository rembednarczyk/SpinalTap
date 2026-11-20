import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_CUTS,
  ALCHEMIA_MEMORIAL,
  ALCHEMIA_NAV,
  ALCHEMIA_PIECES,
  ALCHEMIA_PROPS,
  MALL_PROPS,
  SHOP_SOLID_PROPS,
  FOODHALL_SOLID_PROPS,
  ROOF_SOLID_PROPS,
  FRONT_PLAZA_SOLID_PROPS, DEPTAK_SOLID_PROPS, FRONT_O5_PROPS,
  ALCHEMIA_T2,
  ALCHEMIA_VAULTS,
  METRO_DOOR_PIECES,
  P1_PIECES,
  P2,
  P2_CORRIDOR,
  P2_CUTTING,
  P2_CUTTING_PIECES,
  P2_SHELL_PIECES,
  P2_SHELTER_GATE,
  P2_STORE_PIECES,
  ROOM_ID_BASE,
  SHELTER,
  SHELTER_GATE_STAIR,
  SHELTER_HATCH,
  SHELTER_HATCH_CUT,
  SHELTER_HATCH_HEAD,
  SHELTER_HATCH_PIECES,
  SHELTER_PIECES,
  SHELTER_PROPS,
  CAR_LIFT_PROPS,
  SHELTER_RISE,
  SHELTER_ROOMS,
  SHELTER_STAIR_FOOT,
  SHELTER_VAULTS,
  Simulation,
  T2_STAIRS,
  WORLD_NAV,
  type AlchemiaBox,
  type AlchemiaPiece,
  gangerEntity,
  groundY,
  interiorAt,
  shelterGateStairY,
  shelterHatchStairY,
} from "../src";
import { lineOfSight } from "../src/world/hitscan";
import { routeAcrossLevels } from "../src/world/nav";
import { teleportPlayer } from "./helpers";

/**
 * The air-raid shelter under T2 (ADR-0074 stage 5d1), measured on the simulation's own ground and
 * solids: the room three metres under T2 by P-2's north end, the steel gate in P-2's corridor with
 * its flight down, the hatch on T2 with its flight; in the level graph with both ways out, an
 * interior of its own. Hebi's stash and the retrieval come into it in stage 5d2.
 */

const F = SHELTER.floor;
const node = (id: string): Vec3 => ALCHEMIA_NAV.nodes.find((n) => n.id === id)!.at;
const up = (p: Vec3, dy: number): Vec3 => ({ ...p, y: p.y + dy });
const onGround = (x: number, z: number): Vec3 => ({ x, y: groundY(x, z), z });
const ROOM: Vec3 = { x: 428, y: F, z: 94.5 };
const HATCH_Z = (SHELTER_HATCH.minZ + SHELTER_HATCH.maxZ) / 2;
const OUTSIDE = onGround(SHELTER_HATCH.maxX + 3, HATCH_Z);

const loaded = (() => {
  let sim: Simulation | null = null;
  return (): Simulation => {
    if (sim) return sim;
    sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, onGround(430, 100));
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    return sim;
  };
})();

const overlap = (a: AlchemiaBox, b: AlchemiaBox): number =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const solidOf = (ps: readonly AlchemiaPiece[]) => ps.filter((p) => p.solid);
const inHatch = (x: number, z: number): boolean => x >= SHELTER_HATCH.minX && x <= SHELTER_HATCH.maxX && z >= SHELTER_HATCH.minZ && z <= SHELTER_HATCH.maxZ;

describe("the shelter under T2 (ADR-0074 stage 5d1)", () => {
  it("lies three metres under T2, its room and its way to the gate in vaults, its hatch's shaft dug out", () => {
    expect(ALCHEMIA_T2 - F).toBeCloseTo(3, 6);
    expect(SHELTER.ceiling - F).toBeGreaterThanOrEqual(2.2);
    for (const v of SHELTER_VAULTS) expect(ALCHEMIA_VAULTS).toContain(v);
    expect(ALCHEMIA_CUTS).toContain(SHELTER_HATCH_CUT);
    const g = loaded().streamer.ground;
    for (const [x, z] of [
      [428, 90],
      [434, 85],
      [421.7, 80],
      [421.7, 72],
    ] as const) {
      expect(g.underStreet({ x, y: F, z }), `${x},${z}`).toBe(true);
      expect(g.underStreet(onGround(x, z)), `${x},${z}`).toBe(false);
    }
    expect(g.heightAt(437, HATCH_Z)).toBeLessThan(F);
  });

  it("keeps every solid of it under the ground, the gate's flight under T1's and P-2's corridor's ceiling", () => {
    const g = loaded().streamer.ground;
    for (const p of SHELTER_PIECES) {
      const b = p.box;
      let low = Infinity;
      for (let x = b.x0; x <= b.x1 + 1e-9; x += 0.5)
        for (let z = b.z0; z <= b.z1 + 1e-9; z += 0.5) if (!inHatch(Math.min(x, b.x1), Math.min(z, b.z1))) low = Math.min(low, g.heightAt(Math.min(x, b.x1), Math.min(z, b.z1)));
      expect(b.y1, `${p.kind} ${b.x0},${b.z0}`).toBeLessThan(low - 0.1);
    }
    expect(Math.max(...SHELTER_PIECES.filter((p) => p.box.z0 < SHELTER_STAIR_FOOT).map((p) => p.box.y1))).toBeLessThanOrEqual(P2.slab);
  });

  it("stands clear of P-2's, P-1's, the food hall's, T2's and the passage from metro B's solids, and of P-2's cutting", () => {
    const mine = solidOf([...SHELTER_PIECES, ...SHELTER_HATCH_PIECES]);
    const theirs = solidOf([...P2_SHELL_PIECES, ...P2_STORE_PIECES, ...P2_CUTTING_PIECES, ...P1_PIECES, ...ALCHEMIA_PIECES, ...METRO_DOOR_PIECES]);
    const hits: string[] = [];
    for (const a of mine) for (const b of theirs) if (overlap(a.box, b.box) > 1e-6) hits.push(`${a.kind} ${a.box.x0},${a.box.z0} in ${b.kind} ${b.box.x0},${b.box.z0}`);
    expect(hits).toEqual([]);
    for (const r of [SHELTER, SHELTER_HATCH]) expect(r.minX >= P2_CUTTING.maxX || r.maxZ <= P2_CUTTING.minZ).toBe(true);
    expect(SHELTER_GATE_STAIR.minX).toBe(P2_CORRIDOR.maxX);
  });

  it("has both flights in the stride with headroom over every step, landings level with P-2's floor and T2's ground", () => {
    expect(SHELTER_RISE).toBeLessThanOrEqual(0.18);
    expect(shelterGateStairY(SHELTER_GATE_STAIR.landing - 0.1)).toBe(P2.floor);
    expect(shelterGateStairY(SHELTER_STAIR_FOOT + 0.1)).toBe(F);
    expect(shelterHatchStairY(SHELTER_HATCH.minX - 0.1)).toBe(F);
    expect(shelterHatchStairY(SHELTER_HATCH_HEAD + 0.1)).toBe(ALCHEMIA_T2);
    const solids = solidOf([...SHELTER_PIECES, ...SHELTER_HATCH_PIECES, ...P2_SHELL_PIECES]);
    const headroom = (x: number, y: number, z: number): number =>
      Math.min(Infinity, ...solids.filter((p) => p.box.x0 <= x && p.box.x1 >= x && p.box.z0 <= z && p.box.z1 >= z && p.box.y0 > y + 0.01).map((p) => p.box.y0)) - y;
    const sx = [SHELTER_GATE_STAIR.minX + 0.5, SHELTER_GATE_STAIR.maxX - 0.5];
    for (let z = SHELTER_GATE_STAIR.minZ + 0.3; z < SHELTER.minZ + 1; z += 0.07) for (const x of sx) expect(headroom(x, shelterGateStairY(z), z), `${x},${z.toFixed(2)}`).toBeGreaterThanOrEqual(2.1);
    for (let x = SHELTER.maxX - 1; x < SHELTER_HATCH.maxX - 0.3; x += 0.07)
      for (const z of [SHELTER_HATCH.minZ + 0.4, SHELTER_HATCH.maxZ - 0.4]) expect(headroom(x, shelterHatchStairY(x), z), `${x.toFixed(2)},${z}`).toBeGreaterThanOrEqual(2.1);
  });

  it("opens its hatch level onto T2's ground, off T2's stairs, the memorial and any solid of the map", () => {
    for (let z = SHELTER_HATCH.minZ; z <= SHELTER_HATCH.maxZ; z += 0.3) expect(Math.abs(groundY(SHELTER_HATCH.maxX + 0.3, z) - ALCHEMIA_T2), `${z}`).toBeLessThan(0.15);
    const m = ALCHEMIA_MEMORIAL;
    expect(Math.hypot((m.x0 + m.x1) / 2 - SHELTER_HATCH.maxX, (m.z0 + m.z1) / 2 - HATCH_Z)).toBeGreaterThan(15);
    expect(SHELTER_HATCH.minZ).toBeGreaterThan(T2_STAIRS.b.z + 2);
    const sim = loaded();
    const shaft = { x0: SHELTER_HATCH.minX, x1: SHELTER_HATCH.maxX + 1.5, z0: SHELTER_HATCH.minZ - 0.3, z1: SHELTER_HATCH.maxZ + 0.5, y0: ALCHEMIA_T2 - 3, y1: ALCHEMIA_T2 + 3 };
    const map = [...sim.world.with("solid")].filter((e) => e.id < ROOM_ID_BASE && overlap({ x0: e.solid.min.x, x1: e.solid.max.x, z0: e.solid.min.z, z1: e.solid.max.z, y0: e.solid.min.y, y1: e.solid.max.y }, shaft) > 0);
    expect(map.map((e) => `${e.key ?? e.id} ${e.view?.kind}`)).toEqual([]);
  });

  it("is the interior `alchemia-shelter` in its room, passage and on both flights, not in P-2's corridor or on T2", () => {
    expect(interiorAt(ROOM)?.id).toBe("alchemia-shelter");
    expect(interiorAt({ x: 421.7, y: F, z: 80 })?.id).toBe("alchemia-shelter");
    expect(interiorAt({ x: 421.7, y: shelterGateStairY(73), z: 73 })?.id).toBe("alchemia-shelter");
    expect(interiorAt({ x: 436.5, y: shelterHatchStairY(436.5), z: HATCH_Z })?.id).toBe("alchemia-shelter");
    expect(interiorAt({ x: 417.4, y: P2.floor, z: 69.8 })?.id).toBe("alchemia-p2");
    expect(interiorAt(onGround(430, 92))).toBeNull();
    expect(interiorAt(OUTSIDE)).toBeNull();
    for (const r of SHELTER_ROOMS) expect(r.bottom).toBe(F);
  });

  it("is the last of Alchemia's props but the car lift's (5e), the gate's leaf a door in P-2's corridor's wall", () => {
    // The gallery round the atrium (ADR-0093 O1) comes after the car lift, its shops (O2) after the gallery, the food hall's fittings (O3) last.
    // The green roof's solids (ADR-0093 O4) come after the food hall's, then the square before the front (ADR-0074 C5), the last of Alchemia's.
    const after = CAR_LIFT_PROPS.length + MALL_PROPS.length + SHOP_SOLID_PROPS.length + FOODHALL_SOLID_PROPS.length + ROOF_SOLID_PROPS.length + FRONT_PLAZA_SOLID_PROPS.length + DEPTAK_SOLID_PROPS.length + FRONT_O5_PROPS.length;
    expect(ALCHEMIA_PROPS.slice(-SHELTER_PROPS.length - after, -after)).toEqual(SHELTER_PROPS);
    const leaf = SHELTER_PROPS.find((p) => p.mechanism?.kind === "door")!;
    expect(leaf.mechanism?.kind).toBe("door");
    expect(leaf.center.x).toBeGreaterThan(P2_CORRIDOR.maxX - P2.wall);
    expect(leaf.center.x).toBeLessThan(P2_CORRIDOR.maxX);
    expect(leaf.center.z).toBeCloseTo((P2_SHELTER_GATE.z0 + P2_SHELTER_GATE.z1) / 2, 6);
  });
});

describe("the shelter in the level graph (ADR-0074 §5, stage 5d1)", () => {
  it("is part of the city's graph, every node on its floor, a landing or T2's ground", () => {
    const ids = new Set(WORLD_NAV.nodes.map((n) => n.id));
    const mine = ALCHEMIA_NAV.nodes.filter((n) => n.id.startsWith("alchemia-shelter-"));
    expect(mine.length).toBeGreaterThanOrEqual(7);
    const g = loaded().streamer.ground;
    for (const n of mine) {
      expect(ids.has(n.id), n.id).toBe(true);
      const floor = n.id === "alchemia-shelter-gate" || n.id === "alchemia-shelter-landing" ? P2.floor : n.id === "alchemia-shelter-hatch-head" ? ALCHEMIA_T2 : n.id === "alchemia-shelter-hatch" ? g.heightAt(n.at.x, n.at.z) : F;
      expect(n.at.y, n.id).toBeCloseTo(floor, 1);
    }
  });

  it("has every edge but the flights' and the gate's walkable in a straight line at knee height", () => {
    const sim = loaded();
    for (const e of ALCHEMIA_NAV.edges.filter((e) => (e.a.startsWith("alchemia-shelter-") || e.b.startsWith("alchemia-shelter-")) && !e.via)) {
      expect(lineOfSight(sim.world, up(node(e.a), 0.6), up(node(e.b), 0.6)), `${e.a} - ${e.b}`).toBe(true);
    }
  });

  it("leads from P-2's store and from T2 into the room, and from the room back to both", () => {
    const sim = loaded();
    for (const s of [{ x: 416, y: P2.floor, z: 20 }, OUTSIDE]) {
      expect(routeAcrossLevels(sim.world, WORLD_NAV, s, ROOM), `${s.x},${s.z} to the room`).not.toBeNull();
      expect(routeAcrossLevels(sim.world, WORLD_NAV, ROOM, s), `the room to ${s.x},${s.z}`).not.toBeNull();
    }
  });

  /** Seconds an alerted brawler at `from` takes to hurt the player at `to` or stand by her, or null. */
  const chase = (from: Vec3, to: Vec3, seconds: number, seed = 3): number | null => {
    const sim = Simulation.create({ seed });
    teleportPlayer(sim, to);
    sim.step();
    const p = sim.player()!;
    const g = gangerEntity(9002, { key: "shelter-chaser", position: { ...from }, yaw: 0 }, null, 200, ALCHEMIA_CHUNK, undefined, "hebi_brawler");
    g.ai!.alerted = true;
    sim.world.add(g);
    const health = p.health!.current;
    for (let i = 0; i < 60 * seconds; i++) {
      sim.step();
      if (p.health!.current < health || (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2.5 && Math.abs(g.position.y - p.position.y) < 1)) return i / 60;
    }
    return null;
  };

  it("an alerted brawler in P-2's corridor gets to the player in the shelter through the gate, and one on T2 down the hatch", () => {
    expect(chase({ x: 417, y: P2.floor, z: 60 }, ROOM, 25), "gate").not.toBeNull();
    expect(chase(onGround(SHELTER_HATCH.maxX + 6, HATCH_Z + 2), ROOM, 25), "hatch").not.toBeNull();
  });
});
