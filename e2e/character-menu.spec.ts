import { type Page, type TestInfo, expect, test } from "@playwright/test";
import type { DomainState } from "@seki/core";
import { freeze, step, teleport, waitForGame } from "./helpers";

// Seed 71: the alley guard drops an uncommon Hebi SMG (rolled from its own loot stream).
const SEED = 71;

const preview = (page: Page) => page.evaluate(() => window.__seki!.preview());
const domain = (page: Page) => page.evaluate(() => window.__seki!.session.sim.domain);

/** Screenshots for a look before committing; written only when SEKI_SHOTS names a folder. */
const shot = async (page: Page, info: TestInfo, name: string) => {
  const dir = process.env.SEKI_SHOTS;
  await page.screenshot({ path: dir ? `${dir}/${name}.png` : info.outputPath(`${name}.png`) });
};

/** Downs the guard, opens its bag and takes everything: the SMG lands in the inventory. */
const lootTheGuard = async (page: Page, tap: boolean) => {
  await page.evaluate(() => {
    const guard = [...window.__seki!.session.sim.world].find((e) => e.key === "guard")!;
    guard.health = { current: 0, max: guard.health!.max };
  });
  await step(page, 2);
  const bag = await page.evaluate(() => window.__seki!.session.sim.domain.loot.containers[0] ?? null);
  expect(bag?.key).toBe("loot:guard");
  await teleport(page, bag!.position.x, bag!.position.z - 1);
  await step(page, 1, { interact: true });
  const take = page.getByTestId("loot-take-all");
  await expect(take).toBeVisible();
  await (tap ? take.tap() : take.click());
  await step(page, 2);
  await expect(page.getByTestId("loot")).toBeHidden();
  const smg = (await domain(page)).inventory.items.find((i) => i.def === "hebi_smg");
  expect(smg?.rarity).toBe("uncommon");
  return smg!.uid;
};

