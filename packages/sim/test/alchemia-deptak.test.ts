import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, figureLayout } from "@seki/core";
import {
  ALCHEMIA_PROPS,
  ARCADE_FRONT,
  DEPTAK_CROWD,
  DEPTAK_KIOSKS,
  DEPTAK_PROPS,
  DEPTAK_STALLS,
  L2_SLABS,
  L2_TOP,
  L3,
  L3_TOP,
  PLAZA_RISER,
  PLAZA_STEPS,
  PLAZA_TOP,
  PODIUM,
  P1_RAMP,
  Simulation,
  TERRACE_PEOPLE,
  WORLD_SCENERY,
  deptakStallPieces,
  groundY,
  stallSeller,
  surfaceY,
} from "../src";
import { C7_PROPS, DEPTAK_SOLID_PROPS, FRONT_GREEN_PROPS } from "../src/content/alchemia";
import { surfacesAt } from "../src/content/lublin/roads";
import { teleportPlayer } from "./helpers";

/*
 * C7 of the board 1:1 (ADR-0074, 20.11): the deptak's stalls dressed with their sellers, goods and
 * traces, the customers at them, the people on the front's terraces, and the stairs by the ramp
 * (C5's south flight at the ramp's parapet, as the board's). Measured by their pieces and a stepped player.
 */

/** Metro B's way onto the deptak (`tools/glitch-scan/test/deptak-checks.ts`, the curator's plan §4). */
const METRO_B_WAY = { minX: 431.6, maxX: 447, minZ: 26, maxZ: 30 } as const;
/** The deptak's axis (w216497220, T-324) and the trolleybus's line 1.6 m east of it. */
const AXIS = [
  { x: 442.9, z: -9.9 },
  { x: 454.9, z: 42.8 },
] as const;
const offAxis = (x: number, z: number): number => {
  const [a, b] = AXIS;
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  return ((x - a.x) * dz - (z - a.z) * dx) / Math.hypot(dx, dz);
};
const KEEP_OFF = new Set(["footway", "sidewalk", "road", "crossing", "steps"]);

const DRAWN = deptakStallPieces();
const SOLIDS = DRAWN.filter((p) => p.solid);

