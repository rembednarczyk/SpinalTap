import { describe, expect, it } from "vitest";
import { type MicroEventKind, SECONDS_PER_HOUR, STREET_CRIME_SLOT_HOURS, crimeSlot } from "@seki/core";
import { nextCrime } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";

/** A crime of the street (ADR-0034, ADR-0091) has no ink: it must not open the conversation panel (G-401). */
describe("a micro-event in the session", () => {
  it.each<MicroEventKind>(["mugging", "aid"])("leaves the player in control when a %s starts in the Old Town", (kind) => {
    const { session, ui } = setup();
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    // The first crime of `kind` on the Old Town's boards (ADR-0091 stage 5): wait for its board, then come within reach.
    const clock = session.sim.domain.clock;
    const found = nextCrime(session.sim.seed, crimeSlot(clock), (c) => c.kind === kind && c.district === "kanal")!;
    const minutes = Math.ceil((found.slot * STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR - clock.seconds) / 60) + 1;
    if (minutes > 1) session.sim.enqueue({ type: "wait", minutes });
    steps(session, 1);
    expect(crimeSlot(session.sim.domain.clock)).toBe(found.slot);
    const started: string[] = [];
    session.bus.on("EncounterStarted", (e) => started.push(e.encounterId));
    teleport(session, found.crime.at.x, found.crime.at.z - 30);
    steps(session, 1);
    expect(started).toEqual([expect.stringMatching(new RegExp(`^micro:${kind}:`))]);
    expect(ui.getState().dialogue).toBeNull();
    expect(session.inControl).toBe(true);
  });
});
