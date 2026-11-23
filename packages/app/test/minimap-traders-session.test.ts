import { describe, expect, it } from "vitest";
import { MALL_LEVELS, beforeKeeper } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";

/*
 * The traders on the map in the session (ADR-0100): Oyaji's stall in the food hall on P3 has its
 * marker while he trades (a new game starts at 21:00, his shop is open till 22:00) and none once
 * the schedule has shut it; the no-markers setting hides it with the rest.
 */

const marker = (ui: ReturnType<typeof setup>["ui"], id: string) => ui.getState().mapMarkers.find((m) => m.id === id);

describe("the traders on the map in the session (ADR-0100)", () => {
  it("marks Oyaji while his stall is open and not after 22:00", () => {
    const { session, ui } = setup();
    session.newGame();
    const at = beforeKeeper("oyaji");
    teleport(session, at.x, at.z, 0, 0, MALL_LEVELS.p3);
    steps(session, 2);
    expect(marker(ui, "oyaji")?.kind).toBe("vendor");
    // Fumiko's bar is open from 16:00: hers too.
    expect(marker(ui, "fumiko")?.kind).toBe("vendor");
    session.sim.enqueue({ type: "wait", minutes: 61 }); // 22:01
    steps(session, 60 * 5);
    expect([...session.sim.world].find((e) => e.key === "oyaji")?.interactable?.dialogueId).toBe("oyaji_closed");
    expect(marker(ui, "oyaji")).toBeUndefined();
    expect(marker(ui, "fumiko")?.kind).toBe("vendor");
  });
});
