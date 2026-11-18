import { describe, expect, it } from "vitest";
import type { DomainEvents } from "@seki/core";
import { SIM_HZ } from "../src";
import { isMicroKey } from "../src/world/micro-events";
import { collect, run, teleportPlayer } from "./helpers";
import { enterKanal } from "./micro-scenes";

/*
 * G-230: the player jumps 600 m in one step (the metro, a teleport) away from a running
 * micro-event. Its chunk falls asleep before the event is left behind; its people (never saved,
 * `isMicroKey`) must not stay among the sleepers for the rest of the session, and the event
 * ends as left.
 */

describe("G-230: a micro-event left by a long jump", () => {
  it.each(["mugging", "aid"] as const)("%s: its people do not stay asleep, and it ends as left", (kind) => {
    const { sim } = enterKanal(kind, 13);
    const run0 = sim.session.street2.micro!;
    expect(run0).toBeTruthy();
    const ended = collect<DomainEvents["EncounterEnded"]>(sim, "EncounterEnded");
    const p = sim.player()!.position;
    teleportPlayer(sim, { ...p, x: p.x + 600 }, 0);
    run(sim, 3 * SIM_HZ);
    expect(ended).toEqual([{ encounterId: run0.id, outcome: "left" }]);
    expect(sim.session.street2.micro).toBeNull();
    const asleep = sim.streamer.dormantSnapshots().filter((s) => isMicroKey(s.key));
    expect(asleep.map((s) => s.key)).toEqual([]);
    expect([...sim.world].filter((e) => e.key && isMicroKey(e.key))).toEqual([]);
  });
});