describe("the deptak's stalls dressed (ADR-0074 C7)", () => {
  it("finds the map's three market stalls and three kiosks on the deptak", () => {
    expect(DEPTAK_STALLS).toHaveLength(3);
    expect(DEPTAK_KIOSKS).toHaveLength(3);
  });

  it("puts a seller behind each stall's counter, facing out, a still figure standing on the setts", () => {
    const sellers = DEPTAK_PROPS.filter((p) => p.prop === "figure");
    expect(sellers).toHaveLength(DEPTAK_STALLS.length);
    for (const [i, s] of sellers.entries()) {
      const stall = DEPTAK_STALLS[i]!;
      expect(figureLayout(s.variant).seat).toBe(0);
      expect(s.yaw).toBe(stall.yaw);
      // Inside the canopy's posts, behind the counter (its back 0.3 m out of the stall's middle).
      const out = (s.x - stall.x) * Math.sin(stall.yaw) + (s.z - stall.z) * Math.cos(stall.yaw);
      expect(out).toBeLessThan(0);
      expect(out).toBeGreaterThan(-0.7);
      expect(s).toMatchObject(stallSeller(stall));
      expect(s.y).toBe(stall.y);
    }
  });

  it("dresses each stall in three layers: crates of produce on the counter, a holo tag, a lamp; cartons, a cable, a flyer; the seller's tea steaming", () => {
    const kinds = new Set(DRAWN.map((p) => p.kind));
    for (const k of ["crate", "goods", "flower", "holo", "lamp", "carton", "cable", "paper", "cup", "steam"] as const) expect(kinds.has(k), k).toBe(true);
    // A stack of crates between the vegetable stalls, solid (drawn crates: a `market-goods` model would cost its furniture block a mesh).
    expect(SOLIDS.filter((p) => p.kind === "crate")).toHaveLength(3);
    expect(DEPTAK_PROPS.every((p) => p.prop === "figure")).toBe(true);
    // The cables hang over heads: from the trolleybus's pole at 2.6 m to the canopy.
    for (const c of DRAWN.filter((p) => p.kind === "cable")) expect(c.box.y1 - groundY((c.box.x0 + c.box.x1) / 2, (c.box.z0 + c.box.z1) / 2)).toBeGreaterThan(2.1);
  });

  it("keeps every solid and model on the deptak's setts: off the footways, the parking lane, metro B's way and 1.4 m off the trolleybus's line", () => {
    const off: string[] = [];
    const corners = [
      ...SOLIDS.flatMap((p) => [
        { x: p.box.x0, z: p.box.z0 },
        { x: p.box.x1, z: p.box.z0 },
        { x: p.box.x0, z: p.box.z1 },
        { x: p.box.x1, z: p.box.z1 },
      ]),
      ...DEPTAK_PROPS.map((p) => ({ x: p.x, z: p.z })),
    ];
    for (const q of corners) {
      const s = surfacesAt(q.x, q.z);
      if (s.some((k) => KEEP_OFF.has(k))) off.push(`${q.x.toFixed(2)},${q.z.toFixed(2)} ${s.join("+")}`);
      if (q.x > METRO_B_WAY.minX && q.x < METRO_B_WAY.maxX && q.z > METRO_B_WAY.minZ && q.z < METRO_B_WAY.maxZ) off.push(`${q.x},${q.z} in metro B's way`);
      // West of the line (1.6 m east of the axis) by its room and more.
      expect(1.6 - offAxis(q.x, q.z)).toBeGreaterThan(1.4);
    }
    expect(off).toEqual([]);
  });

  it("puts its solids in props of their own, the last of Alchemia's, and its models in the last view of the scenery", () => {
    expect(ALCHEMIA_PROPS.slice(-DEPTAK_SOLID_PROPS.length)).toEqual(DEPTAK_SOLID_PROPS);
    const prisms = DEPTAK_SOLID_PROPS.reduce((n, p) => n + (p.prisms?.length ?? 0), 0);
    expect(prisms).toBeGreaterThanOrEqual(SOLIDS.length);
    expect(WORLD_SCENERY.at(-1)!.view).toEqual({ kind: "street-props", items: C7_PROPS });
  });

  it("stands a customer of the crowd before each kiosk's window and each vegetable stall's counter, facing it", () => {
    expect(DEPTAK_CROWD).toHaveLength(DEPTAK_KIOSKS.length + DEPTAK_STALLS.length - 1);
    for (const c of DEPTAK_CROWD) {
      const host = [...DEPTAK_KIOSKS, ...DEPTAK_STALLS].sort((a, b) => Math.hypot(a.x - c.at.x, a.z - c.at.z) - Math.hypot(b.x - c.at.x, b.z - c.at.z))[0]!;
      expect(Math.hypot(host.x - c.at.x, host.z - c.at.z)).toBeLessThan(1.8);
      // Facing the host's front.
      const look = Math.atan2(host.x - c.at.x, host.z - c.at.z);
      expect(Math.abs(Math.atan2(Math.sin(look - c.yaw), Math.cos(look - c.yaw)))).toBeLessThan(0.4);
      // Not where a seller stands.
      for (const s of DEPTAK_PROPS.filter((p) => p.prop === "figure")) expect(Math.hypot(s.x - c.at.x, s.z - c.at.z)).toBeGreaterThan(1.2);
      expect(c.chunk).toBe("krakowskie-2-1");
    }
  });
});

