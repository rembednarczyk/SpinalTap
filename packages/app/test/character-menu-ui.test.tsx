// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Game, mountGame, run, unmountGame } from "./game-ui";

/**
 * The character menu on the real UI (formerly e2e/character-menu.spec.ts, ADR-0046): loot an
 * SMG, equip it in the menu, see it reach the 3D preview, turn the preview, save and load. The
 * preview is the session's PreviewHost; what the engine's PreviewStage makes of the look is
 * engine/test/loadout.test.ts, and the box's real size on a desktop and a phone is in smoke and
 * touch-layout.
 */

// Seed 71: the alley guard drops an uncommon Hebi SMG (rolled from its own loot stream).
const SEED = 71;

/** Downs the guard, opens its bag and takes everything: the SMG lands in the inventory. */
const lootTheGuard = (g: Game) => {
  const guard = [...g.session.sim.world].find((e) => e.key === "guard")!;
  guard.health = { current: 0, max: guard.health!.max };
  g.step(2);
  const bag = g.session.sim.domain.loot.containers.find((c) => c.key === "loot:guard");
  expect(bag?.key).toBe("loot:guard");
  run(() => g.seki.teleport(bag!.position.x, bag!.position.z - 1));
  g.step(1, { interact: true });
  fireEvent.click(screen.getByTestId("loot-take-all"));
  g.step(2);
  expect(screen.queryByTestId("loot")).toBeNull();
  const smg = g.session.sim.domain.inventory.items.find((i) => i.def === "hebi_smg");
  expect(smg?.rarity).toBe("uncommon");
  return smg!.uid;
};

/** I on a keyboard, the one "Postać" button on a phone. */
const openMenu = (phone: boolean) => {
  if (phone) fireEvent.click(screen.getByRole("button", { name: "Character" }));
  else fireEvent.keyDown(window, { code: "KeyI" });
};

const cell = (def: string) => screen.getAllByTestId("item-cell").find((c) => c.getAttribute("data-def") === def)!;

const scenario = async (phone: boolean) => {
  const g = mountGame({ seed: SEED, touch: phone });
  fireEvent.click(screen.getByRole("button", { name: "New Game" }));
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  g.step(1);
  const smg = lootTheGuard(g);
  const { preview, session } = g;

  openMenu(phone);
  expect(screen.getByTestId("character-screen")).toBeTruthy();
  expect(screen.getByTestId("inventory-tab")).toBeTruthy();
  if (phone) expect(screen.queryByTestId("touch-controls")).toBeNull();
  // The preview gets the box and the look: the pistol in the hand, nothing stowed.
  expect(preview.rect).toEqual({ x: 20, y: 60, width: 200, height: 320 });
  expect(preview.look?.weapons).toEqual({ primary: null, secondary: "pistol", melee: null, active: "secondary" });
  const tick = g.seki.state().tick;

  // Pick the SMG: details with the comparison against the empty primary slot.
  fireEvent.click(cell("hebi_smg"));
  const detail = screen.getByTestId("item-detail");
  expect(detail.textContent).toContain("Hebi SMG");
  expect(detail.textContent).toContain("uncommon");
  expect(detail.textContent).toContain("primary slot empty");
  expect(screen.getByTestId("item-compare").textContent).toContain("Damage");

  // Equip: applies at once with the clock stopped, and the preview carries the SMG.
  const look = preview.look;
  fireEvent.click(within(detail).getByRole("button", { name: /Equip/ }));
  expect(screen.getByTestId("slot-primary").textContent).toContain("Hebi SMG");
  expect(session.sim.domain.equipment.primary).toBe(smg);
  expect(g.seki.state().tick).toBe(tick);
  expect(preview.look).not.toBe(look);
  expect(preview.look?.weapons).toMatchObject({ primary: "smg", active: "secondary" });
  expect(screen.getByTestId("item-detail").textContent).toContain("Equipped");

  // Turn the character with a finger or the mouse.
  const box = screen.getByTestId("character-preview");
  fireEvent.pointerDown(box, { pointerId: 1, clientX: 80, clientY: 220 });
  for (let i = 1; i <= 5; i++) fireEvent.pointerMove(box, { pointerId: 1, clientX: 80 + i * 14, clientY: 220 });
  fireEvent.pointerUp(box, { pointerId: 1, clientX: 150, clientY: 220 });
  expect(preview.yaw).toBeGreaterThan(0.5);

  // The sheet and the journal are tabs of the same screen; the preview goes with the inventory.
  fireEvent.click(screen.getByRole("tab", { name: /Sheet/ }));
  expect(screen.getByTestId("character-panel")).toBeTruthy();
  expect(preview.rect).toBeNull();
  if (phone) fireEvent.click(screen.getByRole("button", { name: "Close the character menu" }));
  else fireEvent.keyDown(window, { code: "Escape" });
  expect(screen.queryByTestId("character-screen")).toBeNull();
  g.step(1);
  expect(g.seki.state().tick).toBe(tick + 1);

  // Save, start over, load: the SMG is still in the primary slot and in the preview.
  expect(await session.saves.saveAsync("slot-3")).toBe(true);
  run(() => session.newGame());
  expect(session.sim.domain.equipment.primary).toBeNull();
  expect(await session.saves.loadAsync("slot-3")).toBe(true);
  expect(session.sim.domain.equipment.primary).toBe(smg);
  openMenu(phone);
  expect(screen.getByTestId("slot-primary").textContent).toContain("Hebi SMG");
  expect(preview.look?.weapons.primary).toBe("smg");
};

