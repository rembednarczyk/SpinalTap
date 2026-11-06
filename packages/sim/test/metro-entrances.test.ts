import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import { CONTRACT_SITE_SPAWNS, CROWD_LANES, ENCOUNTERS, METRO_ENTRANCES, METRO_FOOTPRINTS, SCHEDULES, SECURITY_ENTRIES, Simulation, WORLD_NAV, WORLD_STASHES } from "../src";
import { WORLD_STREET_PROPS } from "../src/content/street-props";
import type { Rect } from "../src/content/builders";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { lineOfSight } from "../src/world/hitscan";
import { circleTouchesPrism } from "../src/world/prism";
import { teleportPlayer, run } from "./helpers";

/**
 * Where the metro's entrances stand (ADR-0071 stage 2, "Kontrole"): measured from the pavilion's
 * outline, not its middle (the topography curator's review). The points of the map's memorials
 * and artworks are the glitch scan's (`metro-entrance-near-heritage`), from the OSM extracts.
 */

type P = { readonly x: number; readonly z: number };
const toRect = (r: Rect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
const segToRect = (a: P, b: P, r: Rect): number => {
  let best = Infinity;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
  for (let k = 0; k <= n; k++) best = Math.min(best, toRect(r, a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n));
  return best;
};
const lineToRect = (pts: readonly P[], r: Rect, closed = false): number => {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) best = Math.min(best, segToRect(pts[i]!, pts[(i + 1) % pts.length]!, r));
  return best;
};
const grow = (r: Rect, d: number): Rect => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d });
const within = (inner: Rect, outer: Rect): boolean => inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minZ >= outer.minZ && inner.maxZ <= outer.maxZ;

/** Heritage of the map's buildings: a monument, a church, a public building. */
const HERITAGE = new Set(["historic", "church", "civic"]);
/** Half the width of a car's lane, and the pavement a pavilion leaves to the carriageway. */
const LANE_HALF = 1.5;
const PAVEMENT = 2;

/** The room in front of the opening that has to stay free: the stairs' width, 3 m out. */
const front = (e: (typeof METRO_ENTRANCES)[number]): Rect => {
  const { along, opens } = e.spot;
  const o = e.outline;
  const mouth = along === "x" ? (opens > 0 ? o.maxX : o.minX) : opens > 0 ? o.maxZ : o.minZ;
  const [a, b] = [mouth, mouth + opens * 3].sort((p, q) => p - q) as [number, number];
  return along === "x" ? { minX: a, maxX: b, minZ: e.cut.bounds.minZ, maxZ: e.cut.bounds.maxZ } : { minX: e.cut.bounds.minX, maxX: e.cut.bounds.maxX, minZ: a, maxZ: b };
};

const ENTRANCES = METRO_ENTRANCES.map((e) => [`${e.station} ${e.label} ${e.name}`, e] as const);