const scenario = async (page: Page, info: TestInfo, phone: boolean) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?seed=${SEED}`);
  await waitForGame(page);
  const newGame = page.getByRole("button", { name: "Nowa gra" });
  await (phone ? newGame.tap() : newGame.click());
  await freeze(page);
  await step(page, 1);
  const smg = await lootTheGuard(page, phone);

  // Open the menu: I on a keyboard, the one "Postać" button on a phone.
  if (phone) await page.getByRole("button", { name: "Postać" }).tap();
  else await page.keyboard.press("KeyI");
  const menu = page.getByTestId("character-screen");
  await expect(menu).toBeVisible();
  await expect(page.getByTestId("inventory-tab")).toBeVisible();
  if (phone) await expect(page.getByTestId("touch-controls")).toBeHidden();
  await expect.poll(async () => (await preview(page))?.visible).toBe(true);
  expect(await preview(page)).toMatchObject({ hand: "pistol", stowed: {} });
  const tick = (await page.evaluate(() => window.__seki!.state())).tick;
  // The box is where the canvas draws the character; it has to be a real part of the screen.
  const box = (await page.getByTestId("character-preview").boundingBox())!;
  expect(box.width).toBeGreaterThan(phone ? 100 : 180);
  expect(box.height).toBeGreaterThan(phone ? 150 : 300);

  // Pick the SMG: details with the comparison against the empty primary slot.
  const cell = page.locator('[data-testid="item-cell"][data-def="hebi_smg"]');
  await (phone ? cell.tap() : cell.click());
  const detail = page.getByTestId("item-detail");
  await expect(detail).toContainText("Hebi SMG");
  await expect(detail).toContainText("niezwykły");
  await expect(detail).toContainText("slot główny pusty");
  await expect(page.getByTestId("item-compare")).toContainText("Obrażenia");
  await shot(page, info, phone ? "menu-phone-detail" : "menu-desktop-detail");

  // Equip: applies at once with the clock stopped, and the preview carries the SMG.
  const renders = (await preview(page))!.renders;
  const equip = detail.getByRole("button", { name: /Załóż/ });
  await (phone ? equip.tap() : equip.click());
  await expect(page.getByTestId("slot-primary")).toContainText("Hebi SMG");
  expect((await domain(page)).equipment.primary).toBe(smg);
  expect((await page.evaluate(() => window.__seki!.state())).tick).toBe(tick);
  await expect.poll(async () => (await preview(page))?.stowed.primary).toBe("smg");
  await expect.poll(async () => (await preview(page))!.renders).toBeGreaterThan(renders);
  await expect(detail).toContainText("Założona");

  // Turn the character with a finger or the mouse.
  const yaw0 = (await preview(page))!.yaw;
  const from = { x: box.x + box.width * 0.3, y: box.y + box.height * 0.5 };
  if (phone) {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
    await touch("touchStart", from.x, from.y);
    for (let i = 1; i <= 5; i++) await touch("touchMove", from.x + i * 14, from.y);
    await touch("touchEnd", from.x + 70, from.y);
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 70, from.y, { steps: 5 });
    await page.mouse.up();
  }
  await expect.poll(async () => (await preview(page))!.yaw).toBeGreaterThan(yaw0 + 0.5);
  await shot(page, info, phone ? "menu-phone-equipped" : "menu-desktop-equipped");

  // The sheet and the journal are tabs of the same screen.
  const sheetTab = page.getByRole("tab", { name: /Karta/ });
  await (phone ? sheetTab.tap() : sheetTab.click());
  await expect(page.getByTestId("character-panel")).toBeVisible();
  await expect.poll(async () => (await preview(page))?.visible).toBe(false);
  if (phone) await page.getByRole("button", { name: "Zamknij menu postaci" }).tap();
  else await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await step(page, 1);
  expect((await page.evaluate(() => window.__seki!.state())).tick).toBe(tick + 1);

  // Save, start over, load: the SMG is still in the primary slot and in the preview.
  expect(await page.evaluate(() => window.__seki!.session.saveAsync("slot-3"))).toBe(true);
  await page.evaluate(() => window.__seki!.session.newGame());
  expect((await domain(page)).equipment.primary).toBeNull();
  expect(await page.evaluate(() => window.__seki!.session.loadAsync("slot-3"))).toBe(true);
  await freeze(page);
  expect((await domain(page)).equipment.primary).toBe(smg);
  if (phone) await page.getByRole("button", { name: "Postać" }).tap();
  else await page.keyboard.press("KeyI");
  await expect(page.getByTestId("slot-primary")).toContainText("Hebi SMG");
  await expect.poll(async () => (await preview(page))?.stowed.primary).toBe("smg");
  expect(errors).toEqual([]);
};

test.describe("character menu on a desktop", () => {
  test("loot an SMG, equip it in the menu, see it on Seki, save and load", async ({ page }, info) => {
    test.slow();
    await scenario(page, info, false);
  });
});

test.describe("character menu on a phone in landscape", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("loot an SMG, equip it by touch, turn the preview with a finger, save and load", async ({ page }, info) => {
    test.slow();
    await scenario(page, info, true);
  });
});

test.describe("garments on the menu preview", () => {
  test("a helmet and a ballistic vest go on Seki's model in the preview, tinting her top", async ({ page }) => {
    test.slow();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`/?seed=${SEED}`);
    await waitForGame(page);
    await page.getByRole("button", { name: "Nowa gra" }).click();
    await freeze(page);
    // Into the bag, not worn yet (quicker than buying them at the market).
    await page.evaluate(() => {
      const sim = window.__seki!.session.sim as unknown as { holder: { domain: DomainState } };
      const d = sim.holder.domain;
      const items = [
        ...d.inventory.items,
        { uid: "e2e-helmet", def: "moto_helmet" as const, rarity: "common" as const, condition: 100 },
        { uid: "e2e-vest", def: "ballistic_vest" as const, rarity: "common" as const, condition: 100 },
      ];
      sim.holder.domain = { ...d, inventory: { ...d.inventory, items } };
    });
    await step(page, 1);
    await page.keyboard.press("KeyI");
    await expect.poll(async () => (await preview(page))?.visible).toBe(true);
    // The imported heroine loads in the background; garments then hang on her bones.
    await expect.poll(async () => (await preview(page))?.dressed, { timeout: 90_000 }).toBe(true);
    expect(await preview(page)).toMatchObject({ garments: [], tinted: 0 });

    for (const def of ["moto_helmet", "ballistic_vest"]) {
      await page.locator(`[data-testid="item-cell"][data-def="${def}"]`).click();
      await page.getByTestId("item-detail").getByRole("button", { name: /Załóż/ }).click();
    }
    await expect.poll(async () => (await preview(page))?.garments).toEqual(["helmet", "vest-plate"]);
    expect(await preview(page)).toMatchObject({ garmentsOnModel: true, tinted: 1 });
    expect((await domain(page)).equipment).toMatchObject({ head: "e2e-helmet", torso: "e2e-vest" });
    expect(errors).toEqual([]);
  });
});
