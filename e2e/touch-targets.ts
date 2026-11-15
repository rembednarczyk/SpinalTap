import type { Page } from "@playwright/test";

/**
 * The pad's touch targets on screen (ADR-0035, ADR-0085). Under scale 1 a button is drawn smaller
 * than its target: an unseen `::after` margin keeps the target at least `MIN_HIT_PX` wide. These
 * helpers measure the target the browser lays out, not the drawing, and check what a thumb needs.
 */
export interface Target {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Each visible pad button's target: its drawn box grown to its `::after` margin, about its centre. */
export const padTargets = (page: Page): Promise<Target[]> =>
  page.evaluate(() => {
    const out: Target[] = [];
    for (const b of document.querySelectorAll<HTMLElement>("[data-testid=touch-controls] button")) {
      const r = b.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || getComputedStyle(b).visibility === "hidden") continue;
      // The button's own px on screen: layer, corner group and drawing scales together.
      const k = b.offsetWidth > 0 ? r.width / b.offsetWidth : 1;
      const after = getComputedStyle(b, "::after");
      const width = Math.max(r.width, (Number.parseFloat(after.width) || 0) * k);
      const height = Math.max(r.height, (Number.parseFloat(after.height) || 0) * k);
      const name = b.getAttribute("aria-label") ?? b.dataset.testid ?? b.className.split(" ")[1] ?? "button";
      out.push({ name, x: r.x + r.width / 2 - width / 2, y: r.y + r.height / 2 - height / 2, width, height });
    }
    return out;
  });

const apart = (a: Target, b: Target) => a.x >= b.x + b.width - 0.5 || b.x >= a.x + a.width - 0.5 || a.y >= b.y + b.height - 0.5 || b.y >= a.y + a.height - 0.5;

/** A touch 21.5 px left, right, above or below each button's centre that misses that button. */
const misses = (page: Page, at: string): Promise<string[]> =>
  page.evaluate((at) => {
    const out: string[] = [];
    for (const b of document.querySelectorAll<HTMLElement>("[data-testid=touch-controls] button")) {
      const r = b.getBoundingClientRect();
      if (r.width <= 0 || getComputedStyle(b).visibility === "hidden") continue;
      const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2];
      for (const [dx, dy] of [
        [21.5, 0],
        [-21.5, 0],
        [0, 21.5],
        [0, -21.5],
      ] as const) {
        const hit = document.elementFromPoint(cx + dx, cy + dy);
        if (!hit || !b.contains(hit)) out.push(`${at}: ${b.getAttribute("aria-label") ?? b.dataset.testid} misses at ${dx},${dy} (${hit?.className ?? "nothing"})`);
      }
    }
    return out;
  }, at);

/**
 * What is wrong with the pad's targets at `at`: a target under 44 px either way, two targets that
 * share a square, a touch 21.5 px from a button's centre that lands elsewhere.
 */
export const targetFaults = async (page: Page, at: string): Promise<string[]> => {
  const all = await padTargets(page);
  const out: string[] = [];
  for (const t of all) if (Math.min(t.width, t.height) < 43.5) out.push(`${at}: target ${t.name} ${t.width.toFixed(1)}x${t.height.toFixed(1)}`);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (!apart(all[i]!, all[j]!)) out.push(`${at}: targets ${all[i]!.name} × ${all[j]!.name}`);
  out.push(...(await misses(page, at)));
  return out;
};