describe("metro entrances on the map (ADR-0071 stage 2)", () => {
  it("are six, two of them B, and none closer than 60 m to another", () => {
    expect(METRO_ENTRANCES.map((e) => `${e.station}${e.label}`)).toEqual(["shinsekaiA", "kanalA", "kanalB", "targA", "targB", "dokiA"]);
    for (const a of METRO_ENTRANCES) for (const b of METRO_ENTRANCES) if (a !== b) expect(Math.hypot(a.spot.x - b.spot.x, a.spot.z - b.spot.z)).toBeGreaterThan(60);
  });

  it.each(ENTRANCES)("%s: the dug ground stays inside the walls", (_n, e) => {
    expect(within(e.cut.bounds, e.outline)).toBe(true);
    expect(e.cut.floor).toBeLessThan(e.floor);
    expect(within(e.cut.bounds, grow(e.outline, -0.5))).toBe(false);
  });

  it.each(ENTRANCES)("%s: in no building, 15 m off monuments, churches and public buildings", (_n, e) => {
    for (const c of MAP_CHUNKS) {
      for (const b of c.buildings) {
        const ring: P[] = [];
        for (let i = 0; i + 1 < b.outline.length; i += 2) ring.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
        const d = lineToRect(ring, e.outline, true);
        expect(d, `${b.id} ${b.use} ${b.name ?? ""}`).toBeGreaterThan(HERITAGE.has(b.use) ? 15 : 1);
      }
    }
  });

  it.each(ENTRANCES)("%s: a pavement off every car's lane", (_n, e) => {
    for (const r of TRAFFIC_ROUTES) {
      const near = r.points.some(([x, z]) => toRect(e.outline, x, z) < 60);
      if (!near) continue;
      expect(lineToRect(r.points.map(([x, z]) => ({ x, z })), e.outline), r.id).toBeGreaterThan(LANE_HALF + PAVEMENT);
    }
  });

  it.each(ENTRANCES)("%s: off every route, post, node and walkers' lane", (_n, e) => {
    const busy: Vec3[] = [
      ...Object.values(CONTRACT_SITE_SPAWNS).flat(),
      ...SECURITY_ENTRIES,
      ...WORLD_NAV.nodes.map((n) => n.at),
      ...WORLD_STASHES.map((s) => s.at),
      ...ENCOUNTERS.map((x) => ({ x: x.at.x, y: 0, z: x.at.z })),
    ];
    for (const p of busy) expect(toRect(e.outline, p.x, p.z), `${p.x},${p.z}`).toBeGreaterThan(2);
    for (const def of Object.values(SCHEDULES)) {
      for (let i = 0; i < def.stops.length; i++) {
        const stop = def.stops[i]!;
        const prev = def.stops[(i + def.stops.length - 1) % def.stops.length]!;
        expect(lineToRect([prev.path[prev.path.length - 1]!, ...stop.path], e.outline)).toBeGreaterThan(1);
      }
    }
    for (const l of CROWD_LANES) {
      if (!l.points.some(([x, z]) => toRect(e.outline, x, z) < 40)) continue;
      expect(lineToRect(l.points.map(([x, z]) => ({ x, z })), e.outline), l.id).toBeGreaterThan(0.5);
    }
  });

  it.each(ENTRANCES)("%s: 3 m free in front of the opening, no furniture in it or the pavilion", (_n, e) => {
    const room = front(e);
    for (const items of Object.values(WORLD_STREET_PROPS)) {
      for (const p of items) {
        expect(toRect(room, p.x, p.z), `${p.prop} ${p.x},${p.z}`).toBeGreaterThan(0.3);
        expect(toRect(e.outline, p.x, p.z), `${p.prop} ${p.x},${p.z}`).toBeGreaterThan(0.5);
      }
    }
    const sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, e.door);
    run(sim, 2);
    const props = new Set(e.props.map((p) => `${p.center.x},${p.center.y},${p.center.z}`));
    const others = [...sim.world].filter((x) => x.solid && !props.has(`${x.position.x},${x.position.y},${x.position.z}`) && x.interactable?.kind !== "metro");
    for (const x of others) {
      const b = x.solid!;
      const over = (r: Rect) => b.min.x < r.maxX && b.max.x > r.minX && b.min.z < r.maxZ && b.max.z > r.minZ && b.max.y > e.floor - 0.5 && b.min.y < e.street + 3.4;
      if (x.prisms) {
        const hit = (r: Rect) => x.prisms!.some((p) => p.bottom < e.street + 3.4 && p.top > e.floor && circleTouchesPrism(p, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, Math.hypot(r.maxX - r.minX, r.maxZ - r.minZ) / 2));
        expect(over(room) && hit(room), `${x.id} in front`).toBe(false);
        expect(over(e.outline) && hit(e.outline), `${x.id} in the pavilion`).toBe(false);
      } else {
        expect(over(room), `${x.id} in front`).toBe(false);
        expect(over(e.outline), `${x.id} in the pavilion`).toBe(false);
      }
    }
    // Head-high air in front of the opening, and the street there no steeper than a walk.
    for (const t of [0.5, 1.5, 2.5]) {
      const p = { x: (room.minX + room.maxX) / 2 + (e.spot.along === "x" ? e.spot.opens * (t - 1.5) : 0), z: (room.minZ + room.maxZ) / 2 + (e.spot.along === "z" ? e.spot.opens * (t - 1.5) : 0) };
      const y = sim.streamer.ground.heightAt(p.x, p.z);
      expect(lineOfSight(sim.world, { ...p, y: y + 0.4 }, { ...p, y: y + 1.9 })).toBe(true);
      expect(Math.abs(y - e.street)).toBeLessThan(0.5);
    }
  });

  it.each(ENTRANCES)("%s: the roof's eaves clear every solid round it (T-160: Tessen's wall at Nabrzeże)", (_n, e) => {
    const sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, e.door);
    run(sim, 2);
    const props = new Set(e.props.map((p) => `${p.center.x},${p.center.y},${p.center.z}`));
    const top = e.street + 3.1;
    const r = e.roof;
    for (const x of sim.world) {
      if (!x.solid || props.has(`${x.position.x},${x.position.y},${x.position.z}`) || x.interactable?.kind === "metro") continue;
      const b = x.solid;
      const over = b.min.x < r.maxX && b.max.x > r.minX && b.min.z < r.maxZ && b.max.z > r.minZ && b.max.y > top && b.min.y < top + 0.2;
      const hit = !x.prisms || x.prisms.some((p) => p.bottom < top + 0.2 && p.top > top && circleTouchesPrism(p, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, Math.hypot(r.maxX - r.minX, r.maxZ - r.minZ) / 2));
      expect(over && hit, `${x.id} under the eaves`).toBe(false);
    }
  });

  it.each(ENTRANCES)("%s: from the street before the opening to the sill no rise is over 0.25 m (G-333)", (_n, e) => {
    const sim = Simulation.create({ seed: 5 });
    const { along, opens } = e.spot;
    const o = e.outline;
    const mouth = along === "x" ? (opens > 0 ? o.maxX : o.minX) : opens > 0 ? o.maxZ : o.minZ;
    // The landing's sill stands 0.05 m over the street at the opening (`metro-pavilion.ts`).
    const sill = e.street + 0.05;
    for (let w = -1.2; w <= 1.2 + 1e-9; w += 0.1) {
      const x = along === "x" ? mouth + opens * 0.5 : e.spot.x + w;
      const z = along === "x" ? e.spot.z + w : mouth + opens * 0.5;
      const ground = sim.streamer.ground.heightAt(x, z);
      const steps = e.threshold && e.threshold.top > ground ? [ground, e.threshold.top, sill] : [ground, sill];
      for (let i = 1; i < steps.length; i++) expect(steps[i]! - steps[i - 1]!, `across ${w.toFixed(1)}`).toBeLessThan(0.25);
    }
  });

  it("lists every pavilion's outline for the crowd, the traffic and the furniture", () => {
    expect(METRO_FOOTPRINTS).toEqual(METRO_ENTRANCES.map((e) => e.outline));
  });
});
