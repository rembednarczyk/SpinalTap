import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, SAVE_SCHEMA_VERSION } from "@seki/core";
import { W3_WAKE, checksum } from "@seki/persistence";
import { GENZO_SPOT, METRO_STATIONS, SIM_HZ, W3_ITEM_SPOTS, W3_TERMINAL_SPOTS, W3_Y, chunkAt, groundY, inW3Zone } from "@seki/sim";
import { frame, setup, steps, teleport } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * Sector W-3 on the docks' ground (ADR-0082 stage 1), headless: the metro brings Seki to
 * Nabrzeże Bystrzycy, Genzō by his container offers the infiltration of the pass office in the
 * control tower and the hack of the terminal on the quay, both played there; and a game saved on
 * the old warehouse's roof (v38) loads with Seki on the public strip by the metro.
 */

const text = (ui: ReturnType<typeof setup>["ui"]) => (ui.getState().dialogue?.lines ?? []).map((l) => l.text).join("\n");

const start = () => {
  const { session, ui, store } = setup();
  session.newGame();
  steps(session, 2);
  return { session, ui, store };
};

const talkToGenzo = (session: GameSession) => {
  teleport(session, GENZO_SPOT.x + 0.3, GENZO_SPOT.z - 1.8, 0);
  steps(session, 1);
  steps(session, 1, frame({ interact: true }));
};

const pick = (session: GameSession, ui: ReturnType<typeof setup>["ui"], begins: string) => {
  session.intents.choose(ui.getState().dialogue!.choices.find((c) => c.text.startsWith(begins))!.index);
  session.intents.closeDialogue();
  steps(session, 2);
};

describe("W-3 in a session (ADR-0082 stage 1)", () => {
  it("the metro's exit A on Nabrzeże stands on the public strip, outside the fence, on the terrain", () => {
    const station = METRO_STATIONS.find((s) => s.id === "doki")!;
    for (const e of station.entrances) {
      expect(inW3Zone(e.door.x, e.door.z), e.label).toBe(false);
      expect(Math.abs(e.street - groundY(e.door.x, e.door.z)), e.label).toBeLessThan(0.3);
    }
  });

  it("Genzō offers the tower's office and the quay's terminal, not the escort; the office's data taken unseen pays", () => {
    const { session, ui } = start();
    talkToGenzo(session);
    expect(text(ui)).toContain("Genzō");
    const choices = ui.getState().dialogue!.choices.map((c) => c.text);
    expect(choices).not.toContain("Kogo trzeba przeprowadzić?");
    pick(session, ui, "Co trzeba wynieść z biura Tessen");
    const job = session.sim.domain.contracts.active!;
    expect(job).toMatchObject({ kind: "infiltrate", siteId: "tessen_office" });
    const desk = W3_ITEM_SPOTS.tessen_office!;
    teleport(session, desk.x + 1.1, desk.z, -Math.PI / 2);
    steps(session, 1);
    expect(session.sim.session.interior).toBe("tessen-office");
    steps(session, 1, frame({ interact: true, crouch: true }));
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");
  });

  it("the hack on the quay by the pier brings the wave and its sniper, and holding the terminal clears it", () => {
    const { session, ui } = start();
    talkToGenzo(session);
    pick(session, ui, "Który terminal mam złamać");
    const hack = session.sim.domain.contracts.active!;
    expect(hack).toMatchObject({ kind: "hack", siteId: "quay_terminal" });
    const t = W3_TERMINAL_SPOTS.quay_terminal!;
    expect(inW3Zone(t.x, t.z)).toBe(true);
    teleport(session, t.x, t.z - 1.4, 0);
    steps(session, 1, frame({ interact: true }));
    const wave = [...session.sim.world].filter((e) => e.tag === `contract:${hack.id}`);
    expect(wave).toHaveLength(hack.targets);
    expect(wave.filter((e) => e.sniper)).toHaveLength(1);
    for (const e of wave) e.health = { current: 0, max: e.health!.max };
    const p = session.sim.player()!;
    for (let i = 0; i < 40 * SIM_HZ && session.sim.domain.contracts.active?.status === "active"; i++) {
      p.health = { ...p.health!, current: p.health!.max };
      session.step(EMPTY_INPUT);
    }
    expect(session.sim.domain.contracts.active?.status).toBe("cleared");
  });

  it("loads a game saved on the old warehouse's roof (v38) with Seki on the public strip by the metro, standing", async () => {
    // The migration's place is the content's (persistence knows no map).
    expect(W3_WAKE.y - groundY(W3_WAKE.x, W3_WAKE.z)).toBeGreaterThan(0);
    expect(W3_WAKE.y - groundY(W3_WAKE.x, W3_WAKE.z)).toBeLessThan(0.1);
    expect(chunkAt(W3_WAKE.x, W3_WAKE.z)?.id).toBe(W3_WAKE.chunk);
    expect(inW3Zone(W3_WAKE.x, W3_WAKE.z)).toBe(false);

    const { session, store } = start();
    const now = session.sim.snapshot(null, "old", "");
    // The old warehouse's roof: local (-28, 9, 107) of the docks placed at (2560; -28.6; 300).
    const player = { ...now.entities.find((e) => e.key === "player")!, position: { x: 2532, y: W3_Y + 9, z: 407 } };
    const old = JSON.stringify({ ...now, version: 38, entities: [...now.entities.filter((e) => e.key !== "player"), player], streaming: { loadedChunks: ["nabrzeze-1-1"] } });
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(old), payload: old }));
    expect(await session.saves.loadAsync("old")).toBe(true);
    expect(SAVE_SCHEMA_VERSION).toBeGreaterThanOrEqual(39);
    const p = session.sim.player()!;
    expect({ x: p.position.x, z: p.position.z }).toEqual({ x: W3_WAKE.x, z: W3_WAKE.z });
    const hp = p.health!.current;
    steps(session, 30, frame());
    expect(p.position.y).toBeCloseTo(groundY(W3_WAKE.x, W3_WAKE.z), 1);
    expect(p.health!.current).toBe(hp);
    expect(session.sim.district).toBe("doki");
  });
});
