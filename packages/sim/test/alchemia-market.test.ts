import { describe, expect, it } from "vitest";
import type { Vec3 } from "@seki/core";
import {
  ACTIVITY_SPOTS,
  ALCHEMIA_CHUNK,
  ALCHEMIA_MARKET_ACTORS,
  ALCHEMIA_TERRACE,
  CONTRACT_HOOKS,
  CONTRACT_ITEM_SPOTS,
  CROWD_SPOTS,
  DEVICES,
  ENCOUNTERS,
  type Entity,
  REN_SPOT,
  SCHEDULES,
  SITE_PLANS,
  STALL_KEEPERS,
  type ScheduleDef,
  Simulation,
  TARG_CONTRACT_SITE_SPAWNS,
  TARG_OVERPASS_STASH,
  TARG_ROOF_STASH,
  WORLD_CHUNKS,
  chunkAt,
  groundY,
} from "../src";
import { circleTouchesPrism } from "../src/world/prism";
import { run, teleportPlayer } from "./helpers";

/**
 * The market in Alchemia (ADR-0063 stage 6): the people of the market that stood on Aleja
 * Tysiąclecia stand at the stalls and on the square of the food hall, Ren on the hall's roof
 * terrace, the Hebi by the ruin; every place of theirs (and of the jobs, the crowd and the daily
 * plans there) is open ground in the plot's chunk, measured on the simulation's own solids.
 */

const BODY = 0.4;
const MARKET_SITES = ["hana_stall", "hebi_stash", "raid_north", "raid_east"] as const;

/** The world with Alchemia's chunk loaded, nobody in it but the player. */
const loaded = (() => {
  let sim: Simulation | null = null;
  return (): Simulation => {
    if (sim) return sim;
    sim = Simulation.create({ seed: 5 });
    teleportPlayer(sim, { x: 440, y: groundY(440, 60) + 0.05, z: 60 });
    run(sim, 2);
    return sim;
  };
})();

/** The solids a body standing on its feet at `p` would touch (a step underfoot does not count). */
const blockers = (sim: Simulation, p: Vec3): Entity[] =>
  [...sim.world.with("solid")].filter((e) => {
    if (e.player || e.ai) return false;
    const s = e.solid;
    if (s.max.y <= p.y + 0.3 || s.min.y >= p.y + 1.8) return false;
    if (p.x < s.min.x - BODY || p.x > s.max.x + BODY || p.z < s.min.z - BODY || p.z > s.max.z + BODY) return false;
    if (!e.prisms) return true;
    return e.prisms.some((q) => q.top > p.y + 0.3 && q.bottom < p.y + 1.8 && circleTouchesPrism(q, p.x, p.z, BODY));
  });

const where = (p: Vec3): string => `(${p.x.toFixed(1)}, ${p.y.toFixed(2)}, ${p.z.toFixed(1)})`;

/** Points every half metre along a daily plan's paths. */
const planPoints = (def: ScheduleDef): Vec3[] =>
  def.stops.flatMap((stop) =>
    stop.path.slice(1).flatMap((b, k) => {
      const a = stop.path[k]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
      return Array.from({ length: n + 1 }, (_, j) => ({ x: a.x + ((b.x - a.x) * j) / n, y: groundY(a.x + ((b.x - a.x) * j) / n, a.z + ((b.z - a.z) * j) / n), z: a.z + ((b.z - a.z) * j) / n }));
    }),
  );

const onGroundAndClear = (sim: Simulation, points: readonly Vec3[]): string[] =>
  points.flatMap((p) => {
    const out: string[] = [];
    if (chunkAt(p.x, p.z)?.id !== ALCHEMIA_CHUNK) out.push(`${where(p)} outside ${ALCHEMIA_CHUNK}`);
    if (Math.abs(p.y - groundY(p.x, p.z)) > 0.05) out.push(`${where(p)} off the ground ${groundY(p.x, p.z).toFixed(2)}`);
    for (const b of blockers(sim, p)) out.push(`${where(p)} in a solid at ${where(b.position)}`);
    return out;
  });

