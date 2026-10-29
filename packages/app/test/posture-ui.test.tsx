// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { eyeHeightAt } from "@seki/sim";
import { afterEach, describe, expect, it } from "vitest";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * Crouch, aim down sights and the baton on the real HUD (formerly e2e/combat-posture.spec.ts
 * and e2e/ads-melee.spec.ts, ADR-0046). The mouse buttons and C are input frames here: their
 * mapping is engine/test/keymap.test.ts and browser-input.test.ts, the real mouse on the page
 * is smoke's "real input" test.
 */
const start = (seed = 7) => {
  const game = mountGame({ seed });
  fireEvent.click(screen.getByRole("button", { name: "Nowa gra" }));
  game.step(2);
  return game;
};

const crosshair = () => screen.getByTestId("crosshair");
const spread = () => Number(crosshair().getAttribute("data-spread"));
const has = (cls: string) => crosshair().classList.contains(cls);

/** The game camera's eye height: the player's transform as the render port got it, through the camera rig's curve. */
const cameraY = (g: Game) => {
  const t = g.render.transforms.get(g.session.sim.player()!.id)!;
  return t.position.y + eyeHeightAt(t.crouch ?? 0);
};

afterEach(unmountGame);

describe("posture on the HUD in the game", () => {
  it("crouching lowers the view and pulls the crosshair in; running spreads it", () => {
    const g = start();
    const standing = spread();
    expect(standing).toBeGreaterThan(0);
    const eyeStanding = cameraY(g);

    // Crouch held: the sim eases down, the camera and the HUD follow.
    g.step(20, { crouch: true });
    expect(has("crosshair--crouched")).toBe(true);
    expect(spread()).toBeLessThan(standing * 0.6);
    expect(eyeStanding - cameraY(g)).toBeGreaterThan(0.35);

    g.step(20, { moveZ: 1, sprint: true });
    expect(has("crosshair--crouched")).toBe(false);
    expect(spread()).toBeGreaterThan(standing);
  });

  it("holding the aim button aims down sights: the crosshair pulls in, letting go restores it", () => {
    const g = start();
    const hip = spread();
    expect(hip).toBeGreaterThan(0);

    g.step(30, { aim: true });
    expect(has("crosshair--aiming")).toBe(true);
    expect(spread()).toBeLessThan(hip * 0.7);
    expect(g.session.sim.player()!.posture!.aim).toBe(1);

    g.step(30);
    expect(has("crosshair--aiming")).toBe(false);
    expect(spread()).toBeCloseTo(hip, 2);
  });

  it("with the baton the aim button guards and fire swings", () => {
    const g = start();
    // A baton in the melee slot, as a load would bring it (quicker than buying one at the market).
    run(() => {
      const d = g.session.sim.domain;
      g.seki.jump({
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "t-baton", def: "baton", rarity: "common" }] },
        equipment: { ...d.equipment, melee: "t-baton" },
      });
    });
    // The 3 key picks the melee slot.
    g.step(1, { weaponSlot: 3 });
    g.step(30);
    expect(screen.getByTestId("weapon-strip").textContent).toContain("Pałka");
    const melee = () => ({ ...g.session.sim.player()!.melee! });

    // Held, as the right mouse button is.
    g.step(10, { aim: true });
    expect(has("crosshair--guard")).toBe(true);
    expect(melee().guard).toBe(true);
    g.step(10);
    expect(has("crosshair--guard")).toBe(false);
    expect(melee().guard).toBe(false);

    g.step(1, { fire: true });
    expect(melee().phase).not.toBe("idle");
    for (let n = 0; n < 180 && melee().phase !== "idle"; n++) g.step(1);
    expect(melee().phase).toBe("idle");
  });
});
