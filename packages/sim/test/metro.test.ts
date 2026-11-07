import { describe, expect, it } from "vitest";
import { type SaveSnapshot, metroFare, metroRideSeconds } from "@seki/core";
import { METRO_ENTRANCES, SIM_HZ, Simulation, metroStation, stateHash } from "../src";
import { collect, input, run, teleportPlayer } from "./helpers";

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
const flat = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** In front of the ticket machine of the station's entrance A: on its platform (ADR-0071 stage 4). */
const atKiosk = (sim: Simulation, id: Parameters<typeof metroStation>[0]) => {
  const a = metroStation(id).entrances[0];
  teleportPlayer(sim, a.ticket, a.ticketYaw);
  run(sim, 2);
};

describe("metro entrances (ADR-0071 stage 2)", () => {
  it.each(METRO_ENTRANCES.map((e) => [`${e.station} ${e.label}`, e] as const))("%s: up the stairs from the hall to the street and back down", (_name, e) => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, e.hallSpot, e.hallYaw);
    run(sim, 2);
    // Walk out: forward up the stairs, through the opening, onto the street.
    for (let i = 0; i < 6 * SIM_HZ && flat(sim.player()!.position, e.door) > 0.6; i++) sim.step(input({ moveZ: 1 }));
    const out = sim.player()!.position;
    expect(flat(out, e.door), `${out.x},${out.y},${out.z}`).toBeLessThan(0.8);
    expect(Math.abs(out.y - e.door.y)).toBeLessThan(0.3);
    // And back down to the hall.
    teleportPlayer(sim, e.door, e.hallYaw + Math.PI);
    run(sim, 2);
    for (let i = 0; i < 6 * SIM_HZ && flat(sim.player()!.position, e.hallSpot) > 0.6; i++) sim.step(input({ moveZ: 1 }));
    const down = sim.player()!.position;
    expect(flat(down, e.hallSpot), `${down.x},${down.y},${down.z}`).toBeLessThan(1.5);
    expect(Math.abs(down.y - e.floor)).toBeLessThan(0.1);
  });
});

