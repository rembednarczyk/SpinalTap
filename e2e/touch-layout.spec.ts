import { join } from "node:path";
import { type Locator, type Page, expect, test } from "@playwright/test";
import { freeze, step, teleport, newGame, waitForGame, waitForPlay } from "./helpers";

/**
 * A phone in landscape (ADR-0035): at 800x370 and 667x375 CSS px no key element of the HUD or
 * the pad overlaps another, everything stays on screen and every touch target is 44 px or more.
 * Checked with the contextual "Use" button up and with the "more" row unfolded.
 */
interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const boxes = async (page: Page): Promise<Box[]> => {
  const out: Box[] = [];
  const add = async (name: string, selector: string) => {
    const loc = page.locator(selector);
    for (let i = 0; i < (await loc.count()); i++) {
      const el = loc.nth(i);
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      const label = (await el.getAttribute("aria-label")) ?? (await el.getAttribute("data-testid")) ?? `${name}#${i}`;
      if (b && b.width > 0 && b.height > 0) out.push({ name: `${name}:${label}`, ...b });
    }
  };
  await add("pad", "[data-testid=touch-controls] button");
  await add("hud", "[data-testid=minimap], [data-testid=eddies], [data-testid=clock], [data-testid=objective], [data-testid=identity], [data-testid=weapon-strip]");
  return out;
};

const overlap = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

const check = async (page: Page, w: number, h: number) => {
  const all = await boxes(page);
  expect(all.length).toBeGreaterThan(8);
  for (const b of all) {
    expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5, `${b.name} on screen`).toBe(true);
    if (b.name.startsWith("pad:")) expect(Math.min(b.width, b.height), `${b.name} at least 44 px`).toBeGreaterThanOrEqual(43.5);
  }
  const clashes: string[] = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (overlap(all[i]!, all[j]!)) clashes.push(`${all[i]!.name} × ${all[j]!.name}`);
  expect(clashes).toEqual([]);
};

for (const [w, h] of [
  [800, 370],
  [667, 375],
] as const) {
  test.describe(`phone ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test(`nothing overlaps at ${w}x${h}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/?seed=7&models=off&audio=off&touch");
      await waitForGame(page);
      // The loading screen (ADR-0057) is measured by the page the moment it shows: its heading,
      // bar and stage on screen and apart, whatever time the loading takes.
      await page.evaluate(() => {
        const w = window as unknown as { __loadingBoxes: { name: string; x: number; y: number; width: number; height: number }[] | null };
        w.__loadingBoxes = null;
        const seen = new MutationObserver(() => {
          const screen = document.querySelector("[data-testid=loading-screen]");
          if (!screen) return;
          seen.disconnect();
          w.__loadingBoxes = [".screen__heading", ".loading__bar", ".loading__stage"].map((sel) => {
            const r = screen.querySelector(sel)!.getBoundingClientRect();
            return { name: `loading:${sel}`, x: r.x, y: r.y, width: r.width, height: r.height };
          });
        });
        seen.observe(document.body, { childList: true, subtree: true });
      });
      await newGame(page, "tap");
      await waitForPlay(page);
      const loading = await page.evaluate(() => (window as unknown as { __loadingBoxes: Box[] | null }).__loadingBoxes);
      expect(loading).not.toBeNull();
      for (const b of loading!) expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5 && b.width > 0, `${b.name} on screen`).toBe(true);
      for (let i = 1; i < loading!.length; i++) expect(overlap(loading![i - 1]!, loading![i]!), `${loading![i]!.name} apart`).toBe(false);
      await freeze(page);
      // A new game wakes in the clinic (ADR-0038); the bare layout is checked out on the deptak
      // in front of the clinic (ADR-0045).
      await teleport(page, 321.4, -80);
      await step(page, 1);
      await expect(page.getByTestId("touch-controls")).toBeVisible();
      // No key hints on a touch screen.
      await expect(page.getByTestId("objective")).not.toContainText("[E]");
      await expect(page.getByTestId("touch-use")).toHaveCount(0);
      await check(page, w, h);
      // The character menu replaces the pad; its box is where the canvas draws the 3D preview.
      await page.getByRole("button", { name: "Character" }).tap();
      await expect(page.getByTestId("character-screen")).toBeVisible();
      await expect(page.getByTestId("touch-controls")).toBeHidden();
      const preview = (await page.getByTestId("character-preview").boundingBox())!;
      expect(preview.width).toBeGreaterThan(100);
      expect(preview.height).toBeGreaterThan(150);
      await page.getByRole("button", { name: "Close the character menu" }).tap();
      await expect(page.getByTestId("touch-controls")).toBeVisible();
      await page.evaluate(() => window.__seki!.emit("InteractionFocusChanged", { targetId: 1, prompt: "Porozmawiaj z Kaito" }));
      await expect(page.getByTestId("touch-use")).toContainText("Porozmawiaj z Kaito");
      await page.getByTestId("touch-more").tap();
      await expect(page.getByTestId("touch-more-actions")).toBeVisible();
      await check(page, w, h);
    });
  });
}

