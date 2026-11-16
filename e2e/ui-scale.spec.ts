import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";
import { HUD_SCALE_RANGE } from "../packages/ui/src/store/hud-vm";
import { uiScale } from "../packages/ui/src/scale/ui-scale";
import { freeze, newGame, place, step, teleport, teleportTo, waitForGame, waitForPlay } from "./helpers";
import { targetFaults } from "./touch-targets";

/**
 * One interface scale for every layer (ADR-0085): at the ends of the HUD scale's range, on a phone
 * held sideways and on a desktop, the pad's buttons, the messages, the weapon strip, the minimap,
 * the objective card, the wallet, the clock, health and the dialogue wheel stay on screen and
 * apart, each layer draws at the scale `uiScale` gives for that screen, and the pad's buttons,
 * drawn smaller and pulled toward their corners under 1, keep apart targets 44 px wide. Every size runs in one
 * page, resized in turn (ADR-0046). `SHOTS=<dir>` keeps a picture of each case.
 */
const [MIN, MAX] = HUD_SCALE_RANGE;

interface Box {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const KEY_PIECES = [
  "[data-testid=touch-controls] button",
  "[data-testid=minimap]",
  "[data-testid=eddies]",
  "[data-testid=clock]",
  "[data-testid=objective]",
  "[data-testid=identity]",
  "[data-testid=weapon-strip]",
  ".toast",
  ".wheel__opt",
  ".subs",
].join(", ");

/** The key pieces on screen now: laid out, not hidden, with a name to report. */
const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate((sel) => {
    const out: Box[] = [];
    document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width <= 0 || r.height <= 0 || st.visibility === "hidden" || st.display === "none") return;
      const name = el.getAttribute("aria-label") ?? el.dataset.testid ?? `${el.className.split(" ")[0]}#${i}`;
      out.push({ name, x: r.x, y: r.y, width: r.width, height: r.height });
    });
    return out;
  }, KEY_PIECES);

const overlap = (a: Box, b: Box) => a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;

/** The scale each layer draws at, from its transform. */
const layerScales = (page: Page) =>
  page.evaluate(() => {
    const scale = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? new DOMMatrixReadOnly(getComputedStyle(el).transform).a : null;
    };
    return { hud: scale(".hud"), touch: scale(".touch"), dialogue: scale(".dialogue") };
  });

/**
 * How far the fire button's centre and the menu button's are from their corners of the screen:
 * under 1 the pad pulls toward its corners (ADR-0085, decision of 15.11: "Pad bliżej rogu").
 */
const cornerGaps = (page: Page, w: number) =>
  page.evaluate((w) => {
    const centre = (id: string) => {
      const r = document.querySelector(`[data-testid=${id}]`)!.getBoundingClientRect();
      return [r.x + r.width / 2, r.y + r.height / 2] as const;
    };
    const [fx, fy] = centre("touch-fire");
    const [mx, my] = centre("touch-character");
    return { fire: Math.hypot(w - fx, window.innerHeight - fy), menu: Math.hypot(w - mx, my) };
  }, w);

/** The fire button's drawn width. */
const fireWidth = async (page: Page) => (await page.getByTestId("touch-fire").boundingBox())!.width;

const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));

/** Sets the HUD scale and returns what is wrong at `w`x`h`: pieces off screen, pieces over each other. */
const faults = async (page: Page, w: number, h: number, scale: number, label: string): Promise<string[]> => {
  await page.evaluate((v) => window.__seki!.session.intents.changeSettings({ hudScale: v }), scale);
  await step(page, 1);
  await settle(page);
  const all = await boxes(page);
  if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `ui-scale-${label}-${w}x${h}-${scale}.png`) });
  const at = `${label} ${w}x${h} @${scale}`;
  const out: string[] = [];
  for (const b of all) if (b.x < -0.5 || b.y < -0.5 || b.x + b.width > w + 0.5 || b.y + b.height > h + 0.5) out.push(`${at}: ${b.name} off screen`);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (overlap(all[i]!, all[j]!)) out.push(`${at}: ${all[i]!.name} × ${all[j]!.name}`);
  return out;
};

