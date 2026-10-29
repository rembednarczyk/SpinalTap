import { describe, expect, it } from "vitest";
import { type DomainState, type GarmentId, type ItemInstance, NO_HEAT, type SaveSnapshot, type Vec3, hm } from "@seki/core";
import {
  KANAL_NIGHT,
  KANAL_PATROL_ACTORS,
  KANAL_PATROL_SCHEDULES,
  SIM_DT,
  type ScheduleDef,
  Simulation,
  type StaticProp,
  WORLD_CHUNKS,
  gangerEntity,
  ground,
  inBuilding,
  nearestWall,
  scheduledPose,
  stateHash,
  type Entity,
} from "../src";
import { isEnforcer } from "../src/world/disguise";
import { byKey, input, run, streetSim, teleportPlayer } from "./helpers";

/**
 * Hebi patrols in Stare Miasto (ADR-0048): where they walk and when, how they take the player
 * (like any ganger, but a neutral player is only watched), and that a save keeps them.
 */

const KEYS = KANAL_PATROL_ACTORS.map((a) => a.spawn.key);
const ticks = (seconds: number) => Math.ceil(seconds / SIM_DT - 1e-9);
const at = (minute: number, second = 0) => ({ seconds: minute * 60 + second });

const skipTo = (sim: Simulation, minute: number) => {
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  const minutes = (minute - now + 1440) % 1440;
  if (minutes > 0) sim.enqueue({ type: "wait", minutes });
  sim.step();
};

const SOLIDS: readonly StaticProp[] = WORLD_CHUNKS.flatMap((c) => c.props).filter((p) => p.solid && p.view.kind === "block" && !p.mechanism);
const blocked = (p: Vec3): boolean =>
  SOLIDS.some((s) => {
    if (s.view.kind !== "block") return false;
    const { x: w, y: h, z: d } = s.view.size;
    if (s.center.y + h / 2 <= p.y + 0.3 || s.center.y - h / 2 >= p.y + 1.8) return false;
    return Math.abs(p.x - s.center.x) < w / 2 + 0.4 && Math.abs(p.z - s.center.z) < d / 2 + 0.4;
  });

/** Every 25 cm of every walk of a plan, each from where the stop before left off. */
const walks = (def: ScheduleDef): Vec3[] => {
  const out: Vec3[] = [];
  def.stops.forEach((stop, i) => {
    const before = def.stops[(i - 1 + def.stops.length) % def.stops.length] ?? stop;
    const from = before.loop ? before.path[0] : (before.path.at(-1) ?? before.path[0]);
    const line = stop.loop ? [from, ...stop.path, stop.path[0]] : [from, ...stop.path];
    for (let k = 1; k < line.length; k++) {
      const a = line[k - 1] as Vec3;
      const b = line[k] as Vec3;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25));
      for (let j = 0; j <= n; j++) out.push(ground(a.x + ((b.x - a.x) * j) / n, a.z + ((b.z - a.z) * j) / n));
    }
  });
  return out;
};

const walking = (minute: number): string[] => KEYS.filter((k) => !scheduledPose(KANAL_PATROL_SCHEDULES[k]!, at(minute)).arrived);

