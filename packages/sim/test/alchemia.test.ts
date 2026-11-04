import { describe, expect, it } from "vitest";
import {
  ALCHEMIA_CHUNK,
  ALCHEMIA_HALL_ROOF,
  ALCHEMIA_LAYOUT,
  ALCHEMIA_LIFT_SITE,
  ALCHEMIA_MODULES,
  ALCHEMIA_PROPS,
  ALCHEMIA_ROOF,
  MAP_CHUNKS,
  PARKED_CARS,
  WORLD_CHUNKS,
  WORLD_STREET_PROPS,
  alchemiaCorners,
  alchemiaParts,
} from "../src/content";
import { CROWD_LANES } from "../src/content/crowd";
import { LUBLIN_PROP_TABLE } from "../src/content/lublin/props.generated";
import { surfaceY } from "../src/content/lublin/terrain";

/**
 * Alchemia on Plac Ofiar Getta (ADR-0063 stage 4): the hall and its stalls stand inside the plot
 * the real plan builds on, off the streets, the car park and the map's own buildings, low, on the
 * ground, and as solids in the plot's chunk.
 */

type Pt = { readonly x: number; readonly z: number };

/** OSM way 1559354343 (the brownfield, `proposed:landuse=retail`) in the game's metres (tools/osm-import's projection). */
const PLOT: readonly Pt[] = [
  [478.5, 131.9], [477.9, 127.2], [476.2, 124.4], [452.5, 65.2], [451.7, 63.3], [446.1, 47.7], [440.1, 30.9],
  [438.6, 29.7], [396.5, 42.4], [406.1, 65.3], [435.4, 125.6], [437.1, 128.2], [446.3, 136.0], [458.8, 139.2],
].map(([x, z]) => ({ x: x!, z: z! }));

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

const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
};

const edgeDist = (p: Pt, poly: readonly Pt[], closed = true): number => {
  let d = Infinity;
  for (let i = closed ? 0 : 1; i < poly.length; i++) d = Math.min(d, segDist(p, poly[(i + poly.length - 1) % poly.length]!, poly[i]!));
  return d;
};

/** Points along a module's walls, every half metre, and its middle. */
const samples = (m: (typeof ALCHEMIA_LAYOUT)[number]): Pt[] => {
  const c = alchemiaCorners(m);
  const out: Pt[] = [{ x: m.x, z: m.z }];
  c.forEach((a, i) => {
    const b = c[(i + 1) % c.length]!;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5);
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  });
  return out;
};

/** True when a point lies in the module's footprint (grown by `pad`). */
const inModule = (p: Pt, m: (typeof ALCHEMIA_LAYOUT)[number], pad = 0): boolean => {
  const fx = Math.sin(m.yaw);
  const fz = Math.cos(m.yaw);
  const dx = p.x - m.x;
  const dz = p.z - m.z;
  return Math.abs(dx * fz - dz * fx) <= m.width / 2 + pad && Math.abs(dx * fx + dz * fz) <= m.depth / 2 + pad;
};

