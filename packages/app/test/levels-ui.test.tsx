// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * Stairs, the freight lift, a jump and the fire escape with the HUD's prompts and the minimap
 * (formerly e2e/levels.spec.ts, ADR-0046). The real Space key in the running loop is smoke's
 * "real input" test; here the jump is an input frame.
 */
const EAST = Math.PI / 2;
const NORTH = 0;

type Point = { x: number; y: number; z: number };

const start = () => {
  const game = mountGame({ seed: 11 });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
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

/** Puts the player on a floor above the ground (the deck, a balcony), facing `yaw`. */
const standAt = (g: Game, at: Point, yaw: number) =>
  run(() => {
    const p = g.session.sim.player()!;
    p.position = at;
    p.prevPosition = at;
    p.yaw = yaw;
  });

const prompt = () => screen.queryByTestId("prompt")?.textContent ?? "";

afterEach(unmountGame);

describe("levels in the game (ADR-0020, ADR-0021)", () => {
  it("stairs up to the overpass and the freight lift down", () => {
    const g = start();
    // The market keeps its own coordinates, moved under the viaduct (ADR-0045): O is its origin.
    const O = g.seki.place("market", 0, 0, 0);
    // Foot of the stairs on the north edge of the deck; one step streams the market in.
    run(() => g.seki.teleport(O.x + 69.4, O.z + 98.1, EAST));
    g.step(1);
    const top = walkUntil(g, (p) => p.x > O.x + 87);
    expect(top.y - O.y).toBeCloseTo(9.9, 3);

    // Along the deck to the lift gate, then call the platform up with the button.
    standAt(g, { x: O.x + 108, y: O.y + 9.9, z: O.z + 89 }, Math.PI);
    g.step(1);
    expect(prompt()).toContain("Winda");
    g.step(1, { interact: true });
    g.step(300);
    // Onto the platform and down.
    walkUntil(g, (p) => p.z < O.z + 85.8);
    g.step(1, { interact: true });
    g.step(300);
    expect(g.seki.state().player!.y - O.y).toBeLessThan(0.3);
    // Off the platform northwards, under the deck.
    run(() => {
      g.session.sim.player()!.yaw = NORTH;
    });
    const below = walkUntil(g, (p) => p.z > O.z + 90);
    expect(below.y).toBeCloseTo(O.y, 3);
  });

  it("jump onto a stall counter and the fire escape onto the roof", () => {
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

    // A 1 m counter: walking only bumps into it, a jump lands on top.
    const O = g.seki.place("market", 0, 0, 0);
    run(() => g.seki.teleport(O.x + 96.7, O.z + 69.2, Math.PI));
    g.step(1);
    g.step(1, { moveZ: 1, jump: true });
    for (let i = 0; i < 60 && g.seki.state().airborne; i++) g.step(1, { moveZ: 1 });
    expect(g.seki.state().player!.y - O.y).toBeCloseTo(1, 3);

    // Fire escape: into the foot of the first ladder, up onto the balcony.
    run(() => g.seki.teleport(O.x + 73.2, O.z + 65.6, Math.PI));
    g.step(1);
    walkUntil(g, () => false, 1);
    expect(g.seki.state().climbing).toBe("targ-escape-1");
    walkUntil(g, (p) => p.y - O.y > 4.4, 10);
    // From the balcony, the interact key on the second ladder, then up onto the roof.
    standAt(g, { x: O.x + 69.2, y: O.y + 4.5, z: O.z + 64.6 }, Math.PI);
    g.step(1);
    expect(prompt()).toContain("Wspinaj się");
    g.step(1, { interact: true });
    expect(g.seki.state().climbing).toBe("targ-escape-2");
    const roof = walkUntil(g, (p) => p.z < O.z + 64 && (p.y - O.y > 9 || p.y - O.y < 0.1), 12);
    expect(roof.y - O.y).toBeGreaterThan(8);
    expect(g.seki.state().climbing).toBeNull();
    // The minimap says the player is up on a level.
    g.step(1);
    expect(screen.getByTestId("minimap-level").textContent).toContain("m");
  });
});
