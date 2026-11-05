import { describe, expect, it } from "vitest";
import { ALCHEMIA_CENTRE, ALCHEMIA_MODULES, FLIGHT_GOING, FLIGHT_MAX_RISE, MAP_CHUNKS, PARKED_CARS, Simulation, WORLD_STREET_PROPS, alchemiaPoint, gangerEntity, type AlchemiaPart, type PlacedAlchemiaModule } from "../src";
import { CROWD_LANES } from "../src/content/crowd";
import { LUBLIN_PROP_TABLE } from "../src/content/lublin/props.generated";
import { flightSteps } from "../src/content/alchemia-stairs";
import { surfaceY } from "../src/content/lublin/terrain";
import { STEP_HEIGHT } from "../src/systems/movement-system";
import { input, teleportPlayer } from "./helpers";

/**
 * The ways up of Alchemia (G-287, G-288): every stall has a flight of steps from the paving to
 * its door, the hall one to the podium at the foot of its outside stair, each step within a step
 * of the next and the last within one of the paving, all of them off the paths, the furniture
 * and the residents' loops; and an NPC passing by along their fronts and the hall's stair does
 * not get stuck on them.
 */

type Pt = { readonly x: number; readonly z: number };

const ring = (flat: readonly number[]): Pt[] => Array.from({ length: flat.length / 2 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));

const inside = (p: Pt, poly: readonly Pt[]): boolean => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

/** The step's rectangle in the model's frame: x0, x1, z0, z1. */
const span = (q: AlchemiaPart): readonly [number, number, number, number] => {
  const xs = q.points.map((p) => p[0]);
  const zs = q.points.map((p) => p[1]);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
};

/** Points over a step every quarter metre, its edges included, in the world. */
const stepSamples = (m: PlacedAlchemiaModule, q: AlchemiaPart, pad = 0): Pt[] => {
  const [x0, x1, z0, z1] = span(q);
  const out: Pt[] = [];
  const nx = Math.ceil((x1 - x0 + 2 * pad) / 0.25);
  const nz = Math.ceil((z1 - z0 + 2 * pad) / 0.25);
  for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) out.push(alchemiaPoint(m, x0 - pad + ((x1 - x0 + 2 * pad) * i) / nx, z0 - pad + ((z1 - z0 + 2 * pad) * k) / nz));
  return out;
};

/** True when a world point lies on the step (or within `pad` of it). */
const onStep = (m: PlacedAlchemiaModule, q: AlchemiaPart, p: Pt, pad: number): boolean => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  // The inverse of `alchemiaPoint`.
  const x = -dx * fz + dz * fx;
  const z = dx * fx + dz * fz;
  const [x0, x1, z0, z1] = span(q);
  return x >= x0 - pad && x <= x1 + pad && z >= z0 - pad && z <= z1 + pad;
};

/** The paving's height over the module's floor at a point of its frame. */
const paving = (m: PlacedAlchemiaModule, x: number, z: number): number => {
  const p = alchemiaPoint(m, x, z);
  return surfaceY(p.x, p.z) - m.floor;
};

/** Seconds a Hebi brawler alerted at `from` takes to get within 2 m of the player at `to`, or null; and its lowest speed over any second of the way. */
const chase = (from: Pt, to: Pt, seconds: number): number | null => {
  const sim = Simulation.create({ seed: 5 });
  teleportPlayer(sim, { x: to.x, y: surfaceY(to.x, to.z), z: to.z });
  sim.step();
  const ground = sim.streamer.ground;
  const p = sim.player()!;
  p.position = { x: to.x, y: ground.heightAt(to.x, to.z), z: to.z };
  p.prevPosition = p.position;
  const g = gangerEntity(9001, { key: "g287-passer", position: { x: from.x, y: ground.heightAt(from.x, from.z), z: from.z }, yaw: 0 }, null, 200, "krakowskie-2-1", undefined, "hebi_brawler");
  g.ai!.alerted = true;
  sim.world.add(g);
  for (let i = 0; i < 60 * seconds; i++) {
    sim.step();
    if (Math.hypot(g.position.x - p.position.x, g.position.z - p.position.z) < 2 && Math.abs(g.position.y - p.position.y) < 1) return i / 60;
  }
  return null;
};