describe("riding the metro (ADR-0034)", () => {
  it("the ticket machine on the platform opens the line map for its station", () => {
    const sim = Simulation.create({ seed: 2 });
    const started = collect<{ kind: string; station?: string }>(sim, "InteractionStarted");
    atKiosk(sim, "shinsekai");
    sim.step(input({ interact: true }));
    expect(started).toEqual([expect.objectContaining({ kind: "metro", station: "shinsekai", dialogueId: "metro_shinsekai" })]);
    expect(sim.session.dialogueActive).toBe(true);
  });

  it("refuses away from a machine, to the same station, without the fare and on a watched platform", () => {
    const sim = Simulation.create({ seed: 2 });
    const refused = collect<{ reason: string }>(sim, "MetroRefused");
    sim.enqueue({ type: "travel-metro", to: "kanal" });
    run(sim, 1);
    atKiosk(sim, "shinsekai");
    sim.enqueue({ type: "travel-metro", to: "shinsekai" });
    run(sim, 1);
    const snap = sim.snapshot(null, "t", "");
    const poor = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, wallet: { eddies: 5 } } });
    const poorRefused = collect<{ reason: string }>(poor, "MetroRefused");
    poor.enqueue({ type: "travel-metro", to: "doki" });
    run(poor, 1);
    const job = { id: "c2", kind: "eliminate", siteId: "east_lot", targets: 2, reward: 400, status: "active" } as const;
    const hot = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, contracts: { active: job, completed: 1 }, heat: { ...snap.domain.heat, level: 1, faction: "hebi" } } });
    const hotRefused = collect<{ reason: string }>(hot, "MetroRefused");
    hot.enqueue({ type: "travel-metro", to: "doki" });
    run(hot, 1);
    expect(refused.map((r) => r.reason)).toEqual(["not-at-kiosk", "same-station"]);
    expect(poorRefused.map((r) => r.reason)).toEqual(["funds"]);
    expect(hotRefused.map((r) => r.reason)).toEqual(["watched"]);
    expect(hot.domain.wallet.eddies).toBe(snap.domain.wallet.eddies);
  });

  it("sells no ticket on the street over the hall", () => {
    const sim = Simulation.create({ seed: 2 });
    const refused = collect<{ reason: string }>(sim, "MetroRefused");
    const a = metroStation("shinsekai").entrances[0];
    teleportPlayer(sim, a.door, a.arrivalYaw + Math.PI);
    run(sim, 2);
    sim.enqueue({ type: "travel-metro", to: "kanal" });
    run(sim, 1);
    expect(refused.map((r) => r.reason)).toEqual(["not-at-kiosk"]);
  });

  it("takes the player off the platform, streams the destination in and lets them off on its platform", () => {
    const sim = Simulation.create({ seed: 2 });
    atKiosk(sim, "shinsekai");
    const departed = collect<{ from: string; to: string; seconds: number }>(sim, "MetroDeparted");
    const arrived = collect<{ station: string }>(sim, "MetroArrived");
    const before = sim.domain.wallet.eddies;
    const clock = sim.clock.seconds;
    sim.enqueue({ type: "travel-metro", to: "doki" });
    run(sim, 1);
    expect(departed).toEqual([{ from: "shinsekai", to: "doki", seconds: metroRideSeconds("shinsekai", "doki") }]);
    expect(sim.domain.wallet.eddies).toBe(before - metroFare("shinsekai", "doki"));
    expect(sim.player()).toBeUndefined();
    expect(sim.domain.metro.ride).toMatchObject({ from: "shinsekai", to: "doki" });
    run(sim, 3);
    expect(sim.streamer.isLoaded("nabrzeze-1-1")).toBe(true);
    run(sim, metroRideSeconds("shinsekai", "doki") * SIM_HZ);
    expect(arrived).toEqual([{ station: "doki" }]);
    const p = sim.player()!;
    expect(flat(p.position, metroStation("doki").arrival)).toBeLessThan(0.5);
    expect(Math.abs(p.position.y - metroStation("doki").entrances[0].platform!.floor)).toBeLessThan(0.1);
    expect(sim.district).toBe("doki");
    // The world went on meanwhile.
    expect(sim.clock.seconds).toBeGreaterThan(clock + 60 * metroRideSeconds("shinsekai", "doki") - 60);
    expect(sim.domain.metro.ride).toBeNull();
  });

  it("buys in the hall of entrance B and gets off on the platform of the destination's A", () => {
    const sim = Simulation.create({ seed: 2 });
    const b = metroStation("kanal").entrances[1]!;
    teleportPlayer(sim, b.arrival, b.arrivalYaw);
    run(sim, 2);
    const departed = collect<{ from: string; to: string }>(sim, "MetroDeparted");
    sim.enqueue({ type: "travel-metro", to: "targ" });
    run(sim, 1 + metroRideSeconds("kanal", "targ") * SIM_HZ);
    expect(departed).toEqual([expect.objectContaining({ from: "kanal", to: "targ" })]);
    expect(flat(sim.player()!.position, metroStation("targ").entrances[0].arrival)).toBeLessThan(0.5);
  });

  it("a game saved in the carriage loads in it and arrives on the same step", () => {
    const sim = Simulation.create({ seed: 4 });
    atKiosk(sim, "kanal");
    sim.enqueue({ type: "travel-metro", to: "targ" });
    run(sim, 60);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "ride", "")));
    expect(hash(loaded)).toBe(hash(sim));
    run(loaded, 1);
    expect(loaded.player()).toBeUndefined();
    const arrivals = [collect(sim, "MetroArrived"), collect(loaded, "MetroArrived")];
    for (let i = 0; i < metroRideSeconds("kanal", "targ") * SIM_HZ; i++) {
      sim.step();
      if (i > 0) loaded.step();
    }
    expect(arrivals.map((a) => a.length)).toEqual([1, 1]);
    expect(hash(loaded)).toBe(hash(sim));
    expect(loaded.district).toBe("targ");
  });
});