describe("Hebi patrols in Stare Miasto (ADR-0048)", () => {
  it("are four street patrols of Hebi in the Old Town, each with a daily plan", () => {
    expect(KEYS).toEqual(["hebi-rynek", "hebi-grodzka", "hebi-bramowa", "hebi-rynek-noc"]);
    for (const key of KEYS) {
      const chunk = WORLD_CHUNKS.find((c) => c.actors.some((a) => a.spawn.key === key));
      expect(chunk?.district, key).toBe("kanal");
      const def = chunk!.actors.find((a) => a.spawn.key === key)!;
      expect(def.kind === "ganger" && def.patrol).toBe(true);
      expect(KANAL_PATROL_SCHEDULES[key]).toBeDefined();
    }
  });

  it("walk more by night than by day: one round the Rynek all day, all four from 21:00 to 5:00", () => {
    for (const minute of [hm(6), hm(9), hm(12), hm(15), hm(18), hm(20, 50)]) expect(walking(minute), `${minute}`).toEqual(["hebi-rynek"]);
    for (const minute of [hm(21, 30), hm(23), hm(0), hm(2), hm(4, 30)]) expect(walking(minute), `${minute}`).toEqual(KEYS);
  });

  it("keep to the streets: every walk is clear of the houses and of the game's solids", () => {
    for (const key of KEYS) {
      const bad = walks(KANAL_PATROL_SCHEDULES[key]!).filter((p) => inBuilding(p.x, p.z) || nearestWall(p.x, p.z).d < 0.45 || blocked(p));
      expect(bad.slice(0, 3).map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`), key).toEqual([]);
    }
  });

  it("never jump: the pose goes on smoothly where one stop gives way to the next, and over midnight", () => {
    for (const key of KEYS) {
      const def = KANAL_PATROL_SCHEDULES[key]!;
      for (const stop of [...def.stops.map((s) => s.at), 0]) {
        const a = scheduledPose(def, at(stop === 0 ? 1440 * 2 : stop + 1440, -1)).position;
        const b = scheduledPose(def, at(stop + 1440, 1)).position;
        expect(Math.hypot(a.x - b.x, a.z - b.z), `${key} at ${stop}`).toBeLessThan(0.2);
      }
    }
    expect(KANAL_NIGHT).toEqual({ from: hm(21), to: hm(5) });
  });
});

/** The player in `garment` on the torso, with no AI left on the street; `patch` changes the domain. */
const street = (garment: GarmentId | null, patch: (d: DomainState) => DomainState = (d) => d): Simulation => {
  const snap = streetSim({ seed: 11 }).snapshot(null, "t", "");
  const d = snap.domain;
  const piece: ItemInstance = { uid: "i9", def: garment ?? "seki_jacket", rarity: "common", condition: 100 };
  const dressed: DomainState = garment ? { ...d, inventory: { ...d.inventory, items: [...d.inventory.items, piece], nextUid: d.inventory.nextUid + 1 }, equipment: { ...d.equipment, torso: "i9" } } : d;
  const sim = Simulation.fromSnapshot({ ...snap, domain: patch(dressed) });
  for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
  for (const c of [...sim.world.with("device")]) sim.world.remove(c);
  // Weapon away: a drawn weapon gives any disguise away.
  sim.step(input({ toggleWeapon: true }));
  return sim;
};

/** A key the enforcer rule leaves out (an ordinary Hebi, fooled by the jacket). */
const PLAIN = ["patrol-a", "patrol-b", "patrol-c", "patrol-d"].find((k) => !isEnforcer(k, 1, "hebi"))!;

/** A Hebi ganger 7 m north of the player, facing her: a patrol, or an ordinary ganger. */
const hebi = (sim: Simulation, patrol: boolean): Entity => {
  const p = sim.player()!;
  const e = gangerEntity(5000 + sim.world.entities.length, { key: PLAIN, position: { x: p.position.x, y: p.position.y, z: p.position.z + 7 }, yaw: Math.PI }, null, 500, p.chunk ?? "");
  if (patrol && e.ai) e.ai = { ...e.ai, patrol: true };
  return sim.world.add(e);
};

const alertedAfter = (sim: Simulation, g: Entity, seconds = 3): boolean => {
  run(sim, ticks(seconds));
  return g.ai!.alerted;
};

describe("how a Hebi patrol takes the player (ADR-0048, as any ganger after ADR-0029 and ADR-0033)", () => {
  it("watches a neutral player instead of attacking her, where an ordinary ganger attacks", () => {
    const sim = street(null);
    const patrol = hebi(sim, true);
    expect(alertedAfter(sim, patrol)).toBe(false);
    expect(patrol.ai!.sees).toBe(true);
    const other = street(null);
    expect(alertedAfter(other, hebi(other, false))).toBe(true);
  });

  it("goes for her when Hebi hunt her (the heat) or hate her", () => {
    const hunted = street(null, (d) => ({ ...d, heat: { ...NO_HEAT, level: 1, faction: "hebi" } }));
    expect(alertedAfter(hunted, hebi(hunted, true))).toBe(true);
    const hated = street(null, (d) => ({ ...d, reputation: { ...d.reputation, hebi: -40 } }));
    expect(alertedAfter(hated, hebi(hated, true))).toBe(true);
  });

  it("takes a Hebi jacket for one of its own, and goes for her once the disguise is blown", () => {
    const disguised = street("hebi_jacket");
    expect(disguised.domain.disguise).toEqual({ role: "hebi", blown: false });
    const g = hebi(disguised, true);
    expect(alertedAfter(disguised, g)).toBe(false);
    expect(g.ai!.sees).toBe(false);
    const blown = street("hebi_jacket", (d) => ({ ...d, disguise: { role: "hebi", blown: true } }));
    expect(alertedAfter(blown, hebi(blown, true))).toBe(true);
  });

  it("answers a shot like any ganger", () => {
    const sim = street(null);
    const patrol = hebi(sim, true);
    run(sim, ticks(1));
    expect(patrol.ai!.alerted).toBe(false);
    sim.step(input({ toggleWeapon: true }));
    run(sim, ticks(1));
    sim.player()!.pitch = -0.6;
    for (let i = 0; i < 30; i++) sim.step(input({ fire: true }));
    expect(patrol.ai!.alerted).toBe(true);
  });
});

describe("patrols in the world and in a save (ADR-0048)", () => {
  it("walk the Rynek at night, watch a neutral player there, and a save continues them exactly", () => {
    const sim = Simulation.create({ seed: 4 });
    skipTo(sim, hm(23));
    teleportPlayer(sim, ground(575, -38), Math.PI);
    run(sim, ticks(4));
    const patrols = KEYS.map((k) => byKey(sim, k));
    expect(patrols.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    const rynek = byKey(sim, "hebi-rynek")!;
    expect(rynek.schedule?.pose?.arrived).toBe(false);
    expect(Math.hypot(rynek.position.x - rynek.schedule!.pose!.position.x, rynek.position.z - rynek.schedule!.pose!.position.z)).toBeLessThan(1.5);
    for (const p of patrols) if (p) expect(p.ai!.alerted, p.key).toBe(false);

    const snap = JSON.parse(JSON.stringify(sim.snapshot(null, "t", ""))) as SaveSnapshot;
    const loaded = Simulation.fromSnapshot(snap);
    expect(byKey(loaded, "hebi-rynek")!.position).toEqual(rynek.position);
    run(sim, ticks(6));
    run(loaded, ticks(6));
    expect(stateHash(loaded.snapshot(null, "t", ""))).toBe(stateHash(sim.snapshot(null, "t", "")));
    expect(byKey(loaded, "hebi-rynek")!.position).toEqual(byKey(sim, "hebi-rynek")!.position);
  }, 60_000);
});
