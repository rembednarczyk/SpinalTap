import { describe, expect, it } from "vitest";
import { type Vec3, contractAlarmFlag } from "@seki/core";
import { INTERIORS, Simulation, W3_HALL_DOORS, W3_LAYOUT, W3_NAV, W3_ROOF, W3_Y, inW3Zone, w3 } from "../src";
import { rayGeometry } from "../src/world/hitscan";
import { straightWalk } from "../src/systems/ai/steering";
import { CROUCH_BODY_SCALE } from "../src/world/hitboxes";
import { input, run, teleportPlayer } from "./helpers";
import { roundTrip, taken } from "./contract-save-helpers";

/**
 * W-3's hall inside (ADR-0082 stage 2): every room of picture 03 on the level graph from the
 * metro, its ways walkable in a straight line, the basement with two ways out for a walker; the
 * lines of sight of the ADR's section 2 on the geometry; no jump from a roof over the fence, no
 * way from the roofs and the pipe walk up onto the hall's +16; the culvert passed only crouching.
 */

const L = W3_LAYOUT;

/** A game with the player in the hall (its chunk streamed in), everyone else gone. */
const hallSim = (at: Vec3 = w3(2529, 0, 418)): Simulation => {
  const sim = Simulation.create({ seed: 3 });
  teleportPlayer(sim, at);
  sim.step();
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  sim.step();
  return sim;
};

const node = (id: string): Vec3 => {
  const n = W3_NAV.nodes.find((k) => k.id === id);
  if (!n) throw new Error(id);
  return n.at;
};

const reachFrom = (from: string): ReadonlySet<string> => {
  const seen = new Set([from]);
  const todo = [from];
  while (todo.length > 0) {
    const n = todo.pop()!;
    for (const e of W3_NAV.edges) {
      const m = e.a === n ? e.b : e.b === n ? e.a : null;
      if (m && !seen.has(m)) {
        seen.add(m);
        todo.push(m);
      }
    }
  }
  return seen;
};

/** Each room of the plan, a point inside it with its floor: a node of the graph must stand in it. */
const ROOMS: readonly { readonly name: string; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number; readonly y: number }[] = [
  { name: "airlock S", minX: 2500, maxX: 2510, minZ: 406, maxZ: 413, y: 0 },
  { name: "wagon airlock", minX: 2500, maxX: 2510, minZ: 413, maxZ: 423, y: 0 },
  { name: "airlock N", minX: 2500, maxX: 2510, minZ: 423, maxZ: 428, y: 0 },
  { name: "assembly line", minX: 2510, maxX: 2548, minZ: 406, maxZ: 430, y: 0 },
  { name: "test chamber", minX: 2548.8, maxX: 2571.2, minZ: 406.8, maxZ: 429.2, y: 0 },
  { name: "corridor S", minX: 2500, maxX: 2572, minZ: 404, maxZ: 406, y: 0 },
  { name: "store S", minX: 2500, maxX: 2514, minZ: 396, maxZ: 404, y: 0 },
  { name: "parts line", minX: 2514, maxX: 2530, minZ: 396, maxZ: 404, y: 0 },
  { name: "workshop W1", minX: 2530, maxX: 2538, minZ: 396, maxZ: 404, y: 0 },
  { name: "workshop W2", minX: 2538, maxX: 2546, minZ: 396, maxZ: 404, y: 0 },
  { name: "armoury S", minX: 2546, maxX: 2558, minZ: 396, maxZ: 404, y: 0 },
  { name: "server room S", minX: 2558, maxX: 2572, minZ: 396, maxZ: 404, y: 0 },
  { name: "corridor N", minX: 2502, maxX: 2572, minZ: 430, maxZ: 432, y: 0 },
  { name: "store N1", minX: 2500, maxX: 2514, minZ: 432, maxZ: 440, y: 0 },
  { name: "store N2", minX: 2514, maxX: 2524, minZ: 432, maxZ: 440, y: 0 },
  { name: "module assembly", minX: 2524, maxX: 2536, minZ: 432, maxZ: 440, y: 0 },
  { name: "calibration", minX: 2536, maxX: 2548, minZ: 432, maxZ: 440, y: 0 },
  { name: "server room N", minX: 2560, maxX: 2572, minZ: 432, maxZ: 440, y: 0 },
  { name: "gallery", minX: 2500, maxX: 2560, minZ: 430, maxZ: 436, y: L.MEZZANINE },
  { name: "locker room", minX: 2500, maxX: 2524, minZ: 436, maxZ: 440, y: L.MEZZANINE },
  { name: "shift office", minX: 2524, maxX: 2536, minZ: 436, maxZ: 440, y: L.MEZZANINE },
  { name: "technical room", minX: 2536, maxX: 2560, minZ: 436, maxZ: 440, y: L.MEZZANINE },
  { name: "basement", ...L.BASEMENT, y: L.BASEMENT_FLOOR },
];

