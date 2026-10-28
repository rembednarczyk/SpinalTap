import { describe, expect, it } from "vitest";
import { type Contract, type ContractVariation, type SaveSnapshot, type Vec3, SECONDS_PER_HOUR, contractTag } from "@seki/core";
import { BAR_SPOT, CONTRACT_SITE_SPAWNS, SITE_PLANS, SIM_HZ, Simulation, drinkerWay, stateHash } from "../src";
import { ambushFlag, dayFlag, decoyTag } from "../src/world/contract-plan";
import { lineOfSight } from "../src/world/hitscan";
import { straightWalk } from "../src/systems/ai/steering";
import { byKey, collect, run, teleportPlayer } from "./helpers";

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

/** A game loaded with `job` running at `hour`, the player at `at`. */
const withJob = (job: Contract, at: Vec3, hour = 23): Simulation => {
  const base = Simulation.create({ seed: 9 });
  const snap = base.snapshot(null, "t", "");
  const clock = { seconds: hour * SECONDS_PER_HOUR };
  const player = { ...snap.entities.find((e) => e.key === "player")!, position: at };
  const entities = [...snap.entities.filter((e) => e.key !== "player"), player];
  const sim = Simulation.fromSnapshot({ ...snap, entities, domain: { ...snap.domain, clock, contracts: { active: job, completed: 2 } } });
  run(sim, 2);
  return sim;
};

const job = (variation: ContractVariation, extra: Partial<Contract> = {}): Contract => ({
  id: "c3",
  kind: "eliminate",
  siteId: "east_lot",
  targets: 3,
  reward: 700,
  status: "active",
  variation,
  ...extra,
});

const lot = { x: 2, y: 0, z: -12 };
/** Up the street, out of the crew's sight: nobody fights. */
const far = { x: -3, y: 0, z: 40 };
const near = (e: { position: Vec3 } | undefined, p: Vec3): boolean => !!e && Math.hypot(e.position.x - p.x, e.position.z - p.z) < 0.5;

