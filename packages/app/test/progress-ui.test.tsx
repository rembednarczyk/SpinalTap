// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { xpForLevel } from "@seki/core";
import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * ADR-0059, stage 7 on the real UI without a renderer: a level up reaches the toast, the HUD's XP
 * bar and the points' marks; the Progress tab spends the points through the progression intents,
 * on a keyboard and on a phone.
 */

const start = (touch = false): Game => {
  const game = mountGame({ seed: 11, touch });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByTestId("hud")).toBeTruthy();
  // On the deptak in front of the clinic (ADR-0045).
  run(() => game.seki.teleport(321.4, -80));
  game.step(1);
  return game;
};

/** Meeting the fixer pays the first level's XP (ADR-0059, stage 1). */
const levelUp = (g: Game) => {
  run(() => g.session.sim.enqueue({ type: "set-flag", flag: "met_fixer" }));
  g.step(2);
};

afterEach(() => {
  unmountGame();
  vi.useRealTimers();
});

describe("level up and the Progress tab in the session", () => {
  it("a level up shows its toast, fills the HUD's bar from the new level's start and marks the points", () => {
    const g = start();
    expect(screen.getByTestId("hud-level").textContent).toBe("Lv 1");
    expect(screen.queryByTestId("hud-points")).toBeNull();
    levelUp(g);
    const { xp, level } = g.session.sim.domain.progression;
    expect(level).toBe(2);
    expect(g.ui.getState().xp).toBe(xp);
    expect(screen.getByText("Level up: 2")).toBeTruthy();
    expect(screen.getByTestId("hud-level").textContent).toBe("Lv 2");
    const meter = within(screen.getByTestId("hud-xp")).getByRole("meter");
    expect(meter.getAttribute("aria-valuenow")).toBe(String(xp - xpForLevel(2)));
    expect(screen.getByTestId("hud-points").textContent).toBe("▲ 2 K");
    // The XP that came in keeps the identity block up a moment, out of combat at full health.
    expect(screen.getByTestId("identity").classList.contains("hud__identity--calm")).toBe(false);
  });

  it("a load or a new game moves the level without a flash; only XP earned in play shows the bar", async () => {
    vi.useFakeTimers();
    const g = start();
    const identity = () => screen.getByTestId("identity");
    const flashed = () => screen.getByTestId("hud-progress").classList.contains("hud__progress--up");
    expect(await g.session.saves.saveAsync("slot-1")).toBe(true);
    levelUp(g);
    expect(flashed()).toBe(true);
    act(() => vi.advanceTimersByTime(5000));
    expect(flashed()).toBe(false);
    // Back to level 1 from the save: the XP and the level change, nothing was earned.
    expect(await run(() => g.session.saves.loadAsync("slot-1"))).toBe(true);
    g.step(1);
    expect(g.ui.getState().level).toBe(1);
    expect(flashed()).toBe(false);
    expect(identity().classList.contains("hud__identity--calm")).toBe(true);
    levelUp(g);
    act(() => vi.advanceTimersByTime(5000));
    run(() => g.session.newGame());
    g.step(1);
    expect(g.ui.getState().level).toBe(1);
    expect(flashed()).toBe(false);
    expect(identity().classList.contains("hud__identity--calm")).toBe(true);
  });

  it("K opens the tab; a point and a rank spent there reach the domain and the marks at once", () => {
    const g = start();
    levelUp(g);
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.getByTestId("progress-tab")).toBeTruthy();
    expect(screen.getByTestId("progress-tab-points").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Raise Might" }));
    expect(g.session.sim.domain.progression).toMatchObject({ attributes: { might: 4 }, unspent: { attribute: 0, perk: 1 } });
    // Might 4 opens tier 4 of its tree, which is on show.
    fireEvent.click(screen.getByRole("button", { name: "Buy Thick Skin" }));
    expect(g.session.sim.domain.progression).toMatchObject({ perks: { might_tough: 1 }, unspent: { perk: 0 } });
    expect(screen.queryByTestId("progress-tab-points")).toBeNull();
    expect(screen.getByTestId("perk-might_tough").textContent).toContain("Rank 1/3");
    fireEvent.keyDown(window, { code: "KeyK" });
    expect(screen.queryByTestId("character-screen")).toBeNull();
    g.step(1);
    expect(screen.queryByTestId("hud-points")).toBeNull();
  });

  it("on a phone the menu button wears the points, opens on Progress and the tab spends them by tap", () => {
    const g = start(true);
    levelUp(g);
    const menu = screen.getByRole("button", { name: "Character" });
    expect(within(menu).getByTestId("touch-character-points").textContent).toBe("2");
    // With points to spend the menu opens straight on Progress (decision of 6.11).
    fireEvent.click(menu);
    expect(screen.getByRole("tab", { name: /Progress/ }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByTestId("attribute-tree-net"));
    fireEvent.click(screen.getByRole("button", { name: "Raise Net" }));
    expect(g.session.sim.domain.progression.attributes.net).toBe(4);
    expect(screen.getByTestId("progress-tab-points").textContent).toBe("1");
  });
});