describe("W-3's hall on the level graph (ADR-0082 stage 2)", () => {
  it("reaches every room of the plan from the metro, but armoury N, shut for good", () => {
    const from = reachFrom("w3-metro");
    for (const r of ROOMS) {
      const inside = W3_NAV.nodes.filter((n) => n.at.x > r.minX && n.at.x < r.maxX && n.at.z > r.minZ && n.at.z < r.maxZ && Math.abs(n.at.y - (W3_Y + r.y)) < 0.1);
      expect(inside.length, r.name).toBeGreaterThan(0);
      expect(inside.some((n) => from.has(n.id)), r.name).toBe(true);
    }
    expect(W3_NAV.nodes.some((n) => n.at.x > 2548 && n.at.x < 2560 && n.at.z > 432 && n.at.z < 440 && n.at.y < W3_Y + 1)).toBe(false);
  });

  it("walks every way on one floor in a straight line, the doors open", () => {
    const sim = hallSim();
    for (const d of [...sim.world.with("door")]) sim.world.remove(d);
    const blocked = W3_NAV.edges.flatMap((e) => {
      const [a, b] = [node(e.a), node(e.b)];
      const inHall = [a, b].every((p) => p.x > 2496 && p.x < 2575 && p.z > 394 && p.z < 442);
      if (!inHall || e.via || Math.abs(a.y - b.y) > 0.1) return [];
      return straightWalk(sim.world, a, b) ? [] : [`${e.a}-${e.b}`];
    });
    expect(blocked).toEqual([]);
  });

  it("gives the basement two ways out a walker takes: stair A and stair B (underground-level-exit)", () => {
    const basement = INTERIORS.find((i) => i.id === "w3-basement")!;
    const inside = (p: Vec3) => basement.rooms.some((r) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ && p.y >= r.bottom - 0.3 && p.y <= r.top);
    const exits = W3_NAV.edges.filter((e) => inside(node(e.a)) !== inside(node(e.b)));
    const out = exits.map((e) => (inside(node(e.a)) ? node(e.b) : node(e.a)));
    expect(out.length).toBeGreaterThanOrEqual(2);
    // Two places apart, not one door.
    expect(Math.max(...out.flatMap((p) => out.map((q) => Math.hypot(p.x - q.x, p.z - q.z))))).toBeGreaterThan(10);
    expect(INTERIORS.find((i) => i.id === "w3-hall")?.autosave).toBe(false);
  });
});

/** Does the eye at `from` see `to`: no geometry on the line (`rayGeometry`, ADR-0082 section 2)? */
const sees = (sim: Simulation, from: Vec3, to: Vec3): boolean => {
  const len = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const dir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len, z: (to.z - from.z) / len };
  const t = rayGeometry(sim.world, from, dir, len);
  return t === null || t >= len - 1e-3;
};

