import { describe, expect, it } from "vitest";
import { BASE_RAM, type DomainEvents, type DomainState, HACKED_MEMORY, type HeatState, NO_HEAT, QUICKHACK_XP, QUICKHACKS, type SaveSnapshot } from "@seki/core";
import { type Entity, SIM_HZ, Simulation, gangerEntity } from "../src";
import { ALLEY_START, alleySim, collect, input } from "./helpers";

/**
 * The heat's reinforcements pay XP for a quickhack like a keyed guard (G-202): once each, never
 * again for the same one, after a save and a load too. Their `n` counts again from 1 in the next
 * heat, so a new one with an old one's `n` is another target and pays.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const HEAT: HeatState = { level: 2, faction: "hebi", searching: true, lastKnown: ALLEY_START, searchLeft: 30, cooldown: 0 };

type Holder = { holder: { domain: DomainState } };
const setDomain = (sim: Simulation, change: (d: DomainState) => DomainState): void => {
  const holder = (sim as unknown as Holder).holder;
  holder.domain = change(holder.domain);
};

const security = (sim: Simulation, n: number): Entity => sim.world.with("security").entities.find((e) => e.security.n === n)!;

/** Brings the heat up and steps until `count` reinforcements are in. */
const heatUp = (sim: Simulation, count: number): void => {
  setDomain(sim, (d) => ({ ...d, heat: HEAT }));
  for (let i = 0; i < 20 * SIM_HZ && sim.world.with("security").entities.length < count; i++) sim.step();
  expect(sim.world.with("security").entities).toHaveLength(count);
};

/** Holds the target in front of the player, the others behind her, and runs `ping` into it. */
const ping = (sim: Simulation, target: Entity): readonly DomainEvents["QuickhackApplied"][] => {
  const applied = collect<DomainEvents["QuickhackApplied"]>(sim, "QuickhackApplied");
  setDomain(sim, (d) => ({ ...d, netrun: { ...d.netrun, ram: BASE_RAM } }));
  for (let i = 0; i < Math.ceil(QUICKHACKS.ping.upload * SIM_HZ) + 2 && applied.length === 0; i++) {
    for (const e of sim.world.with("security")) {
      const [dx, dz] = e === target ? [8, -1.5] : [-12, 4 * e.security.n];
      e.position = { x: ALLEY_START.x + dx, y: e.position.y, z: ALLEY_START.z + dz };
      e.prevPosition = { ...e.position };
    }
    const me = sim.player()!;
    const dx = target.position.x - me.position.x;
    const dz = target.position.z - me.position.z;
    me.yaw = Math.atan2(dx, dz);
    me.pitch = Math.atan2(me.position.y + 1.62 - (target.position.y + 1.25), Math.hypot(dx, dz));
    sim.step(input({ scan: true, quickhack: i === 0 ? 1 : 0 }));
  }
  expect(applied.map((a) => a.targetId)).toEqual([target.id]);
  return applied;
};

/** The XP of hacks paid from now on. */
const hackXp = (sim: Simulation): (() => readonly number[]) => {
  const xp = collect<DomainEvents["ExperienceGained"]>(sim, "ExperienceGained");
  return () => xp.filter((x) => x.source === "hack").map((x) => x.amount);
};

const started = (): Simulation => {
  const sim = alleySim({ seed: 21 });
  sim.step();
  heatUp(sim, 2);
  return sim;
};

describe("XP for a quickhack on the heat's reinforcements (G-202)", () => {
  it("pays once for each of them: the same one hacked again pays nothing, another pays", () => {
    const sim = started();
    const xp = hackXp(sim);
    const before = sim.domain.progression.xp;
    ping(sim, security(sim, 1));
    ping(sim, security(sim, 1));
    expect(xp()).toEqual([QUICKHACK_XP]);
    ping(sim, security(sim, 2));
    expect(xp()).toEqual([QUICKHACK_XP, QUICKHACK_XP]);
    expect(sim.domain.progression.xp - before).toBe(2 * QUICKHACK_XP);
  });

  it("the next heat's one with the same `n` is another target and pays", () => {
    const sim = started();
    ping(sim, security(sim, 1));
    for (const e of [...sim.world.with("security")]) sim.world.remove(e);
    setDomain(sim, (d) => ({ ...d, heat: NO_HEAT }));
    sim.step();
    expect(sim.session.watch.sent).toBe(0);
    heatUp(sim, 2);
    const xp = hackXp(sim);
    ping(sim, security(sim, 1));
    expect(xp()).toEqual([QUICKHACK_XP]);
  });

  it("a save and a load do not let the same one pay again; the other still pays", () => {
    const sim = started();
    ping(sim, security(sim, 1));
    const paid = sim.domain.progression.xp;
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const xp = hackXp(loaded);
    ping(loaded, security(loaded, 1));
    expect(xp()).toEqual([]);
    expect(loaded.domain.progression.xp).toBe(paid);
    ping(loaded, security(loaded, 2));
    expect(xp()).toEqual([QUICKHACK_XP]);
  });

  it("the ones of past heats, gone, do not push the city's targets out of the memory (G-209)", () => {
    const sim = started();
    const guard = sim.world.add(gangerEntity(90022, { key: "g209-guard", position: { ...ALLEY_START, x: ALLEY_START.x + 8, z: ALLEY_START.z - 1.5 }, yaw: 0 }, null, 110, ""));
    ping(sim, security(sim, 2));
    // A long game: a guard hacked first, then hundreds of reinforcements of heats long over.
    const gone = Array.from({ length: HACKED_MEMORY - 2 }, (_, i) => `security:${1000 + i}@${i}`);
    setDomain(sim, (d) => ({ ...d, progression: { ...d.progression, hacked: ["g209-guard", ...gone, ...(d.progression.hacked ?? [])] } }));
    const xp = hackXp(sim);
    ping(sim, security(sim, 1));
    expect(xp()).toEqual([QUICKHACK_XP]);
    ping(sim, guard);
    ping(sim, security(sim, 2));
    expect(xp()).toEqual([QUICKHACK_XP]);
    expect(sim.domain.progression.hacked).not.toContain(gone[0]);
  });

  it("after a load, the ones still about are not taken for gone (G-209)", () => {
    const sim = started();
    ping(sim, security(sim, 1));
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    setDomain(loaded, (d) => ({ ...d, progression: { ...d.progression, hacked: ["security:1000@0", ...(d.progression.hacked ?? [])] } }));
    const xp = hackXp(loaded);
    ping(loaded, security(loaded, 2));
    ping(loaded, security(loaded, 1));
    expect(xp()).toEqual([QUICKHACK_XP]);
    expect(loaded.domain.progression.hacked).toEqual([`security:1@${security(loaded, 1).security!.since}`, `security:2@${security(loaded, 2).security!.since}`]);
  });

  it("another unkeyed one, not of the heat, still pays nothing", () => {
    const sim = alleySim({ seed: 21 });
    sim.step();
    const g = gangerEntity(90021, { key: "", position: { ...ALLEY_START, x: ALLEY_START.x + 8, z: ALLEY_START.z - 1.5 }, yaw: 0 }, null, 110, "");
    delete g.key;
    sim.world.add(g);
    const xp = hackXp(sim);
    expect(ping(sim, g)).toHaveLength(1);
    expect(xp()).toEqual([]);
  });
});
