import { describe, expect, it } from "vitest";
import { MemorySaveStore, checksum } from "@seki/persistence";
import { CLINIC_WAKE_SPOT, FIXER_SPAWN, PLAYER_SPAWN, clinicPoint } from "@seki/sim";
import { allText, finishDialogue, objective, setup, steps, talkTo, talkToKaito } from "./story-helpers";
import type { GameSession } from "../src/game-session";

/**
 * G-034: Kaito is at the Neon Koi counter from the start. A new game wakes Seki in Mori's clinic,
 * the HUD and the map send her across the deptak, and the first conversation happens at the bar.
 */

const kaito = (s: GameSession) => [...s.sim.world].find((e) => e.key === "fixer");
const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

describe("the prologue (G-034)", () => {
  it("wakes in the clinic, points to Neon Koi and meets Kaito at the bar, where he stays", () => {
    const { session, ui, render } = setup();
    session.newGame();
    steps(session, 1);
    expect(near(session.sim.player()!.position, PLAYER_SPAWN.position)).toBeLessThan(0.1);
    expect(objective(ui)).toContain("Kaito");
    expect(objective(ui)).toContain("Neon Koi");
    expect(ui.getState().toasts.map((t) => t.text)).toContainEqual(expect.stringContaining("Kaito is waiting at Neon Koi, across the promenade."));
    const before = kaito(session)!;
    expect(before.position).toEqual(FIXER_SPAWN.position);
    expect(near(before.position, CLINIC_WAKE_SPOT)).toBeGreaterThan(10);
    // The map marks him at the bar, not by the chair.
    const marker = ui.getState().mapMarkers.find((m) => m.id === "fixer");
    expect(marker).toBeDefined();
    expect(near(marker!, FIXER_SPAWN.position)).toBeLessThan(1);

    // Mori in the clinic sends her over.
    talkTo(session, "mori");
    session.intents.talkToShopkeeper();
    expect(allText(ui)).toContain("Czeka na ciebie w Neon Koi");
    finishDialogue(session, ui);

    render.despawns = [];
    talkToKaito(session);
    expect(allText(ui)).toContain("Chodzący trup");
    finishDialogue(session, ui);
    expect(session.sim.domain.flags).toContain("met_fixer");
    expect(session.sim.domain.character.alias).toBe("Seki Senshi");
    expect(objective(ui)).toContain("Hebi courier");

    const after = kaito(session)!;
    expect(after.id).toBe(before.id);
    expect(after.position).toEqual(FIXER_SPAWN.position);
    expect(render.despawns.filter(([id]) => id === before.id)).toEqual([]);
  });

  it("an old save from the clinic before the first conversation loads with Kaito at the bar", async () => {
    const store = new MemorySaveStore();
    const fresh = setup();
    fresh.session.newGame();
    steps(fresh.session, 1);
    const now = fresh.session.saves.snapshot();
    // v15 remembered Kaito by the chair, where he stood until met_fixer (ADR-0038).
    const oldKaito = { key: "fixer", position: clinicPoint(-13.3, 0, 3.2), yaw: 0, pitch: 0, hp: null, cooldown: 0, alerted: false };
    const payload = { ...now, version: 15, entities: [...now.entities.filter((e) => e.key !== "fixer"), oldKaito] };
    const text = JSON.stringify(payload);
    await store.put("old", JSON.stringify({ format: "seki-save", checksum: checksum(text), payload: text }));

    const { session } = setup(store);
    expect(await session.saves.loadAsync("old")).toBe(true);
    steps(session, 1);
    expect(session.sim.domain.flags).not.toContain("met_fixer");
    const found = [...session.sim.world].filter((e) => e.key === "fixer");
    expect(found).toHaveLength(1);
    expect(found[0]!.position).toEqual(FIXER_SPAWN.position);
  });
});