describe("the market in Alchemia (ADR-0063 stage 6)", () => {
  it("has its people in Alchemia's chunk: the stallholders, Hana, the Hebi, Kurosawa and Ren", () => {
    const chunk = WORLD_CHUNKS.find((c) => c.id === ALCHEMIA_CHUNK)!;
    const keys = chunk.actors.map((a) => a.spawn.key);
    for (const a of ALCHEMIA_MARKET_ACTORS) expect(keys).toContain(a.spawn.key);
    expect(keys).toEqual(expect.arrayContaining(["oyaji", "hana", "sachiko", "kenta", "fumiko", "goro", "ren", "kurosawa", "hebi-lookout"]));
    // Nobody of theirs is left on Podzamcze.
    for (const c of WORLD_CHUNKS.filter((c) => c.district === "targ")) for (const k of keys) expect(c.actors.map((a) => a.spawn.key)).not.toContain(k);
  });

  it("puts every one of them, but Ren, on open ground", () => {
    const sim = loaded();
    const points = ALCHEMIA_MARKET_ACTORS.filter((a) => a.spawn.key !== "ren").map((a) => a.spawn.position);
    expect(onGroundAndClear(sim, [...points, ...Object.values(STALL_KEEPERS)])).toEqual([]);
  });

  it("keeps the jobs' crews, their variations and hooks on open ground", () => {
    const sim = loaded();
    const crews = MARKET_SITES.flatMap((s) => TARG_CONTRACT_SITE_SPAWNS[s]);
    const plans = MARKET_SITES.flatMap((s) => {
      const p = SITE_PLANS[s];
      return [...(p?.guards ?? []), ...(p?.lookout ? [p.lookout] : []), ...(p?.ambush ?? []), ...(p?.twin ? [p.twin] : [])];
    });
    const hooks = CONTRACT_HOOKS.flatMap((h) => ("at" in h.carrier && (h.kind === "protect" || h.kind === "retrieve") ? [h.carrier.at] : []));
    expect(hooks.length).toBeGreaterThan(0);
    expect(onGroundAndClear(sim, [...crews, ...plans, ...hooks])).toEqual([]);
    // The crate of a retrieval lies on the ground by the stash.
    const crate = CONTRACT_ITEM_SPOTS.hebi_stash!;
    expect(crate.y - groundY(crate.x, crate.z)).toBeCloseTo(0.3, 2);
  });

  it("keeps the daily plans, the crowd, the activity spots and the devices in the chunk, clear of solids", () => {
    const sim = loaded();
    const plans = ["oyaji", "fumiko", "hebi-lookout"].flatMap((k) => planPoints(SCHEDULES[k]!));
    // The square's own standers (the chunk's benches elsewhere hold seated ones).
    const crowd = CROWD_SPOTS.filter((s) => s.chunk === ALCHEMIA_CHUNK && Math.hypot(s.at.x - 438, s.at.z - 85) < 40).map((s) => s.at);
    const spots = ACTIVITY_SPOTS.filter((s) => s.id.startsWith("targ-")).map((s) => s.at);
    expect(crowd.length).toBeGreaterThanOrEqual(10);
    expect(spots.length).toBeGreaterThanOrEqual(5);
    // The street encounters of the market stay on Podzamcze's streets (ADR-0032): none here.
    expect(ENCOUNTERS.filter((e) => chunkAt(e.at.x, e.at.z)?.id === ALCHEMIA_CHUNK)).toEqual([]);
    expect(onGroundAndClear(sim, [...plans, ...crowd, ...spots])).toEqual([]);
    for (const d of DEVICES.filter((d) => d.key.startsWith("dev:targ-"))) {
      expect(d.chunk).toBe(ALCHEMIA_CHUNK);
      expect(chunkAt(d.position.x, d.position.z)?.id).toBe(ALCHEMIA_CHUNK);
    }
  });

  it("has Ren on the roof terrace, on its floor, inside its screens, with the roof stash by him", () => {
    const inside = (p: { x: number; z: number }): boolean => {
      const c = ALCHEMIA_TERRACE.corners;
      let sign = 0;
      for (let i = 0; i < c.length; i++) {
        const a = c[i]!;
        const b = c[(i + 1) % c.length]!;
        const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
        if (sign === 0) sign = Math.sign(cross);
        else if (Math.sign(cross) !== sign) return false;
      }
      return true;
    };
    expect(REN_SPOT.y).toBeCloseTo(ALCHEMIA_TERRACE.roof, 6);
    expect(inside(REN_SPOT)).toBe(true);
    expect(inside(TARG_ROOF_STASH.at)).toBe(true);
    expect(Math.hypot(TARG_ROOF_STASH.at.x - REN_SPOT.x, TARG_ROOF_STASH.at.z - REN_SPOT.z)).toBeGreaterThan(1);
    const sim = loaded();
    expect(blockers(sim, REN_SPOT).map((e) => where(e.position))).toEqual([]);
    expect(onGroundAndClear(sim, [{ ...TARG_OVERPASS_STASH.at, y: groundY(TARG_OVERPASS_STASH.at.x, TARG_OVERPASS_STASH.at.z) }])).toEqual([]);
  });
});