describe("contract variations in the world (ADR-0034)", () => {
  it("the first contract is plain, later ones roll a variation that is saved and pays by its difficulty", () => {
    const sim = Simulation.create({ seed: 21 });
    sim.enqueue({ type: "accept-contract", kind: "eliminate" });
    run(sim, 1);
    expect(sim.domain.contracts.active?.variation).toBeUndefined();
    const snap = sim.snapshot(null, "t", "");
    const later = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, contracts: { active: null, completed: 4 } } });
    later.enqueue({ type: "accept-contract", kind: "eliminate" });
    run(later, 1);
    const c = later.domain.contracts.active!;
    expect(c.variation).toBeDefined();
    const loaded = Simulation.fromSnapshot(roundTrip(later.snapshot(null, "t", "")));
    expect(loaded.domain.contracts.active?.variation).toEqual(c.variation);
    expect(hash(loaded)).toBe(hash(later));
  });

  it("bodyguards stand by the mark, the look-alike apart, neither counts as a target", () => {
    const sim = withJob(job({ modifiers: ["bodyguards", "twin"], security: "standard" }), lot);
    expect(byKey(sim, "c3-b0")?.tag).not.toBe(contractTag("c3"));
    expect(byKey(sim, "c3-b1")).toBeDefined();
    const twin = byKey(sim, "c3-twin")!;
    expect(twin.tag).toBe(decoyTag("c3"));
    expect(near(twin, SITE_PLANS.east_lot!.twin!)).toBe(true);
    // Killing the targets alone clears the job.
    const cleared = collect(sim, "ContractCleared");
    for (const e of [...sim.world]) if (e.tag === contractTag("c3")) e.health = { current: 0, max: 80 };
    run(sim, 1);
    expect(cleared).toHaveLength(1);
  });

  it("a wrong target swaps the mark and the look-alike", () => {
    const sim = withJob(job({ modifiers: ["twin"], security: "standard", twist: "wrong_target" }), far);
    expect(near(byKey(sim, "c3-twin"), CONTRACT_SITE_SPAWNS.east_lot[0]!)).toBe(true);
    expect(near(byKey(sim, "c3-g0"), SITE_PLANS.east_lot!.twin!)).toBe(true);
  });

  it("a lockdown fields a lookout on watch, a light guard sees less", () => {
    const sim = withJob(job({ modifiers: [], security: "lockdown" }, { targets: 5 }), far);
    const lookout = byKey(sim, "c3-g4")!;
    expect(near(lookout, SITE_PLANS.east_lot!.lookout!)).toBe(true);
    expect(lookout.ai?.watch).toBeDefined();
    const light = withJob(job({ modifiers: [], security: "light" }), lot);
    expect(byKey(light, "c3-g1")!.ai!.aggroRange).toBeLessThan(byKey(sim, "c3-g1")!.ai!.aggroRange);
  });

  it("the mark's trait: armour, a paranoid look-around, a night at the bar", () => {
    expect(withJob(job({ modifiers: [], security: "standard", trait: "armored" }), lot).world.entities.find((e) => e.key === "c3-g0")?.enemy?.type).toBe("hebi_enforcer");
    const paranoid = byKey(withJob(job({ modifiers: [], security: "standard", trait: "paranoid" }), lot), "c3-g0")!;
    expect(paranoid.ai?.watch?.period).toBe(3);
    const drinker = withJob(job({ modifiers: [], security: "standard", trait: "drinker" }), far, 23);
    const mark = byKey(drinker, "c3-g0")!;
    expect(mark.schedule?.def.stops.map((s) => s.label)).toEqual(["posterunek", "bar"]);
    run(drinker, 30 * SIM_HZ);
    expect(Math.hypot(mark.position.x - BAR_SPOT.x, mark.position.z - BAR_SPOT.z)).toBeLessThan(1.5);
  });

  it("a night-only target is away by day and back at night", () => {
    const night = withJob(job({ modifiers: ["night_only"], security: "standard" }), far, 23);
    expect(byKey(night, "c3-g0")).toBeDefined();
    const day = withJob(job({ modifiers: ["night_only"], security: "standard" }), far, 12);
    run(day, 2);
    expect(day.domain.flags).toContain(dayFlag("c3"));
    expect(byKey(day, "c3-g0")).toBeUndefined();
    day.enqueue({ type: "wait", minutes: 10 * 60 });
    run(day, 3);
    expect(day.domain.flags).not.toContain(dayFlag("c3"));
    expect(byKey(day, "c3-g0")).toBeDefined();
  });

  it("a time limit fails the job when it runs out", () => {
    const sim = withJob(job({ modifiers: ["time_limit"], security: "standard" }, { deadlineTick: 1000 }), far);
    const failed = collect<{ reason: string }>(sim, "ContractFailed");
    run(sim, 900);
    expect(failed).toEqual([]);
    run(sim, 200);
    expect(failed.map((f) => f.reason)).toEqual(["timeout"]);
  });

  it("the ambush moves in once the job is done, and the flags of the plan come down after", () => {
    const sim = withJob(job({ modifiers: ["ambush"], security: "standard" }), far);
    expect(byKey(sim, "c3-a0")).toBeUndefined();
    for (const e of [...sim.world]) if (e.tag === contractTag("c3")) e.health = { current: 0, max: 80 };
    run(sim, 2);
    expect(sim.domain.flags).toContain(ambushFlag("c3"));
    expect(byKey(sim, "c3-a0")?.ai?.alerted).toBe(true);
    expect(byKey(sim, "c3-a1")).toBeDefined();
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    expect(hash(loaded)).toBe(hash(sim));
    sim.enqueue({ type: "complete-contract" });
    const cards = collect<{ variation?: ContractVariation }>(sim, "ContractDebrief");
    run(sim, 2);
    expect(cards[0]?.variation).toEqual({ modifiers: ["ambush"], security: "standard" });
    expect(sim.domain.flags.filter((f) => f.startsWith("plan:"))).toEqual([]);
  });
});

describe("where the variations stand (ADR-0034)", () => {
  const standable = (sim: Simulation, p: Vec3): boolean => lineOfSight(sim.world, { x: p.x, y: 0.3, z: p.z }, { x: p.x + 0.01, y: 1.7, z: p.z });

  it.each(Object.entries(SITE_PLANS))("%s: every spot is open ground", (_site, plan) => {
    const spots = [...(plan.guards ?? []), ...(plan.twin ? [plan.twin] : []), ...(plan.lookout ? [plan.lookout] : []), ...(plan.ambush ?? [])];
    for (const p of spots) {
      const sim = Simulation.create({ seed: 1 });
      teleportPlayer(sim, { x: p.x, y: 0, z: p.z });
      run(sim, 1);
      for (const [dx, dz] of [[0, 0], [0.38, 0], [-0.38, 0], [0, 0.38], [0, -0.38]] as const) {
        expect(standable(sim, { x: p.x + dx, y: 0, z: p.z + dz }), `${p.x},${p.z}`).toBe(true);
      }
    }
  });

  it.each(["east_lot", "koi_back", "car_wash", "south_gate"] as const)("%s: the drinker's way to the bar is a straight walk", (site) => {
    const way = drinkerWay(site)!;
    const sim = Simulation.create({ seed: 1 });
    teleportPlayer(sim, { x: 0, y: 0, z: 0 });
    run(sim, 1);
    for (let i = 1; i < way.length; i++) expect(straightWalk(sim.world, way[i - 1]!, way[i]!), `${site} leg ${i}`).toBe(true);
  });
});
