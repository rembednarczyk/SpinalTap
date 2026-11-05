import { type Page, expect, test } from "@playwright/test";
import { arcLayout } from "../packages/ui/src/dialogue/wheel-layout";
import { type Step, allSteps } from "./dialogue-steps";
import { freeze, place, step, teleportTo, newGame, waitForGame, waitForPlay } from "./helpers";

/**
 * Every step of every conversation in both languages fits the subtitle box without scrolling
 * (G-283), next to a full wheel of six options and never under it. Each step's lines go into
 * the box of a real conversation; a step that still overflows must show that it goes on below.
 * Nothing of the HUD shows under the box, neither with the opening lines nor grown to full height.
 */

/**
 * Steps longer than this (characters) may scroll on a phone, with the arrow: the two act endings
 * (`m3-echo` `ending_seki`, `m3-lustro` `finale`) with every condition met, read once a game.
 */
const LONG_STEP = 550;
const WHEEL = 6;

const STEPS = { en: allSteps("en"), pl: allSteps("pl") };
const chars = (s: Step) => s.lines.reduce((n, l) => n + l.text.length, 0);

interface Fit {
  readonly at: string;
  readonly chars: number;
  readonly over: number;
  readonly more: boolean;
}

const openTalk = async (page: Page) => {
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await teleportTo(page, await place(page, "koi", 11.25, 3.5), Math.PI);
  await step(page, 1);
  await step(page, 1, { interact: true });
  await expect(page.getByTestId("dialogue")).toContainText("walking corpse");
  // The worst case beside the box: a wheel of six options, cloned from the real one.
  await page.evaluate((points) => {
    const wheel = document.querySelector<HTMLElement>(".wheel");
    const first = wheel?.querySelector<HTMLElement>(".wheel__opt");
    if (!wheel || !first) throw new Error("no wheel");
    for (const b of wheel.querySelectorAll(".wheel__opt")) b.remove();
    for (const p of points) {
      const b = first.cloneNode(true) as HTMLElement;
      b.style.setProperty("--x", p.x.toFixed(3));
      b.style.setProperty("--y", p.y.toFixed(3));
      b.classList.remove("wheel__opt--hot");
      wheel.append(b);
    }
    for (const el of [wheel, document.querySelector<HTMLElement>(".dialogue")]) el?.style.setProperty("--n", String(points.length));
  }, arcLayout(WHEEL));
};

/**
 * Puts each step into the box in turn and measures it. Reading the size forces the layout, so the
 * overflow needs no frame; only the arrow, which React shows after the scroll event, waits two
 * frames. Under SwiftShader a frame of the game costs ~0.1-0.2 s (more on a phone at DPR 2), so
 * waiting on all 532 steps took minutes: with `sign` off a step costs a layout pass only.
 */
const measure = (page: Page, steps: readonly Step[], sign = true) =>
  page.evaluate(async ({ all, sign }) => {
    const box = document.querySelector<HTMLElement>("[data-dialogue-log]");
    if (!box) throw new Error("no subtitles");
    for (const own of box.querySelectorAll<HTMLElement>(".subs__line")) own.style.display = "none";
    const options = [...document.querySelectorAll(".wheel__opt")].map((b) => b.getBoundingClientRect());
    const out: { at: string; over: number; more: boolean; covers: boolean }[] = [];
    for (const s of all) {
      for (const p of box.querySelectorAll("[data-probe]")) p.remove();
      for (const l of s.lines) {
        const p = document.createElement("p");
        p.dataset.probe = "";
        p.className = l.speaker ? "subs__line" : "subs__line subs__line--narration";
        if (l.speaker) {
          const who = document.createElement("span");
          who.className = "subs__speaker";
          who.textContent = l.speaker;
          p.append(who);
        }
        p.append(l.text);
        box.append(p);
      }
      box.scrollTop = 0;
      if (sign) {
        box.dispatchEvent(new Event("scroll"));
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
      }
      const r = box.getBoundingClientRect();
      const more = document.querySelector(".subs__more");
      out.push({
        at: s.at,
        over: box.scrollHeight - box.clientHeight,
        more: sign && more !== null && getComputedStyle(more).visibility !== "hidden" && getComputedStyle(more).display !== "none",
        covers: options.some((o) => o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top),
      });
    }
    return out;
  }, { all: steps, sign });