/** The game started, frozen on the deptak, with the "Use" button and the arrival card up. */
const start = async (page: Page, touch: boolean) => {
  // The arrival card's own 4.5 s could run out on a loaded machine before it is measured.
  await page.addInitScript(() => {
    const real = window.setTimeout;
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => (ms === 4500 ? 0 : real(fn, ms, ...args))) as typeof window.setTimeout;
  });
  // `SHOT_MODELS=on` takes the pictures with the character models, as the player sees the game.
  await page.goto(`/?seed=7&audio=off${process.env.SHOT_MODELS === "on" ? "" : "&models=off"}${touch ? "&touch" : ""}`);
  await waitForGame(page);
  await newGame(page, touch ? "tap" : "click");
  await waitForPlay(page);
  await freeze(page);
  await teleport(page, 321.4, -80);
  await page.evaluate(() => {
    window.__seki!.session.intents.changeSettings({ hudAlwaysShow: true });
    window.__seki!.emit("InteractionFocusChanged", { targetId: 1, prompt: "Porozmawiaj z Kaito" });
  });
  await step(page, 2);
  await expect(page.locator(".toast", { hasText: "Krakowskie Przedmieście" })).toBeVisible();
};

/** A talk with Kaito: the pad goes away, the wheel and the subtitles come up. */
const openTalk = async (page: Page) => {
  await page.evaluate(() => window.__seki!.session.intents.changeSettings({ hudScale: 1 }));
  await teleportTo(page, await place(page, "koi", 11.25, 3.5), Math.PI);
  await step(page, 1);
  await step(page, 1, { interact: true });
  await expect(page.locator(".wheel__opt").first()).toBeVisible();
};

const run = async (page: Page, sizes: readonly (readonly [number, number])[], touch: boolean, label: string) => {
  test.setTimeout(300_000);
  await start(page, touch);
  const found: string[] = [];
  const scales: string[] = [];
  const check = async (layers: readonly ("hud" | "touch" | "dialogue")[], tag: string) => {
    for (const [w, h] of sizes) {
      await page.setViewportSize({ width: w, height: h });
      let fireAtOne = 0;
      let gapsAtOne = { fire: 0, menu: 0 };
      if (layers.includes("touch")) {
        found.push(...(await faults(page, w, h, 1, `${label}-${tag}`)));
        found.push(...(await targetFaults(page, `${label} ${w}x${h} @1`)));
        fireAtOne = await fireWidth(page);
        gapsAtOne = await cornerGaps(page, w);
      }
      for (const s of [MIN, MAX]) {
        found.push(...(await faults(page, w, h, s, `${label}-${tag}`)));
        if (layers.includes("touch")) {
          const at = `${label} ${w}x${h} @${s}`;
          found.push(...(await targetFaults(page, at)));
          // Under 1 the pad is drawn as small as the rest, the fire button visibly narrower, and
          // pulled toward its corners: the fire button and the menu button closer to theirs.
          if (s < 1 && !((await fireWidth(page)) < fireAtOne - 1)) found.push(`${at}: fire button not drawn smaller`);
          const gaps = await cornerGaps(page, w);
          if (s < 1 && !(gaps.fire < gapsAtOne.fire - 2)) found.push(`${at}: fire button ${gaps.fire.toFixed(1)} px from its corner, at 1 ${gapsAtOne.fire.toFixed(1)}`);
          if (s < 1 && !(gaps.menu < gapsAtOne.menu - 2)) found.push(`${at}: menu button ${gaps.menu.toFixed(1)} px from its corner, at 1 ${gapsAtOne.menu.toFixed(1)}`);
        }
        const want = uiScale(s, { width: w, height: h }, undefined, touch);
        const got = await layerScales(page);
        for (const layer of layers) {
          const expected = layer === "touch" ? want.touch : want.ui;
          if (Math.abs((got[layer] ?? 0) - expected) > 0.001) scales.push(`${label} ${w}x${h} @${s}: ${layer} at ${got[layer]}, not ${expected}`);
        }
      }
    }
  };
  await check(touch ? ["hud", "touch"] : ["hud"], "play");
  await openTalk(page);
  await check(["dialogue"], "talk");
  expect(scales).toEqual([]);
  expect(found).toEqual([]);
};

/**
 * What the contract card must leave clear (ADR-0085): the top band, the bottom band, the stick and
 * the pad. The first run's move hint in the middle is not among them: it is a passing line.
 */
const UNDER_CARD = [
  "[data-testid=objective]",
  "[data-testid=eddies]",
  "[data-testid=clock]",
  ".toast",
  "[data-testid=minimap]",
  "[data-testid=identity]",
  "[data-testid=weapon-strip]",
  ".touch__stick-hint",
  "[data-testid=touch-controls] button",
].join(", ");

/**
 * The end-of-contract card (G-846) at its longest, every badge earned and a variation with a twist,
 * in English and Polish at the ends `scales` of the HUD scale: on screen, its close button on screen,
 * and over none of the top band, the bottom band and the pad.
 */
