// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mountGame, run, unmountGame } from "./game-ui";

/**
 * The health bar of the inventory on the real UI (ADR-0046): Seki eats from the bag with the
 * clock standing and the bar in the menu shows the new HP in the same frame.
 */
afterEach(unmountGame);

const cell = (def: string) => screen.getAllByTestId("item-cell").find((c) => c.getAttribute("data-def") === def)!;
const bar = () => screen.getByTestId("inventory-health");

describe("health bar in the inventory, in the game", () => {
  it("eating ramen from the bag raises HP on the bar at once", () => {
    const g = mountGame({ seed: 7 });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    g.step(1);
    // Two bowls from Fumiko's stall (open at 21:00, ADR-0026), then a hurt Seki.
    run(() => g.session.sim.enqueue({ type: "buy-item", itemId: "ramen", shopId: "yatai" }));
    run(() => g.session.sim.enqueue({ type: "buy-item", itemId: "ramen", shopId: "yatai" }));
    g.step(1);
    expect(g.session.sim.domain.inventory.stacks.ramen).toBe(2);
    const player = g.session.sim.player()!;
    player.health = { current: 40, max: player.health!.max };
    g.step(1);

    fireEvent.keyDown(window, { code: "KeyI" });
    expect(bar().textContent).toContain(`40 / ${player.health.max}`);
    fireEvent.click(cell("ramen"));
    expect(bar().textContent).toContain("+30 HP");
    const tick = g.seki.state().tick;
    fireEvent.click(within(screen.getByTestId("item-detail")).getByRole("button", { name: /Use/ }));

    // The clock stood, the bowl is gone and the bar moved by what the ramen heals.
    expect(g.seki.state().tick).toBe(tick);
    expect(g.session.sim.domain.inventory.stacks.ramen).toBe(1);
    expect(g.session.sim.player()!.health!.current).toBe(70);
    expect(bar().textContent).toContain(`70 / ${player.health.max}`);
    expect(bar().querySelector<HTMLElement>(".inv__hp-fill")!.style.width).toBe(`${(70 / player.health.max) * 100}%`);
  });
});