/**
 * The Progress tab on a phone held sideways (ADR-0059, stage 7): after a real level up the menu
 * button wears the points, the tab's columns sit side by side on the screen, and every button in
 * it is a 44 px target that spends by tap. The pad and the HUD stay clear while the menu is open.
 */
for (const [w, h] of [
  [844, 390],
  [800, 370],
] as const) {
  test.describe(`phone ${w}x${h} progress`, () => {
    test.use({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });

    test(`phone: the Progress tab fits and spends by tap at ${w}x${h}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto("/?seed=7&models=off&audio=off&touch");
      await waitForGame(page);
      await newGame(page, "tap");
      await waitForPlay(page);
      await freeze(page);
      await teleport(page, 321.4, -80);
      await step(page, 1);
      // The fixer met, the courier down and the pay collected: three levels, six points.
      await page.evaluate(() => {
        for (const flag of ["met_fixer", "killed:hebi_courier", "reported_back"]) window.__seki!.session.sim.enqueue({ type: "set-flag", flag } as never);
      });
      await step(page, 2);
      await expect(page.getByTestId("touch-character-points")).toHaveText("6");
      // The HUD with the XP row and the badge: nothing overlaps.
      await check(page, w, h);
      // With points to spend the menu button opens straight on Progress (decision of 6.11).
      await page.getByRole("button", { name: "Character" }).tap();
      await expect(page.getByTestId("progress-tab")).toBeVisible();
      await expect(page.getByTestId("touch-controls")).toBeHidden();
      for (const tab of await page.getByRole("tab").all()) {
        const b = (await tab.boundingBox())!;
        expect(b.x >= -0.5 && b.x + b.width <= w + 0.5 && b.height >= 43.5, `tab ${await tab.textContent()} on screen`).toBe(true);
      }
      const left = (await page.locator(".progress__left").boundingBox())!;
      const tree = (await page.locator(".progress__tree").boundingBox())!;
      for (const b of [left, tree]) expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5, "column on screen").toBe(true);
      expect(overlap({ name: "left", ...left }, { name: "tree", ...tree })).toBe(false);
      // Every button of the tab is a touch target, inside the screen once scrolled to.
      const buttons = page.getByTestId("progress-tab").getByRole("button");
      expect(await buttons.count()).toBeGreaterThan(5);
      for (const button of await buttons.all()) {
        await button.scrollIntoViewIfNeeded();
        const b = (await button.boundingBox())!;
        const name = (await button.getAttribute("aria-label")) ?? "";
        expect(Math.min(b.width, b.height), `${name} at least 44 px`).toBeGreaterThanOrEqual(43.5);
        expect(b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= w + 0.5 && b.y + b.height <= h + 0.5, `${name} on screen`).toBe(true);
      }
      // A point into Might opens its first tier; a rank bought by tap.
      await page.getByRole("button", { name: "Raise Might" }).tap();
      await page.getByTestId("attribute-tree-might").tap();
      const buy = page.getByRole("button", { name: "Buy Thick Skin" });
      await buy.scrollIntoViewIfNeeded();
      await buy.tap();
      await expect(page.getByTestId("perk-might_tough")).toContainText("Rank 1/3");
      await expect(page.getByTestId("progress-tab-points")).toHaveText("4");
      // Polish counts the points in its plural forms: 2 attribute points left, then 1.
      await page.evaluate(() => window.__seki!.session.intents.changeSettings({ locale: "pl" }));
      await expect(page.getByTestId("attribute-points")).toHaveText("2 punkty atrybutów do rozdania");
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `touch-progress-${w}x${h}.png`) });
    });
  });
}

test.describe("phone 844x390 settings", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

test("phone: the settings in the pause menu scroll to their last control", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page, "tap");
  await expect(page.getByTestId("hud")).toBeVisible();
  await page.evaluate(() => window.__seki!.session.pause());
  await expect(page.getByTestId("pause-menu")).toBeVisible();
  await page.getByTestId("pause-menu").getByRole("button", { name: "Settings" }).tap();
  await page.getByRole("tab", { name: "Accessibility" }).tap({ timeout: 10_000 });
  // The menu is taller than a phone held sideways: its top and its bottom must both be reachable.
  const menu = page.getByTestId("pause-menu");
  const top = page.getByRole("tab", { name: "General" });
  const last = page.getByTestId("token-legend");
  await last.scrollIntoViewIfNeeded();
  const box = await last.boundingBox();
  expect(box && box.y + box.height <= 390 + 1).toBe(true);
  await top.scrollIntoViewIfNeeded();
  const head = await top.boundingBox();
  expect(head && head.y >= -1).toBe(true);
  expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

  // The touch tab (ADR-0072): all five tabs and both fire button choices inside the screen.
  await page.getByRole("tab", { name: "Touch & Gamepad" }).tap();
  for (const tab of await page.getByRole("tab").all()) {
    const b = (await tab.boundingBox())!;
    expect(b.x >= -1 && b.x + b.width <= 844 + 1).toBe(true);
  }
  const fire = page.getByRole("radiogroup", { name: "Fire button" });
  for (const name of ["Aims and fires", "Fires only"]) {
    const option = fire.getByRole("radio", { name });
    await option.scrollIntoViewIfNeeded();
    const b = (await option.boundingBox())!;
    expect(b.x >= -1 && b.x + b.width <= 844 + 1).toBe(true);
  }
  await fire.getByRole("radio", { name: "Fires only" }).tap();
  await expect(page.getByRole("radiogroup", { name: "Aim button" }).getByRole("radio", { name: "Toggle" })).toHaveAttribute("aria-checked", "true");
  // The gamepad's own look (ADR-0072, stage 4): both sliders and all three curves on the screen.
  const inside = async (el: Locator) => {
    await el.scrollIntoViewIfNeeded();
    const b = (await el.boundingBox())!;
    expect(b.x >= -1 && b.x + b.width <= 844 + 1 && b.y >= -1 && b.y + b.height <= 390 + 1).toBe(true);
  };
  await inside(page.getByRole("slider", { name: /^Gamepad sensitivity/ }));
  await inside(page.getByRole("slider", { name: /^Stick dead zone/ }));
  const curve = page.getByRole("radiogroup", { name: "Response curve" });
  for (const name of ["Linear", "Classic", "Precise"]) await inside(curve.getByRole("radio", { name }));
  await curve.getByRole("radio", { name: "Linear" }).tap();
  await expect(curve.getByRole("radio", { name: "Linear" })).toHaveAttribute("aria-checked", "true");
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, "touch-settings-tab.png") });
});
});

/**
 * The metro kiosk on a phone held sideways (ADR-0071): the line map, then the list of stops under
 * it; a tap chooses the destination and brings its card into view, and the ticket button stays a
 * 44 px target inside the screen. Whatever is scrolled, nothing of the panel's content shows under
 * or below its buttons.
 */
/** Points under the kiosk's buttons and below them to the panel's edge that show its scrolled content, at the top, the middle and the end of the scroll. */
const contentUnderButtons = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-testid=metro-map]")!;
    const actions = document.querySelector<HTMLElement>("[data-testid=metro-actions]") ?? panel.querySelector<HTMLElement>(".metro__actions")!;
    const scrollers = [panel, ...panel.querySelectorAll<HTMLElement>("*")].filter((el) => el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY !== "visible");
    const hits: string[] = [];
    for (const at of [0, 0.5, 1]) {
      for (const el of scrollers) el.scrollTop = (el.scrollHeight - el.clientHeight) * at;
      const a = actions.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      for (let y = a.top + 1; y < p.bottom - 0.5; y += 3) {
        for (let i = 1; i < 12; i++) {
          const x = p.left + (p.width * i) / 12;
          const hit = document.elementFromPoint(x, y);
          if (hit && hit !== panel && panel.contains(hit) && !actions.contains(hit)) hits.push(`${at}: ${hit.className || hit.tagName} at ${x.toFixed(0)},${y.toFixed(0)}`);
        }
      }
    }
    return hits;
  });

test.describe("phone 800x370 metro kiosk", () => {
  test.use({ viewport: { width: 800, height: 370 }, isMobile: true, hasTouch: true });

  test("phone: the kiosk's map, list, card and ticket fit and take taps", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/?seed=7&models=off&audio=off&touch");
    await waitForGame(page);
    await newGame(page, "tap");
    await waitForPlay(page);
    await freeze(page);
    await page.evaluate(() => window.__seki!.metro("kanal"));
    const kiosk = page.getByTestId("metro-map");
    await expect(kiosk).toBeVisible();
    const chart = (await page.getByTestId("metro-chart").boundingBox())!;
    const list = (await page.getByTestId("metro-stop-targ").boundingBox())!;
    // On a phone the list goes under the map.
    expect(list.y).toBeGreaterThanOrEqual(chart.y + chart.height - 0.5);
    await page.getByRole("button", { name: /Destination: Plac Zamkowy/ }).tap();
    await expect(page.getByTestId("metro-preview")).toBeVisible();
    // The card comes into view by itself: its top is on screen above the buttons.
    const card = (await page.getByTestId("metro-preview").boundingBox())!;
    const bar = (await page.getByTestId("metro-actions").boundingBox())!;
    expect(card.y >= 0 && card.y < bar.y, "card in view").toBe(true);
    expect(await contentUnderButtons(page)).toEqual([]);
    const buy = page.getByTestId("metro-buy");
    await buy.scrollIntoViewIfNeeded();
    const b = (await buy.boundingBox())!;
    expect(b.height).toBeGreaterThanOrEqual(43.5);
    expect(b.x >= 0 && b.y >= 0 && b.x + b.width <= 800.5 && b.y + b.height <= 370.5, "ticket on screen").toBe(true);
    const panel = (await kiosk.boundingBox())!;
    expect(panel.x >= 0 && panel.x + panel.width <= 800.5).toBe(true);
    await expect(buy).toBeEnabled();
  });
});

test.describe("desktop 1280x720 metro kiosk", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("desktop: the kiosk's content never shows under its buttons", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/?seed=7&models=off&audio=off");
    await waitForGame(page);
    await newGame(page);
    await waitForPlay(page);
    await freeze(page);
    await page.evaluate(() => window.__seki!.metro("kanal"));
    await page.getByRole("button", { name: /Destination: Plac Zamkowy/ }).click();
    await expect(page.getByTestId("metro-preview")).toBeVisible();
    expect(await contentUnderButtons(page)).toEqual([]);
    const panel = (await page.getByTestId("metro-map").boundingBox())!;
    expect(panel.y >= 0 && panel.y + panel.height <= 720.5, "panel on screen").toBe(true);
  });
});

/**
 * The map credit (ODbL) stays legible and over nothing: on the title's screens taller than a
 * phone held sideways (the new game's Custom sliders, Settings) it ends the content instead of
 * riding over the buttons when the screen scrolls.
 */
test.describe("phone 800x370 title credit", () => {
  test.use({ viewport: { width: 800, height: 370 }, isMobile: true, hasTouch: true });

  test("phone: the map credit covers no control of the title's screens, scrolled to the bottom", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/?seed=7&models=off&touch");
    await waitForGame(page);
    const credit = page.getByTestId("title-attribution");
    const title = page.getByTestId("title-screen");
    const clear = async (view: string) => {
      await title.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      const c = await credit.boundingBox();
      expect(c, `${view}: credit shown`).not.toBeNull();
      expect(c!.y >= -0.5 && c!.y + c!.height <= 370 + 0.5, `${view}: credit on screen`).toBe(true);
      const controls = title.locator("button, input");
      for (let i = 0; i < (await controls.count()); i++) {
        const el = controls.nth(i);
        const b = await el.boundingBox();
        if (!b || b.width === 0) continue;
        const name = (await el.getAttribute("aria-label")) ?? (await el.textContent())?.trim() ?? `#${i}`;
        expect(overlap({ name: "credit", ...c! }, { name, ...b }), `${view}: credit over "${name}"`).toBe(false);
      }
    };
    await page.getByRole("button", { name: "New Game", exact: true }).tap();
    await page.getByRole("radio", { name: "Custom" }).tap();
    await clear("custom");
    await page.getByRole("button", { name: "Back", exact: true }).tap();
    await page.getByRole("button", { name: "Settings", exact: true }).tap();
    await page.getByRole("tab", { name: "Accessibility" }).tap();
    await clear("settings");
  });
});