const debriefFaults = async (page: Page, sizes: readonly (readonly [number, number])[], scales: readonly number[], label: string): Promise<string[]> => {
  // The card's own 15 s could run out on a loaded machine before it is measured: it stays up here.
  await page.addInitScript(() => {
    const real = window.setTimeout;
    window.setTimeout = ((fn: TimerHandler, ms?: number, ...args: unknown[]) => (ms === 15_000 ? 0 : real(fn, ms, ...args))) as typeof window.setTimeout;
  });
  await start(page, label === "phone");
  const out: string[] = [];
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    for (const locale of ["en", "pl"] as const) {
      await page.evaluate((l) => {
        const seki = window.__seki!;
        seki.session.intents.changeSettings({ locale: l });
        seki.emit("ContractCompleted", { contract: { id: "g846", kind: "infiltrate", siteId: "car_wash", targets: 2, reward: 1200, status: "cleared" }, reward: 1200 } as never);
        seki.emit("ContractDebrief", {
          contractId: "g846",
          badges: ["ghost", "no_alarm", "clean", "untouched", "swift", "netrunner"],
          rank: "S",
          reward: 12000,
          bonus: 3000,
          styleBonus: 1500,
          seconds: 3254,
          variation: { modifiers: ["night_only", "time_limit", "bodyguards"], security: "lockdown", trait: "creature_of_habit", twist: "setup" },
        });
      }, locale);
      for (const s of scales) {
        await page.evaluate((v) => window.__seki!.session.intents.changeSettings({ hudScale: v }), s);
        await step(page, 1);
        await settle(page);
        const at = `${label} ${w}x${h} ${locale} @${s}`;
        if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `ui-scale-debrief-${label}-${w}x${h}-${locale}-${s}.png`) });
        const card = page.getByTestId("debrief");
        await expect(card, at).toBeVisible();
        const box = { name: "debrief", ...(await card.boundingBox())! };
        const close = (await page.locator(".debrief__close").boundingBox())!;
        if (box.x < -0.5 || box.y < -0.5 || box.x + box.width > w + 0.5 || box.y + box.height > h + 0.5) out.push(`${at}: card off screen`);
        if (close.y < box.y - 0.5 || close.y + close.height > Math.min(h, box.y + box.height) + 0.5) out.push(`${at}: close button out of sight`);
        const under = await page.evaluate((sel) => {
          const found: Box[] = [];
          document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
            const r = el.getBoundingClientRect();
            const st = getComputedStyle(el);
            if (r.width <= 0 || r.height <= 0 || st.visibility === "hidden" || st.display === "none") return;
            found.push({ name: el.getAttribute("aria-label") ?? el.dataset.testid ?? `${el.className.split(" ")[0]}#${i}`, x: r.x, y: r.y, width: r.width, height: r.height });
          });
          return found;
        }, UNDER_CARD);
        for (const b of under) if (overlap(box, b)) out.push(`${at}: card × ${b.name}`);
      }
    }
  }
  return out;
};

test.describe("phone", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test("phone: every layer scales alike and nothing overlaps at both ends of the HUD scale", async ({ page }) => {
    await run(
      page,
      [
        [844, 390],
        [667, 375],
      ],
      true,
      "phone",
    );
    // Held upright, the rotate hint covers the whole screen at either end.
    await page.setViewportSize({ width: 390, height: 844 });
    for (const s of [MIN, MAX]) {
      await page.evaluate((v) => window.__seki!.session.intents.changeSettings({ hudScale: v }), s);
      await settle(page);
      if (process.env.SHOTS) await page.screenshot({ path: join(process.env.SHOTS, `ui-scale-phone-upright-390x844-${s}.png`) });
      const hint = (await page.locator(".rotate-hint").boundingBox())!;
      expect(hint, `rotate hint at ${s}`).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    }
  });

  test("phone: the contract card covers nothing at 844x390, 800x370 and 667x375 in en and pl", async ({ page }) => {
    test.setTimeout(300_000);
    const sizes = [
      [844, 390],
      [800, 370],
      [667, 375],
    ] as const;
    expect(await debriefFaults(page, sizes, [MIN, 1], "phone")).toEqual([]);
  });
});

test.describe("desktop", () => {
  test("desktop: every layer scales alike and nothing overlaps at both ends of the HUD scale", async ({ page }) => {
    await run(
      page,
      [
        [1280, 720],
        [1920, 1080],
      ],
      false,
      "desktop",
    );
  });

  test("desktop: the contract card covers nothing at 1280x720 and 1024x600 in en and pl", async ({ page }) => {
    test.setTimeout(300_000);
    const sizes = [
      [1280, 720],
      [1024, 600],
    ] as const;
    expect(await debriefFaults(page, sizes, [MIN, 1], "desktop")).toEqual([]);
  });
});
