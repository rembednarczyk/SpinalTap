import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { setup } from "./story-helpers";

/** Wave 2 through the whole session (ADR-0035): the simulation's events are put on the bus by hand. */
describe("wave 2 in the session", () => {
  it("opens the line map from a kiosk interaction and holds the player during the ride", () => {
    const { session, ui } = setup();
    session.newGame();
    session.bus.emit("InteractionStarted", { targetId: 99, dialogueId: "metro_kiosk_kanal", kind: "dialogue" });
    expect(ui.getState().metroMap?.from).toBe("kanal");
    expect(ui.getState().dialogue).toBeNull();
    expect(session.inControl).toBe(false);
    session.closeMetro();
    expect(session.inControl).toBe(true);
    session.bus.emit("MetroDeparted", { from: "kanal", to: "doki", seconds: 1 });
    expect(session.inControl).toBe(false);
    for (let i = 0; i < 30; i++) session.step(EMPTY_INPUT);
    expect(ui.getState().metroRide?.progress).toBeCloseTo(0.5, 1);
    session.bus.emit("MetroArrived", { station: "doki" });
    expect(ui.getState().metroRide).toBeNull();
    expect(session.inControl).toBe(true);
  });

  it("plays a street encounter through the dialogue panel, once at a time", () => {
    const { session, ui } = setup();
    session.newGame();
    session.bus.emit("EncounterStarted", { encounterId: "kanal_flowers", knot: "enc_kanal_flowers", npcId: null });
    const first = ui.getState().dialogue;
    expect(first?.lines.length).toBeGreaterThan(0);
    session.bus.emit("EncounterStarted", { encounterId: "kanal_fisherman", knot: "enc_kanal_fisherman", npcId: null });
    expect(ui.getState().dialogue).toBe(first);
  });

  it("switches the radio and keeps the station in the settings", () => {
    const { session, ui } = setup();
    session.newGame();
    session.nextRadioStation();
    expect(ui.getState().settings.radioStation).toBe("drift");
    session.setRadioStation(null);
    expect(ui.getState().settings.radioStation).toBeNull();
  });
});