describe("W-3's lines of sight (ADR-0082 section 2)", () => {
  const sim = hallSim();
  const eye = (x: number, y: number, z: number) => w3(x, y + 1.62, z);

  it("from the tower's cabin: the quay, the pier, the pickup yard and row N's roof; not into the culvert", () => {
    // The cabin's glass stops the eye as glass does (ADR-0082 section 2): its west and east faces.
    const west = w3(2486.8, 26, 441);
    const east = w3(2495.2, 26, 441);
    for (const p of [w3(2482, 1.5, 430), w3(2470, 1.5, 432)]) expect(sees(sim, west, p), `${p.x},${p.z}`).toBe(true);
    for (const p of [w3(2550, 1.5, 446), w3(2540, W3_ROOF + 1, 433.5)]) expect(sees(sim, east, p), `${p.x},${p.z}`).toBe(true);
    expect(sees(sim, west, w3(2480, -1, 400.5))).toBe(false);
  });

  it("from the gallery: the whole production aisle; crouched behind belt L2, nobody in the aisle sees her", () => {
    for (const x of [2516, 2530, 2544]) {
      for (const tx of [2512, 2520, 2529, 2538, 2546]) expect(sees(sim, eye(x, L.MEZZANINE, 430.7), w3(tx, 1, 418)), `${x}->${tx}`).toBe(true);
    }
    const crouched = (x: number) => w3(x, 1.8 * CROUCH_BODY_SCALE * 0.8, 427.4);
    for (const x of [2520, 2528, 2536]) {
      for (const from of [2514, 2529, 2544]) expect(sees(sim, eye(from, 0, 418), crouched(x)), `${from}->${x}`).toBe(false);
    }
  });

  it("the aisle runs straight 38 m from the wagon airlock to the chamber's gate", () => {
    expect(sees(sim, eye(2503, 0, 418), eye(2547.5, 0, 418))).toBe(true);
  });

  it("corridor N is seen from the hall only through its doors", () => {
    expect(sees(sim, eye(2530, 0, 420), w3(2530, 1, 431))).toBe(false);
    expect(sees(sim, eye(2540, 0, 420), w3(2525, 1, 431))).toBe(false);
    for (const x of L.HALL_DOORS) expect(sees(sim, eye(x, 0, 427), w3(x, 1, 431)), `${x}`).toBe(true);
  });

  it("server room N is unseen from the corridor while its door is shut", () => {
    const door = W3_HALL_DOORS.find((d) => d.key === "door:w3-server-n")!;
    expect(sees(sim, eye(door.at.x, 0, 431), w3(door.at.x, 1, 435))).toBe(false);
  });
});

describe("W-3's lockdown lock (ADR-0082 section 3, prepared for stage 3)", () => {
  const door = W3_HALL_DOORS.find((d) => d.key === "door:w3-server-n")!;
  const openness = (sim: Simulation) => [...sim.world.with("door")].find((e) => e.door.door === door.key)?.door.open ?? NaN;
  /** A job running (the quay's hack), the player walking up to server room N's door from the corridor. */
  const atDoor = (alarm: boolean): Simulation => {
    const { sim, c } = taken(5, 1, w3(2530, 0, 418), "hack");
    const snap = roundTrip(sim.snapshot(null, "t", ""));
    const flags = alarm ? [...snap.domain.flags, contractAlarmFlag(c.id)] : snap.domain.flags;
    const next = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags } });
    teleportPlayer(next, w3(door.at.x, 0, 430.9), 0);
    run(next, 30);
    return next;
  };

  it("lets anyone through the server rooms' doors till the job's alarm goes up, and nobody while it is up", () => {
    expect(door.lock).toEqual({ kind: "alarm" });
    expect(openness(atDoor(false))).toBe(1);
    expect(openness(atDoor(true))).toBe(0);
  });
});

