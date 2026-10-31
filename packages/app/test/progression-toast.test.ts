import { describe, expect, it } from "vitest";
import { type Toast, patchUi } from "@seki/ui";
import { setup, steps } from "./story-helpers";

/** The level-up toast (ADR-0059, stage 1), in the language of the settings (ADR-0056). */
describe("level up in the session", () => {
  it("toasts the new level in English, and in Polish once chosen", () => {
    const { session, ui } = setup();
    // Every toast shown, also those a burst pushes out of the stack later.
    const shown = new Map<number, Pick<Toast, "title" | "text">>();
    ui.subscribe((s) => {
      for (const t of s.toasts) shown.set(t.id, { title: t.title, text: t.text });
    });
    const levelUps = () => [...shown.values()].filter((t) => /^(Level up|Awans)/.test(t.title));
    session.newGame();
    session.sim.enqueue({ type: "set-flag", flag: "met_fixer" });
    steps(session, 2);
    expect(session.sim.domain.progression.level).toBe(2);
    expect(levelUps()).toEqual([{ title: "Level up: 2", text: "An attribute point and a perk point to spend" }]);
    patchUi(ui, { settings: { ...ui.getState().settings, locale: "pl" } });
    // The courier down and the pay collected: 1250 XP in all, two levels at once.
    session.sim.enqueue({ type: "set-flag", flag: "killed:hebi_courier" });
    session.sim.enqueue({ type: "set-flag", flag: "reported_back" });
    steps(session, 2);
    expect(session.sim.domain.progression.level).toBe(4);
    expect(levelUps().slice(1)).toEqual([
      { title: "Awans: poziom 3", text: "Punkt atrybutu i punkt perku do rozdania" },
      { title: "Awans: poziom 4", text: "Punkt atrybutu i punkt perku do rozdania" },
    ]);
  });
});
