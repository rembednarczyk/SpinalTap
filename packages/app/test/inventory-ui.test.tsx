// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { mountGame, run, unmountGame } from "./game-ui";

/** The weapon strip and the loot bag on the real UI (formerly e2e/inventory.spec.ts, ADR-0046). */
const start = () => {
  const game = mountGame({ seed: 7 });
  fireEvent.click(screen.getByRole("button", { name: "Nowa gra" }));
  game.step(1);
  return game;
};

afterEach(unmountGame);

describe("weapon strip and loot in the game", () => {
  it("the weapon strip counts rounds down and the pistol reloads on R", () => {
    const { step } = start();
    const ammo = () => screen.getByTestId("weapon-ammo").textContent ?? "";
    expect(ammo()).toContain("12 / 48");
    expect(screen.getByTestId("weapon-strip").textContent).toContain("Unity-9");
    // About five shots at 0.28 s each.
    step(80, { fire: true });
    expect(ammo()).not.toContain("12 / 48");
    step(1, { reload: true });
    expect(ammo()).toContain("przeładowanie");
    step(90);
    expect(ammo()).toMatch(/12 \/ (4[0-4])/);
  });

  it("a killed ganger leaves a bag; E opens it and Weź wszystko empties it", () => {
    const { seki, session, step } = start();
    // Down the guard in the alley and walk up to its bag.
    const guard = [...session.sim.world].find((e) => e.key === "guard")!;
    guard.health = { current: 0, max: guard.health!.max };
    step(2);
    // The street's stashes (ADR-0026) are containers too: pick the guard's bag by key.
    const bag = session.sim.domain.loot.containers.find((c) => c.key === "loot:guard");
    expect(bag?.key).toBe("loot:guard");
    const before = seki.state().eddies;
    run(() => seki.teleport(bag!.position.x, bag!.position.z - 1));
    step(1);
    expect(screen.getByTestId("prompt").textContent).toContain("Przeszukaj");
    step(1, { interact: true });

    const panel = screen.getByTestId("loot");
    expect(panel.textContent).toContain("Torba gangera");
    expect(within(panel).getAllByTestId("loot-line")[0]!.textContent).toContain("€$");
    fireEvent.click(within(panel).getByTestId("loot-take-all"));
    step(2);
    expect(screen.queryByTestId("loot")).toBeNull();
    expect(seki.state().eddies).toBeGreaterThan(before);
    expect(session.sim.domain.loot.containers.some((c) => c.key === "loot:guard")).toBe(false);
    expect(seki.state().dialogue).toBe(false);
  });
});