describe("the people on the front's terraces (ADR-0074 C7)", () => {
  /** The terraces they may stand on: the house with arcades' roof, L2's south strip and its part east of L3 (L2_TOP), L3's roof. */
  const terraces = [
    { y: L2_TOP, minX: ARCADE_FRONT.minX, maxX: ARCADE_FRONT.maxX, minZ: ARCADE_FRONT.minZ, maxZ: ARCADE_FRONT.maxZ },
    { y: L2_TOP, minX: L2_SLABS[0]!.minX, maxX: L2_SLABS[0]!.maxX, minZ: L2_SLABS[0]!.minZ, maxZ: L3.minZ },
    { y: L2_TOP, minX: L3.maxX, maxX: L2_SLABS[1]!.maxX, minZ: L2_SLABS[1]!.minZ, maxZ: L2_SLABS[1]!.maxZ },
    { y: L3_TOP, ...L3 },
  ];

  it("stands a dozen and more on the roofs' tops, a step in from their edges, standing", () => {
    expect(TERRACE_PEOPLE.length).toBeGreaterThanOrEqual(15);
    for (const p of TERRACE_PEOPLE) {
      expect(figureLayout(p.variant).seat, `${p.x},${p.z}`).toBe(0);
      const on = terraces.find((t) => p.y === t.y && p.x > t.minX + 0.5 && p.x < t.maxX - 0.5 && p.z > t.minZ + 0.5 && p.z < t.maxZ - 0.5);
      expect(on, `${p.x},${p.y},${p.z}`).toBeDefined();
    }
    // On every level of the board's: the arcade's roof and L2, and L3.
    expect(TERRACE_PEOPLE.filter((p) => p.y === L2_TOP).length).toBeGreaterThanOrEqual(8);
    expect(TERRACE_PEOPLE.filter((p) => p.y === L3_TOP).length).toBeGreaterThanOrEqual(6);
  });

  it("keeps them clear of the terraces' shrubs, planters and trees, each other and the umbrellas' tables", () => {
    const green = FRONT_GREEN_PROPS.filter((g) => g.y >= L2_TOP - 0.01);
    for (const p of TERRACE_PEOPLE) {
      for (const g of green.filter((g) => Math.abs(g.y - p.y) < 1)) expect(Math.hypot(g.x - p.x, g.z - p.z), `${p.x},${p.z} by ${g.prop} ${g.x},${g.z}`).toBeGreaterThan(0.75);
      for (const q of TERRACE_PEOPLE) if (q !== p) expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(0.7);
      if (p.y === L3_TOP) {
        // The tables (`front-dress.ts`): 1 m square, every other one 1.5 m further north; a body 0.25 m off its edge.
        [4, 10, 16, 22].forEach((dx, i) => {
          const [x, z] = [L3.minX + dx, L3.minZ + 3 + (i % 2) * 1.5];
          expect(Math.abs(p.x - x) < 0.75 && Math.abs(p.z - z) < 0.75, `${p.x},${p.z} in the table at ${x},${z}`).toBe(false);
        });
      }
    }
  });
});

describe("the stairs by the ramp (ADR-0074 C7: the board's, C5's south flight at the ramp's parapet)", () => {
  it("runs the south flight's steps up to the ramp's parapet by the rules, as many as the ground leaves", () => {
    const byRamp = PLAZA_STEPS.filter((s) => s.down === "s" && s.box.x1 > PODIUM.maxX - 0.05);
    // The ground lies 0.36 m under the podium at the ramp: two steps of 0.16 and the paving.
    expect(byRamp.map((s) => s.k).sort()).toEqual([1, 2]);
    for (const s of byRamp) {
      expect(s.top).toBeCloseTo(PLAZA_TOP - s.k * PLAZA_RISER, 6);
      expect(s.box.x1).toBeLessThanOrEqual(P1_RAMP.minX);
    }
    const last = byRamp.find((s) => s.k === 2)!;
    expect(last.top - surfaceY(PODIUM.maxX - 0.2, last.box.z0 - 0.1)).toBeLessThanOrEqual(0.18);
  });

  it("takes a stepped player from the ramp's top up the steps by its parapet onto the square, and down again", () => {
    const sim = Simulation.create({ seed: 5 });
    const [x, z] = [PODIUM.maxX - 0.6, P1_RAMP.top - 0.6];
    teleportPlayer(sim, { x, y: groundY(x, z) + 0.05, z }, 0);
    sim.step();
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    const walk = (to: { x: number; z: number }): boolean => {
      for (let i = 0; i < 60 * 10; i++) {
        const p = sim.player()!;
        if (Math.hypot(to.x - p.position.x, to.z - p.position.z) < 0.4) return true;
        const want = Math.atan2(to.x - p.position.x, to.z - p.position.z);
        sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
      }
      return false;
    };
    expect(walk({ x, z: PODIUM.minZ + 1.2 })).toBe(true);
    expect(sim.player()!.position.y).toBeCloseTo(PLAZA_TOP, 1);
    expect(walk({ x, z: P1_RAMP.top - 0.6 })).toBe(true);
    expect(sim.player()!.position.y).toBeCloseTo(groundY(x, P1_RAMP.top - 0.6), 1);
  });
});