describe("Alchemia on Plac Ofiar Getta (ADR-0063 stage 4)", () => {
  it("stands inside the plot w1559354343, a metre or more in from its fence", () => {
    expect(ALCHEMIA_LAYOUT.map((m) => m.key)).toEqual(["alchemia-hall", "alchemia-stall-1", "alchemia-stall-2", "alchemia-stall-3", "alchemia-stall-4", "alchemia-stall-5"]);
    for (const m of ALCHEMIA_LAYOUT)
      for (const p of samples(m)) {
        expect(inside(p, PLOT), `${m.key} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`).toBe(true);
        expect(edgeDist(p, PLOT), m.key).toBeGreaterThan(1);
      }
  });

  it("keeps off the streets, the car park, the paths and the map's buildings, and its modules off each other", () => {
    const busy = new Set(["road", "sidewalk", "crossing", "footway", "steps", "rail"]);
    const ground = MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => busy.has(g.surface)).map((g) => ({ surface: g.surface, ring: ring(g.outline) })));
    const parks = MAP_CHUNKS.flatMap((c) => (c.carParks ?? []).map((p) => ring(p.outline)));
    const buildings = MAP_CHUNKS.flatMap((c) => c.buildings.map((b) => ({ id: b.id, ring: ring(b.outline).map((p) => ({ x: p.x + b.x, z: p.z + b.z })) })));
    const streets = MAP_CHUNKS.flatMap((c) => c.streets.filter((s) => /Świętoduska|Lubartowska|Bajkowskiego/.test(s.name)).map((s) => ({ name: s.name, line: ring(s.line) })));
    expect(new Set(streets.map((s) => s.name)).size).toBe(3);
    for (const m of ALCHEMIA_LAYOUT) {
      for (const p of samples(m)) {
        for (const g of ground) expect(inside(p, g.ring), `${m.key} on a ${g.surface}`).toBe(false);
        for (const r of parks) expect(inside(p, r), `${m.key} on a car park`).toBe(false);
        for (const b of buildings) expect(inside(p, b.ring), `${m.key} in ${b.id}`).toBe(false);
        // Half a carriageway and its pavement off the streets' axes.
        for (const s of streets) expect(edgeDist(p, s.line, false), `${m.key} by ${s.name}`).toBeGreaterThan(8);
      }
      for (const b of buildings) for (const q of b.ring) expect(inModule(q, m, 0.5), `${b.id} in ${m.key}`).toBe(false);
      for (const o of ALCHEMIA_LAYOUT) if (o !== m) for (const p of samples(o)) expect(inModule(p, m, -0.05), `${o.key} in ${m.key}`).toBe(false);
    }
  });

  it("leaves the street furniture, the parked cars and the residents' loops where they are, outside it", () => {
    const furniture: Pt[] = [];
    for (const kinds of Object.values(LUBLIN_PROP_TABLE)) for (const rows of Object.values(kinds) as number[][]) for (let i = 0; i < rows.length; i += 5) furniture.push({ x: rows[i]!, z: rows[i + 2]! });
    for (const items of Object.values(WORLD_STREET_PROPS)) for (const it of items) furniture.push({ x: it.x, z: it.z });
    const cars = PARKED_CARS.map((c) => ({ x: c.x, z: c.z }));
    const lanes = CROWD_LANES.flatMap((l) => l.points.map(([x, z]) => ({ x, z })));
    expect(furniture.length).toBeGreaterThan(1000);
    for (const m of ALCHEMIA_LAYOUT) {
      for (const p of furniture) expect(inModule(p, m, 0.3), `furniture at (${p.x}, ${p.z}) in ${m.key}`).toBe(false);
      for (const p of cars) expect(inModule(p, m, 1.5), `a car at (${p.x}, ${p.z}) in ${m.key}`).toBe(false);
      for (const p of lanes) expect(inModule(p, m, 0.5), `a loop at (${p.x}, ${p.z}) through ${m.key}`).toBe(false);
    }
  });

  it("is a low pavilion stepping down the slope, each module on the paving with its plinth under the lowest of it", () => {
    for (const m of ALCHEMIA_MODULES) {
      expect(m.height, m.key).toBeLessThan(m.key === "alchemia-hall" ? 13.5 : 9.5);
      const ys = samples(m).map((p) => surfaceY(p.x, p.z));
      // On the highest paving under it (sampled every metre; its walls every half metre here), sunk a few centimetres at most.
      expect(m.floor, m.key).toBeLessThanOrEqual(Math.max(...ys) + 1e-6);
      expect(m.floor, m.key).toBeGreaterThan(Math.max(...ys) - 0.05);
      expect(m.base).toBeLessThan(Math.min(...ys));
      // Never a storey of plinth: the terrain under a module falls 3 m at most.
      expect(m.floor - m.base, m.key).toBeLessThan(3.3);
    }
    const floors = ALCHEMIA_MODULES.map((m) => m.floor);
    expect(new Set(floors.map((f) => f.toFixed(1))).size).toBeGreaterThan(3);
  });

  it("is solid in the plot's chunk: each module a prism from its plinth to its top, drawn by the engine", () => {
    const chunk = WORLD_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!;
    expect(chunk.rooms).toEqual(expect.arrayContaining([...ALCHEMIA_PROPS]));
    expect(WORLD_CHUNKS.filter((c) => c.rooms?.some((r) => ALCHEMIA_PROPS.includes(r)))).toHaveLength(1);
    ALCHEMIA_PROPS.forEach((p, i) => {
      const m = ALCHEMIA_MODULES[i]!;
      expect(p.solid && p.scenery).toBe(true);
      expect(p.center.y).toBe(m.base);
      expect(p.prisms).toHaveLength(m.key === "alchemia-hall" ? 3 : 1);
      const tops = p.prisms!.map((q) => q.top + m.base - m.floor);
      expect(Math.max(...tops)).toBeLessThanOrEqual(m.height);
      for (const q of p.prisms!) for (const c of q.points) expect(inModule({ x: c.x + p.center.x, z: c.z + p.center.z }, m, 1e-6)).toBe(true);
      // The parts tile the footprint: their areas add up to the module's.
      const area = alchemiaParts(m).reduce((a, q) => a + (q.x1 - q.x0) * (q.z1 - q.z0), 0);
      expect(area).toBeCloseTo(m.width * m.depth, 6);
    });
  });

  it("keeps the hall's flat roof a floor to stand on and the lift's site clear, for the stages to come", () => {
    const hall = ALCHEMIA_MODULES[0]!;
    const body = ALCHEMIA_PROPS[0]!.prisms![0]!;
    expect(body.top + hall.base).toBeCloseTo(ALCHEMIA_ROOF.y, 6);
    expect(ALCHEMIA_ROOF.y - hall.floor).toBeCloseTo(ALCHEMIA_HALL_ROOF, 6);
    // Some 6 × 7 m of roof, inside the hall's footprint.
    const [a, b, c] = ALCHEMIA_ROOF.corners;
    expect(Math.hypot(b!.x - a!.x, b!.z - a!.z) * Math.hypot(c!.x - b!.x, c!.z - b!.z)).toBeGreaterThan(40);
    for (const q of ALCHEMIA_ROOF.corners) expect(inModule(q, hall, 1e-6)).toBe(true);
    // The lift: 3 × 3 m against the hall's back, inside the plot, off the stalls, the paths and the map's buildings.
    const lift = { key: "lift", x: ALCHEMIA_LIFT_SITE.centre.x, z: ALCHEMIA_LIFT_SITE.centre.z, yaw: ALCHEMIA_LIFT_SITE.yaw, width: ALCHEMIA_LIFT_SITE.size, depth: ALCHEMIA_LIFT_SITE.size, height: 12 };
    const busy = new Set(["road", "sidewalk", "crossing", "footway", "steps", "rail"]);
    const ground = MAP_CHUNKS.flatMap((ch) => ch.ground.filter((g) => busy.has(g.surface)).map((g) => ring(g.outline)));
    const buildings = MAP_CHUNKS.flatMap((ch) => ch.buildings.map((bd) => ring(bd.outline).map((p) => ({ x: p.x + bd.x, z: p.z + bd.z }))));
    for (const p of samples(lift)) {
      expect(inside(p, PLOT)).toBe(true);
      for (const g of ground) expect(inside(p, g)).toBe(false);
      for (const bd of buildings) expect(inside(p, bd)).toBe(false);
      for (const m of ALCHEMIA_LAYOUT) expect(inModule(p, m, -0.05), m.key).toBe(false);
    }
    // Against the back wall: half a metre or less off it.
    const back = (ALCHEMIA_LIFT_SITE.centre.x - hall.x) * Math.sin(hall.yaw) + (ALCHEMIA_LIFT_SITE.centre.z - hall.z) * Math.cos(hall.yaw);
    expect(-back - hall.depth / 2 - ALCHEMIA_LIFT_SITE.size / 2).toBeLessThan(0.5);
  });
});
