import { describe, expect, it } from "vitest";
import { SECONDS_PER_HOUR, STREET_CRIME_SLOT_HOURS, crimeSlot } from "@seki/core";
import { boardOpen, nextCrime } from "@seki/sim";
import { CRIME_DETAIL_RANGE } from "../src/crime-markers";
import { crimeKindOf } from "../src/presenters/street-crimes";
import { setup, steps, teleport } from "./story-helpers";

/*
 * The street's crimes on the map in the session (ADR-0091 stage 6): the store holds the simulation's
 * open board, details only within 300 m; following one through the intent lets go of the pinned
 * entry and back; a crime foiled or failed says how it ended, one walked away from stays.
 */

const started = () => {
  const { session, ui } = setup();
  session.newGame();
  session.sim.enqueue({ type: "set-flag", flag: "met_fixer" });
  steps(session, 1);
  return { session, ui };
};

describe("street crimes on the map in the session (ADR-0091 stage 6)", () => {
  it("puts the open board on the map, kind and pay only within 300 m", () => {
    const { session, ui } = started();
    const board = boardOpen(session.sim.seed, session.sim.domain);
    const markers = ui.getState().crimeMarkers;
    expect(markers.map((m) => m.id)).toEqual(board.map((c) => c.id));
    const at = session.sim.player()!.position;
    for (const m of markers) {
      const near = Math.hypot(m.x - at.x, m.z - at.z) <= CRIME_DETAIL_RANGE;
      expect(m.near).toBe(near);
      expect(m.reward === null).toBe(!near);
    }
    // Stand next to the first: its details show.
    const first = board[0]!;
    teleport(session, first.at.x, first.at.z - 100);
    steps(session, 1);
    const shown = ui.getState().crimeMarkers.find((m) => m.id === first.id)!;
    expect(shown.near).toBe(true);
    expect(shown.reward).toBeGreaterThan(0);
  });

  it("follows a crime through the intent, and a pinned entry takes its place", () => {
    const { session, ui } = started();
    const id = ui.getState().crimeMarkers[0]!.id;
    session.intents.trackCrime(id);
    steps(session, 1);
    expect(ui.getState().crimeMarkers.find((m) => m.id === id)?.tracked).toBe(true);
    session.intents.trackQuest("m0_first_contract");
    steps(session, 1);
    expect(ui.getState().crimeMarkers.some((m) => m.tracked)).toBe(false);
  });

  it("keeps a crime walked away from on the map, to come back to, without a word", () => {
    const { session, ui } = started();
    const clock = session.sim.domain.clock;
    const found = nextCrime(session.sim.seed, crimeSlot(clock), (c) => c.kind === "mugging" && c.district === "kanal")!;
    const minutes = Math.ceil((found.slot * STREET_CRIME_SLOT_HOURS * SECONDS_PER_HOUR - clock.seconds) / 60) + 1;
    if (minutes > 1) session.sim.enqueue({ type: "wait", minutes });
    steps(session, 1);
    const ended: string[] = [];
    session.bus.on("EncounterEnded", (e) => ended.push(e.outcome));
    teleport(session, found.crime.at.x, found.crime.at.z - 30);
    steps(session, 1);
    // Walk off past 80 m: the crime is left, still on the board.
    const toasts = ui.getState().toasts.length;
    teleport(session, found.crime.at.x, found.crime.at.z - 200);
    steps(session, 2);
    expect(ended.length).toBeGreaterThan(0);
    expect(ended.every((o) => o === "left")).toBe(true);
    expect(ui.getState().crimeMarkers.some((m) => m.id === found.crime.id)).toBe(true);
    expect(ui.getState().toasts.length).toBe(toasts);
  });

  it("says how a crime ended: foiled or too late", () => {
    const { session, ui } = started();
    session.bus.emit("EncounterEnded", { encounterId: "micro:kidnap:812", outcome: "won" });
    session.bus.emit("EncounterEnded", { encounterId: "micro:mugging:900", outcome: "failed" });
    const shown = ui.getState().toasts.map((t) => `${String(t.title)} / ${String(t.text)}`);
    expect(shown).toContain("Crime foiled / Kidnapping");
    expect(shown).toContain("Too late / Mugging");
  });

  it("reads a crime's kind from its run id, and nothing from other encounters", () => {
    expect(crimeKindOf("micro:droneTheft:812")).toBe("droneTheft");
    expect(crimeKindOf("micro:unknown:3")).toBeNull();
    expect(crimeKindOf("gig:hana:1")).toBeNull();
  });
});
