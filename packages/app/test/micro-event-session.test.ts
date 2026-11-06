import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, MICRO_EVENT_CHANCE, type MicroEventKind } from "@seki/core";
import { deriveRandom } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";

/** The first tick from `from` whose micro-event roll starts `kind` (as `rollMicroEvent` rolls it). */
const tickFor = (seed: number, from: number, kind: MicroEventKind): number => {
  for (let t = from; ; t++) {
    const r = deriveRandom(seed, `micro:${t}`);
    if (r.next() < MICRO_EVENT_CHANCE && r.next() < 0.6 === (kind === "mugging")) return t;
  }
};

/** A micro-event (ADR-0034) has no ink: it must not open the conversation panel (G-401). */
describe("a micro-event in the session", () => {
  it.each<MicroEventKind>(["mugging", "aid"])("leaves the player in control when a %s starts in the Old Town", (kind) => {
    const { session, ui } = setup();
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    // On Krakowskie, then through Brama Krakowska on the step whose roll starts it.
    teleport(session, 450, -96);
    steps(session, 2);
    const t = tickFor(session.sim.seed, session.sim.tick + 1, kind);
    while (session.sim.tick < t) session.step(EMPTY_INPUT);
    const started: string[] = [];
    session.bus.on("EncounterStarted", (e) => started.push(e.encounterId));
    teleport(session, 497, -79);
    steps(session, 1);
    expect(started).toEqual([`micro:${kind}:${t}`]);
    expect(ui.getState().dialogue).toBeNull();
    expect(session.inControl).toBe(true);
  });
});
