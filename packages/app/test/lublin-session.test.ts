import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "@seki/core";
import { GENZO_SPOT, METRO_STATIONS } from "@seki/sim";
import type { GameSession } from "../src/game-session";
import { type Ui, frame, setup, steps, teleport } from "./story-helpers";

/**
 * Lublin through the whole session (ADR-0045), without a renderer (ADR-0046): what the e2e
 * specs `streaming` and `docks` checked in the browser, the walk through both gates of the Old
 * Town into the market with a save there, and the metro to Nabrzeże Bystrzycy with Genzō's job.
 */

/**
 * Plac Łokietka, Brama Krakowska, Bramowa, the Rynek, Grodzka under the footbridge, Brama
 * Grodzka, Zamkowa down to Plac Zamkowy and under the viaduct to the market.
 */
const ROUTE = [
  [440, -100], [447, -95], [457, -95.6], [472, -91.4], [487, -87.2], [497, -79], [520, -63], [561, -40], [573, -28], [577, -23],
  [610, 14], [637, 47], [685, 112], [708, 134], [722, 147], [730, 155], [739, 174], [725, 193], [720, 203], [720, 267],
  [737, 286], [741, 327],
] as const;

/** Sprints to (x, z), turning towards it every step; the distance left when it stopped. */
const sprintTo = (s: GameSession, x: number, z: number): number => {
  for (let i = 0; i < 1500; i++) {
    const p = s.sim.player()!;
    const d = Math.hypot(x - p.position.x, z - p.position.z);
    if (d < 0.6) return d;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    const lookYaw = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    s.step({ ...EMPTY_INPUT, moveZ: 1, sprint: true, lookYaw });
  }
  return Math.hypot(x - s.sim.player()!.position.x, z - s.sim.player()!.position.z);
};

const toasts = (ui: Ui) => ui.getState().toasts.map((t) => t.title);

describe("Lublin in the session (ADR-0045)", () => {
  it("walks from Krakowskie through the Old Town's gates into the market; a save there loads back there", async () => {
    const { session, ui } = setup();
    session.newGame();
    expect(session.sim.streamer.loadedChunks).toEqual(["krakowskie-2-0"]);
    teleport(session, 400, -97, Math.PI / 2);
    steps(session, 1);
    const districts = new Set<string | null>([session.sim.district]);
    for (const [x, z] of ROUTE) {
      expect(sprintTo(session, x, z), `${x}, ${z}`).toBeLessThan(0.6);
      districts.add(session.sim.district);
      // The HUD names each district as it is entered.
      session.render(0);
    }
    expect([...districts]).toEqual(["shinsekai-7", "kanal", "targ"]);
    expect(toasts(ui)).toEqual(expect.arrayContaining(["Stare Miasto", "Podzamcze"]));
    expect(session.sim.streamer.loadedChunks).not.toContain("krakowskie-2-0");

    expect(await session.saveAsync("slot-1")).toBe(true);
    const saved = { ...session.sim.player()!.position };
    const chunks = session.sim.streamer.loadedChunks;
    teleport(session, 400, -97);
    steps(session, 2);
    expect(session.sim.streamer.loadedChunks).toEqual(["krakowskie-2-0"]);
    expect(await session.loadAsync("slot-1")).toBe(true);
    expect(session.sim.player()!.position).toEqual(saved);
    expect(session.sim.district).toBe("targ");
    expect(session.sim.streamer.loadedChunks).toEqual(chunks);
  }, 60_000);

  it("rides the metro from Plac Zamkowy to Nabrzeże Bystrzycy and takes Genzō's job in the dialogue", () => {
    const { session, ui } = setup();
    session.newGame();
    // Plac Zamkowy below the castle: the docks are reached by the metro only.
    const from = METRO_STATIONS.find((s) => s.id === "targ")!;
    teleport(session, from.kiosk.x + Math.sin(from.yaw), from.kiosk.z + Math.cos(from.yaw), from.yaw + Math.PI);
    steps(session, 1);
    expect(session.sim.district).toBe("targ");
    expect(ui.getState().prompt).toContain("Bilet");
    steps(session, 1, frame({ interact: true }));
    expect(ui.getState().metroMap?.from).toBe("targ");
    const eddies = session.sim.domain.wallet.eddies;
    session.travelMetro("doki");
    for (let i = 0; i < 60 * 30 && session.sim.district !== "doki"; i++) {
      session.step(EMPTY_INPUT);
      session.render(0);
    }
    expect(session.sim.district).toBe("doki");
    expect(session.sim.domain.wallet.eddies).toBeLessThan(eddies);
    expect(session.sim.streamer.loadedChunks).toContain("nabrzeze-1-1");
    expect(session.sim.streamer.loadedChunks).not.toContain("krakowskie-2-0");
    for (let i = 0; i < 60 * 12 && ui.getState().metroRide; i++) {
      session.step(EMPTY_INPUT);
      session.render(0);
    }

    // Genzō stands by his container office.
    teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
    steps(session, 1);
    expect(ui.getState().prompt).toContain("Genzō");
    steps(session, 1, frame({ interact: true }));
    const text = () => (ui.getState().dialogue?.lines ?? []).map((l) => l.text).join("\n");
    expect(text()).toContain("Pływam nocą");
    const pick = (start: string) => session.choose(ui.getState().dialogue!.choices.find((c) => c.text.startsWith(start))!.index);
    pick("Kogo trzeba przeprowadzić");
    expect(text()).toContain("Mika");
    session.closeDialogue();
    steps(session, 2);
    expect(session.sim.domain.flags).toContain("met_genzo");
    expect(ui.getState().toasts.map((t) => `${t.title}`)).toContain("Nowy kontrakt: Eskorta");
  });
});