let rect: { mockRestore(): void } | null = null;
beforeEach(() => {
  // jsdom lays nothing out: the preview box measures as the browser would place it.
  rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 20, y: 60, left: 20, top: 60, width: 200, height: 320, right: 220, bottom: 380, toJSON: () => ({}) } as DOMRect);
});
afterEach(() => {
  rect?.mockRestore();
  unmountGame();
});

describe("character menu in the game", () => {
  it("on a desktop: loot an SMG, equip it in the menu, see it on Seki, save and load", async () => {
    await scenario(false);
  });

  it("on a phone: loot an SMG, equip it by touch, turn the preview with a finger, save and load", async () => {
    await scenario(true);
  });

  it("a helmet and a ballistic vest go on Seki's look in the preview, tinting her top", () => {
    const g = mountGame({ seed: SEED });
    fireEvent.click(screen.getByRole("button", { name: "New Game" }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    // Into the bag, not worn yet, as a load would bring them (quicker than buying them at the market).
    run(() => {
      const d = g.session.sim.domain;
      const items = [
        ...d.inventory.items,
        { uid: "t-helmet", def: "moto_helmet" as const, rarity: "common" as const, condition: 100 },
        { uid: "t-vest", def: "ballistic_vest" as const, rarity: "common" as const, condition: 100 },
      ];
      g.seki.jump({ inventory: { ...d.inventory, items } });
    });
    g.step(1);
    fireEvent.keyDown(window, { code: "KeyI" });
    expect(g.preview.rect).not.toBeNull();
    const top = g.preview.look?.garments.torso?.tint;
    expect(g.preview.look?.garments.head).toBeUndefined();

    for (const def of ["moto_helmet", "ballistic_vest"]) {
      fireEvent.click(cell(def));
      fireEvent.click(within(screen.getByTestId("item-detail")).getByRole("button", { name: /Equip/ }));
    }
    const garments = g.preview.look!.garments;
    expect([...(garments.head?.attachments ?? []), ...(garments.torso?.attachments ?? [])].map((a) => a.mesh)).toEqual(["helmet", "vest-plate"]);
    expect(garments.torso?.tint).toBeDefined();
    expect(garments.torso?.tint).not.toBe(top);
    expect(g.session.sim.domain.equipment).toMatchObject({ head: "t-helmet", torso: "t-vest" });
  });
});