describe("W-3's roofs and the pipe walk (ADR-0082 stage 2)", () => {
  /** Sprints and jumps from `start` towards `yaw`; where the feet are 3 s later and the highest they got. */
  const jump = (sim: Simulation, start: Vec3, yaw: number): { at: Vec3; top: number } => {
    teleportPlayer(sim, start, yaw);
    delete sim.player()!.fall;
    sim.step();
    sim.step(input({ moveZ: 1, sprint: true }));
    sim.step(input({ moveZ: 1, sprint: true, jump: true }));
    let top = -Infinity;
    for (let i = 0; i < 180; i++) {
      sim.step(input({ moveZ: 1, sprint: true, jump: i % 20 === 0 }));
      top = Math.max(top, sim.player()!.position.y);
    }
    return { at: sim.player()!.position, top };
  };

  it("lets no jump off a roof land behind the fence", () => {
    const sim = hallSim();
    // Row N's north and east edges, row S's south, east and cut corner, the airlocks' west.
    const starts: [Vec3, number][] = [
      [w3(2530, W3_ROOF, 438.6), 0],
      [w3(2566, W3_ROOF, 434), Math.PI / 2],
      [w3(2530, W3_ROOF, 397.6), Math.PI],
      [w3(2570.4, W3_ROOF, 400), Math.PI / 2],
      [w3(2506, W3_ROOF, 399.6), Math.PI * 0.8],
      [w3(2502, W3_ROOF, 410), -Math.PI / 2],
    ];
    for (const [start, yaw] of starts) {
      const { at } = jump(sim, start, yaw);
      expect(inW3Zone(at.x, at.z), `${start.x},${start.z}: ${at.x.toFixed(1)},${at.z.toFixed(1)}`).toBe(true);
    }
  });

  it("gives no way from row N's roof or the pipe walk up onto the hall's +16", () => {
    const sim = hallSim();
    for (const [start, yaw] of [
      [w3(2530, W3_ROOF, 432), Math.PI],
      [w3(2560, W3_ROOF, 431), Math.PI],
      [w3(2520, W3_ROOF + 1.4, 438), Math.PI],
      [w3(2505, W3_ROOF, 425), -Math.PI / 2],
      [w3(2484.5, W3_ROOF - 0.4, 442.55), -Math.PI / 2],
    ] as [Vec3, number][]) {
      const { top } = jump(sim, start, yaw);
      expect(top - W3_Y, `${start.x},${start.z}`).toBeLessThan(13);
    }
  });
});

describe("W-3's culvert (ADR-0082 stage 2)", () => {
  const mid = (L.CULVERT_Z.minZ + L.CULVERT_Z.maxZ) / 2;
  const mouth = w3(2463, L.CULVERT_MOUTH.floor, mid);

  it("is crawled through crouching, from the river's bench down into the basement", () => {
    const sim = hallSim(mouth);
    teleportPlayer(sim, mouth, Math.PI / 2);
    run(sim, 10, input({ crouch: true }));
    for (let i = 0; i < 60 * 30 && sim.player()!.position.x < 2516; i++) sim.step(input({ moveZ: 1, crouch: true }));
    const p = sim.player()!.position;
    expect(p.x).toBeGreaterThan(2515);
    expect(p.y).toBeCloseTo(W3_Y + L.BASEMENT_FLOOR, 1);
    expect(sim.session.interior).toBe("w3-basement");
  });

  it("stops a standing body at its mouth, and keeps one crouched inside who lets the key go", () => {
    const sim = hallSim(mouth);
    teleportPlayer(sim, mouth, Math.PI / 2);
    run(sim, 300, input({ moveZ: 1 }));
    expect(sim.player()!.position.x).toBeLessThan(L.CULVERT_CRAWL.minX);
    teleportPlayer(sim, w3(2480, L.CULVERT_CRAWL.floor, mid), Math.PI / 2);
    run(sim, 10, input({ crouch: true }));
    run(sim, 40, input({ moveZ: 1 }));
    expect(sim.player()!.posture?.amount).toBe(1);
    expect(sim.player()!.position.x).toBeGreaterThan(2481);
  });
});
