// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * The day clock and Oyaji's stall on the real UI (formerly e2e/day-cycle.spec.ts and
 * e2e/trade.spec.ts, ADR-0046). Game time passes with the wait command and fixed steps.
 */
const start = () => {
  const game = mountGame({ seed: 5 });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  return game;
};

/** Teleports to a point of the market's own frame and lets one step stream it in. */
const toMarket = (g: Game, x: number, z: number) => {
  run(() => {
    const p = g.seki.place("market", x, 0, z);
    g.seki.teleport(p.x, p.z, 0, 0, p.y);
  });
  g.step(1);
};

const wait = (g: Game, minutes: number) => run(() => g.seki.wait(minutes));

afterEach(unmountGame);

describe("day clock in the game", () => {
  it("the HUD clock follows game time; Oyaji's stall is closed at night and open by day", () => {
    const g = start();
    const clock = () => screen.getByTestId("clock").textContent ?? "";
    expect(clock()).toContain("Dzień 1");
    expect(clock()).toContain("noc");
    expect(clock()).toMatch(/21:0\d/);

    // Walk up to the market (streams it in), then let the evening pass to after closing time.
    toMarket(g, 40, 78);
    wait(g, 90);
    g.step(60 * 5);
    expect(g.seki.state().clock).toMatch(/^22:3\d$/);
    toMarket(g, 74.5, 65.4);
    g.step(1);
    expect(screen.getByTestId("prompt").textContent).toContain("zamknięte");

    // A morning later the closed sign is gone and the clock reads day.
    wait(g, 10 * 60);
    g.step(2);
    expect(clock()).toContain("dzień");
    expect(clock()).toContain("Dzień 2");
    expect(screen.queryByTestId("prompt")).toBeNull();
  });
});

describe("Oyaji's stall in the game", () => {
  it("by day Oyaji's stall buys a medkit through the Sell tab", () => {
    const g = start();
    // To the market, then on to noon of the next day: the stall is up and Oyaji stands behind it.
    toMarket(g, 40, 78);
    wait(g, 15 * 60);
    g.step(2);
    expect(g.seki.state().clock).toMatch(/^12:0\d$/);
    const oyaji = [...g.session.sim.world].find((x) => x.key === "oyaji")!;
    run(() => g.seki.teleport(oyaji.position.x, oyaji.position.z - 1.4));
    g.step(1);
    expect(screen.getByTestId("prompt").textContent).toContain("Stragan Oyajiego");
    g.step(1, { interact: true });

    const shop = screen.getByTestId("shop");
    expect(shop.textContent).toContain("Oyaji");
    const before = g.seki.state().eddies;
    fireEvent.click(within(shop).getByRole("tab", { name: "Sell" }));
    const medkit = () => within(shop).queryAllByTestId("shop-sell-line").filter((l) => l.textContent?.includes("Apteczka"));
    expect(medkit()).toHaveLength(1);
    fireEvent.click(within(medkit()[0]!).getByRole("button", { name: /Sell · 22 €\$/ }));
    g.step(1);
    expect(g.seki.state().eddies).toBe(before + 22);
    expect(screen.getByTestId("gear").textContent).not.toContain("Apteczki × 1");
    expect(medkit()).toHaveLength(0);

    fireEvent.click(within(shop).getByRole("button", { name: /Step away from the stall/ }));
    expect(screen.queryByTestId("shop")).toBeNull();
    g.step(1);
    expect(g.seki.state().dialogue).toBe(false);
    expect(g.session.inControl).toBe(true);
  });
});