/**
 * Rectangles of the visible HUD pieces and wheel options that cross the subtitle box. A piece is
 * visible when it is laid out, not hidden and not faded out by itself or an ancestor.
 */
const overlaps = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector<HTMLElement>(".subs");
    if (!box) throw new Error("no subtitles");
    const r = box.getBoundingClientRect();
    const shown = (el: Element) => {
      if (el.getClientRects().length === 0 || getComputedStyle(el).visibility === "hidden") return false;
      let alpha = 1;
      for (let e: Element | null = el; e; e = e.parentElement) alpha *= Number(getComputedStyle(e).opacity);
      return alpha > 0.01;
    };
    const pieces = [...document.querySelectorAll(".hud > :not(.gear), .hud .gear > *, .wheel__opt")];
    return pieces
      .filter((el) => {
        const o = el.getBoundingClientRect();
        return o.width > 0 && o.height > 0 && shown(el) && o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top;
      })
      .map((el) => el.className.toString().split(" ")[0] ?? el.tagName);
  });

const check = async (page: Page, view: string) => {
  test.setTimeout(240_000);
  await openTalk(page);
  expect(await overlaps(page), "HUD under the opening lines").toEqual([]);
  for (const locale of ["en", "pl"] as const) {
    const steps = STEPS[locale];
    const fits = await measure(page, steps, false);
    const over: Fit[] = fits.flatMap((f, i) => (f.over > 1 ? [{ ...f, chars: chars(steps[i] ?? { at: "", lines: [] }) }] : []));
    // The arrow on every step that scrolls, and off on the one that fits with the least room
    // left: the arrow compares the same heights, so a step with more room cannot show it either.
    const tightest = fits.reduce((t, f, i) => (f.over <= 1 && f.over > (fits[t]?.over ?? -Infinity) ? i : t), -1);
    const signs = await measure(page, steps.filter((_, i) => i === tightest || (fits[i]?.over ?? 0) > 1));
    const summary = `${over.length} of ${steps.length} steps scroll: ${over.map((f) => `${f.at} (${f.chars} chars, +${f.over} px)`).join(", ")}`;
    test.info().annotations.push({ type: `${view} ${locale}`, description: summary });
    console.log(`${view} ${locale}: ${summary}`);
    expect.soft(fits.filter((f) => f.covers).map((f) => f.at), "box under the wheel").toEqual([]);
    expect.soft(over.filter((f) => f.chars <= LONG_STEP).map((f) => f.at), "usual steps that scroll").toEqual([]);
    expect.soft(signs.filter((f) => f.over > 1 && !f.more).map((f) => f.at), "overflow without a sign").toEqual([]);
    expect.soft(signs.filter((f) => f.over <= 1 && f.more).map((f) => f.at), "a sign without overflow").toEqual([]);
    expect(signs.length, "steps checked for the arrow").toBe(over.length + 1);
  }
  // Longer than any step (and than the box): the arrow says the text goes on below.
  const longest = STEPS.pl.reduce((a, b) => (chars(b) > chars(a) ? b : a));
  const [tooLong] = await measure(page, [{ at: "three finales", lines: [...longest.lines, ...longest.lines, ...longest.lines] }]);
  expect(tooLong?.over).toBeGreaterThan(1);
  expect(tooLong?.more, "overflow without a sign").toBe(true);
  expect(await overlaps(page), "HUD under a full box").toEqual([]);
};

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 720 } });
  test("dialogue steps fit the subtitles, clear of the HUD, on a desktop", async ({ page }) => check(page, "desktop"));
});

test.describe("phone", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  test("dialogue steps fit the subtitles, clear of the HUD, on a phone", async ({ page }) => check(page, "phone"));
});