/** A player set down at a point of the hall's frame on `y` over its floor, walking through `way` (points of its frame): where it ends, over the floor. */
const walk = (y: number, way: readonly (readonly [number, number])[]): { x: number; y: number; z: number } => {
  const sim = Simulation.create({ seed: 7 });
  const [sx, sz] = way[0]!;
  const start = alchemiaPoint(hall, sx, sz);
  teleportPlayer(sim, { x: start.x, y: hall.floor + y, z: start.z });
  for (let i = 0; i < 10; i++) sim.step();
  const p = sim.player()!;
  for (const [x, z] of way.slice(1)) {
    const to = alchemiaPoint(hall, x, z);
    for (let i = 0; i < 240 && Math.hypot(to.x - p.position.x, to.z - p.position.z) > 0.15; i++) {
      p.yaw = Math.atan2(to.x - p.position.x, to.z - p.position.z);
      sim.step(input({ moveZ: 1 }));
    }
  }
  const fx = Math.sin(hall.yaw);
  const fz = Math.cos(hall.yaw);
  const dx = p.position.x - hall.x;
  const dz = p.position.z - hall.z;
  return { x: -dx * fz + dz * fx, y: p.position.y - hall.floor, z: dx * fx + dz * fz };
};

const stalls = ALCHEMIA_MODULES.filter((m) => m.key.startsWith("alchemia-stall"));
const hall = ALCHEMIA_MODULES[0]!;

