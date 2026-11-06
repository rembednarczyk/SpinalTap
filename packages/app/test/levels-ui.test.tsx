// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ALCHEMIA_LIFT, ALCHEMIA_MARKET_PROPS, HANA_SPOT, docks, groundY } from "@seki/sim";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * The lift, a jump and a ladder with the HUD's prompts and the minimap (formerly
 * e2e/levels.spec.ts, ADR-0046): Alchemia's lift to the roof terrace (the market's overpass and
 * fire escape went with it off Aleja Tysiąclecia, ADR-0063; their mechanics are the sim's test
 * floor's), Hana's cart and the ladder of the docks' container stack. The real Space key in the
 * running loop is smoke's "real input" test; here the jump is an input frame.
 */
const NORTH = 0;
const SOUTH = Math.PI;

type Point = { x: number; y: number; z: number };

const start = () => {
  const game = mountGame({ seed: 11 });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(screen.getByTestId("hud")).toBeTruthy();
  return game;
};

/** Walks forward in chunks until `done` holds for the player's position. */
const walkUntil = (g: Game, done: (p: Point) => boolean, chunks = 20): Point => {
  for (let i = 0; i < chunks; i++) {
    const p = g.seki.state().player!;
    if (done(p)) return p;
    g.step(30, { moveZ: 1 });
  }
  return g.seki.state().player!;
};

const prompt = () => screen.queryByTestId("prompt")?.textContent ?? "";

const C = ALCHEMIA_LIFT.centre;
const [GROUND, TOP] = ALCHEMIA_LIFT.levels;
/** Steps of a ride from one level to the other (2.5 m/s, ADR-0020), and a few for the gate. */
const RIDE = Math.ceil(((TOP - GROUND) / 2.5) * 60) + 15;

afterEach(unmountGame);

describe("levels in the game (ADR-0020, ADR-0021)", () => {
  it("Alchemia's lift up to the roof terrace and back down, the minimap telling the height", () => {
    const g = start();
    // In front of the cage's door on the square behind the hall; one step streams the plot in.
    run(() => g.seki.teleport(C.x, C.z + ALCHEMIA_LIFT.half + 1.4, SOUTH));
    g.step(1);
    walkUntil(g, (p) => Math.hypot(p.x - C.x, p.z - C.z) < 0.5, 6);
    expect(prompt()).toContain("Elevator");
    g.step(1, { interact: true });
    g.step(RIDE);
    expect(g.seki.state().player!.y).toBeCloseTo(TOP, 2);
    g.step(1);
    expect(screen.getByTestId("minimap-level").textContent).toContain("m");
    // And down again from the cage.
    g.step(1, { interact: true });
    g.step(RIDE);
    expect(g.seki.state().player!.y).toBeCloseTo(GROUND, 2);
  });

  it("jump onto Hana's cart and the container stack's ladder onto its top", () => {
    const g = start();
    // A new game wakes on the clinic chair (ADR-0038): jump from the deptak in front of it (ADR-0045).
    run(() => g.seki.teleport(321.4, -80));
    g.step(1);
    const base = g.seki.state().player!.y;
    g.step(1, { jump: true });
    let peak = base;
    for (let i = 0; i < 60; i++) {
      g.step(1);
      peak = Math.max(peak, g.seki.state().player!.y);
    }
    expect(peak).toBeGreaterThan(base + 0.3);
    g.step(90);
    expect(g.seki.state().player!.y).toBeCloseTo(base, 2);

    // Hana's 1 m cart (ADR-0063): walking only bumps into it, a jump lands on top.
    const cart = ALCHEMIA_MARKET_PROPS[0]!;
    const cartTop = cart.center.y + (cart.view.kind === "block" ? cart.view.size.y / 2 : 0);
    run(() => g.seki.teleport(cart.center.x, HANA_SPOT.z + 2.1, SOUTH, 0, groundY(cart.center.x, HANA_SPOT.z + 2.1)));
    g.step(1);
    g.step(1, { moveZ: 1, jump: true });
    for (let i = 0; i < 60 && g.seki.state().airborne; i++) g.step(1, { moveZ: 1 });
    expect(g.seki.state().player!.y).toBeCloseTo(cartTop, 2);

    // The docks' container stack: into the foot of its ladder, up onto the low container.
    const foot = docks(3, 0, 99.6);
    run(() => g.seki.teleport(foot.x, foot.z, NORTH, 0, foot.y));
    g.step(1);
    walkUntil(g, () => false, 1);
    expect(g.seki.state().climbing).toBe("doki-stack-1");
    const top = walkUntil(g, (p) => !g.seki.state().climbing && p.y - foot.y > 2.4, 12);
    expect(top.y - foot.y).toBeGreaterThan(2.4);
    // The minimap says the player is up on a level.
    g.step(1);
    expect(screen.getByTestId("minimap-level").textContent).toContain("m");
  });
});
