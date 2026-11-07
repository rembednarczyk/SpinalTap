import { describe, expect, it } from "vitest";
import { HANA_SPOT } from "@seki/sim";
import { setup, steps, teleport } from "./story-helpers";

/**
 * The scanned enemy's level on the scan card (ADR-0059, stage 7, user's decision of 6.11), in a
 * session without a renderer: the level the simulation graded it with (stage 5), from the scan's
 * own focus event; a level up regrades it and the card follows.
 */
describe("the scanned enemy's level", () => {
  it("the Hebi lookout in the market (band 10-20) shows the simulation's level on the card", () => {
    const { session, ui } = setup();
    session.newGame();
    // By Hana's cart in the market of Alchemia: the lookout streams in, graded in the market's band.
    teleport(session, HANA_SPOT.x - 1.5, HANA_SPOT.z, Math.PI / 2);
    steps(session, 2);
    const lookout = [...session.sim.world].find((e) => e.key === "hebi-lookout")!;
    expect(lookout.enemy?.level).toBe(10);
    session.sim.bus.emit("ScanFocusChanged", { targetId: lookout.id, kind: "person" });
    steps(session, 1);
    expect(ui.getState().scanTarget).toMatchObject({ id: lookout.id, hostile: true, level: lookout.enemy!.level });
    // A passer-by has no level.
    const civilian = [...session.sim.world].find((e) => e.civilian !== undefined && e.health !== undefined);
    expect(civilian, "a passer-by on the street").toBeDefined();
    session.sim.bus.emit("ScanFocusChanged", { targetId: civilian!.id, kind: "person" });
    steps(session, 1);
    expect(ui.getState().scanTarget).toMatchObject({ id: civilian!.id });
    expect(ui.getState().scanTarget?.level).toBeUndefined();
  });

  it("a level up regrades an enemy of Krakowskie (band 1-8) and the card follows its new level", () => {
    const { session, ui } = setup();
    session.newGame();
    steps(session, 2);
    const guard = [...session.sim.world].find((e) => e.key === "guard")!;
    expect(guard.enemy?.level).toBe(1);
    session.sim.bus.emit("ScanFocusChanged", { targetId: guard.id, kind: "person" });
    steps(session, 1);
    expect(ui.getState().scanTarget?.level).toBe(1);
    // The fixer, the courier and the pay: level 4, and the world keeps up within the band.
    for (const flag of ["met_fixer", "killed:hebi_courier", "reported_back"]) session.sim.enqueue({ type: "set-flag", flag });
    steps(session, 2);
    expect(session.sim.domain.progression.level).toBe(4);
    expect(guard.enemy?.level).toBe(4);
    expect(ui.getState().scanTarget?.level).toBe(4);
  });
});