describe("the ways up of Alchemia (G-287, G-288)", () => {
  it("comes down from each stall's door and from the hall's podium to the paving in steps a body walks", () => {
    for (const m of ALCHEMIA_MODULES) {
      // A stall's flight from its door, the hall's at its stair's foot and before its front (G-299).
      expect(m.flights, m.key).toHaveLength(m === hall ? 2 : 1);
      const flights = m.flights!.map((f) => ({ f, steps: flightSteps(f, (x, z) => paving(m, x, z)) }));
      expect(m.steps, m.key).toEqual(flights.flatMap((q) => q.steps));
      for (const { f, steps } of flights) {
        expect(steps.length, m.key).toBeGreaterThan(0);
        // The threshold at the door (or the podium) and then down, a riser at most `FLIGHT_MAX_RISE` each.
        expect(steps[0]!.top, m.key).toBeCloseTo(f.top, 9);
        for (let i = 1; i < steps.length; i++) {
          const rise = steps[i - 1]!.top - steps[i]!.top;
          expect(rise, `${m.key} step ${i}`).toBeGreaterThan(0);
          expect(rise, `${m.key} step ${i}`).toBeLessThanOrEqual(FLIGHT_MAX_RISE + 1e-9);
          const [, , z0, z1] = span(steps[i]!);
          expect(z1 - z0).toBeCloseTo(FLIGHT_GOING, 9);
        }
        // From the last step down to the paving along its outer edge no more than a riser.
        const last = steps[steps.length - 1]!;
        const [x0, x1, z0, z1] = span(last);
        const edge = f.dir > 0 ? z1 : z0;
        let low = Infinity;
        for (let x = x0; x <= x1 + 1e-9; x += (x1 - x0) / 16) low = Math.min(low, paving(m, x, edge));
        expect(last.top - low, m.key).toBeLessThanOrEqual(FLIGHT_MAX_RISE + 1e-6);
        expect(last.top - low, m.key).toBeLessThan(STEP_HEIGHT);
      }
      // Each step's block reaches under the paving it stands on.
      for (const q of m.steps) for (const p of stepSamples(m, q)) expect(m.floor + q.bottom!).toBeLessThan(surfaceY(p.x, p.z));
    }
    // The stalls' steps run across their whole front, the hall's to the podium at its stair's foot and across its front.
    for (const m of stalls) for (const q of m.steps) expect(span(q)[1] - span(q)[0]).toBeCloseTo(m.width, 9);
    const front = hall.flights!.find((f) => f.dir > 0)!;
    expect(front.x1 - front.x0).toBeGreaterThan(hall.width - 0.05);
  });

  it("keeps the steps off the paths and streets, the furniture, the parked cars and the residents' loops", () => {
    const busy = new Set(["road", "sidewalk", "crossing", "footway", "steps", "rail"]);
    // Only what lies round the plot (60 m of its middle) can touch it.
    const close = (p: Pt) => Math.hypot(p.x - ALCHEMIA_CENTRE.x, p.z - ALCHEMIA_CENTRE.z) < 60;
    const round = (r: readonly Pt[]) => Math.min(...r.map((p) => p.x)) < ALCHEMIA_CENTRE.x + 60 && Math.max(...r.map((p) => p.x)) > ALCHEMIA_CENTRE.x - 60 && Math.min(...r.map((p) => p.z)) < ALCHEMIA_CENTRE.z + 60 && Math.max(...r.map((p) => p.z)) > ALCHEMIA_CENTRE.z - 60;
    const ground = MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => busy.has(g.surface)).map((g) => ({ surface: g.surface, ring: ring(g.outline) }))).filter((g) => round(g.ring));
    const parks = MAP_CHUNKS.flatMap((c) => (c.carParks ?? []).map((p) => ring(p.outline))).filter(round);
    expect(ground.length).toBeGreaterThan(5);
    const furniture: Pt[] = [];
    for (const kinds of Object.values(LUBLIN_PROP_TABLE)) for (const rows of Object.values(kinds) as number[][]) for (let i = 0; i < rows.length; i += 5) furniture.push({ x: rows[i]!, z: rows[i + 2]! });
    for (const items of Object.values(WORLD_STREET_PROPS)) for (const it of items) furniture.push({ x: it.x, z: it.z });
    const lanes = CROWD_LANES.flatMap((l) => l.points.map(([x, z]) => ({ x, z })));
    expect(furniture.filter(close).length + lanes.filter(close).length).toBeGreaterThan(50);
    for (const m of ALCHEMIA_MODULES) {
      for (const q of m.steps) {
        for (const p of stepSamples(m, q)) {
          for (const g of ground) expect(inside(p, g.ring), `${m.key}'s step on a ${g.surface} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).toBe(false);
          for (const r of parks) expect(inside(p, r), `${m.key}'s step on a car park`).toBe(false);
        }
        for (const p of furniture.filter(close)) expect(onStep(m, q, p, 0.3), `furniture at (${p.x}, ${p.z}) on ${m.key}'s steps`).toBe(false);
        for (const p of lanes.filter(close)) expect(onStep(m, q, p, 0.5), `a loop at (${p.x}, ${p.z}) over ${m.key}'s steps`).toBe(false);
        for (const p of PARKED_CARS.filter(close)) expect(onStep(m, q, p, 1.5), `a car by ${m.key}'s steps`).toBe(false);
      }
    }
  });

  it("lets an NPC pass along the stalls' fronts and the hall's stair without getting stuck on the steps", () => {
    const at = (m: PlacedAlchemiaModule, x: number, z: number) => alchemiaPoint(m, x, z);
    const first = stalls[0]!;
    const fifth = stalls[4]!;
    // On the paving in front of the stalls, past their steps by the residents' loop, two stalls at a time,
    // and from beside the flights at both ends of the row (1 m out), round their side walls.
    const along = [at(first, first.width / 2 + 1.5, first.depth / 2 + 3.2), ...stalls.map((m) => at(m, 0, m.depth / 2 + 3.2)), at(fifth, -fifth.width / 2 - 1.5, fifth.depth / 2 + 3.2)];
    const ways: [Pt, Pt, string][] = along.slice(2).map((b, i) => [along[i]!, b, `along the fronts ${i}`]);
    ways.push([at(first, first.width / 2 + 1.2, first.depth / 2 + 1), along[2]!, "round the south end"]);
    ways.push([at(fifth, -fifth.width / 2 - 1.2, fifth.depth / 2 + 1), along[4]!, "round the north end"]);
    for (const [a, b, name] of ways) {
      expect(chase(a, b, 20), name).not.toBeNull();
      expect(chase(b, a, 20), `${name}, back`).not.toBeNull();
    }
    // Along the hall's stair side, past the foot of its steps at the back.
    const c = at(hall, 6.8, 4);
    const d = at(hall, 1, -9.5);
    expect(chase(c, d, 40), "round the hall's stair").not.toBeNull();
    expect(chase(d, c, 40), "back round the hall's stair").not.toBeNull();
  }, 120_000);

  it("takes a body from the stair's landing onto the balcony of the upper storey, as drawn (G-297)", () => {
    const end = walk(6.64, [[3.2, 1.6], [1.4, 3.2], [0.9, 4]]);
    expect(Math.hypot(end.x - 0.9, end.z - 4)).toBeLessThan(0.3);
    expect(end.y).toBeCloseTo(6.64, 1);
  });

  it("takes a body from the paving in front of the hall up its steps onto the podium, under the porch to the shut doors (G-299)", () => {
    for (const x of [-3, 0, 3.2]) {
      const end = walk(paving(hall, x, 9), [[x, 9], [x, 4.6], [Math.min(x, 0), 3.4]]);
      expect(Math.hypot(end.x - Math.min(x, 0), end.z - 3.4), `from x ${x}`).toBeLessThan(0.3);
      expect(end.y, `from x ${x}`).toBeCloseTo(1.23, 1);
    }
  });
});
