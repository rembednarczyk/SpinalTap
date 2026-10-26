import type { Page } from "@playwright/test";

export const waitForGame = async (page: Page) => {
  await page.waitForFunction(() => window.__seki?.ready === true, null, { timeout: 60_000 });
};

export const gameState = (page: Page) => page.evaluate(() => window.__seki!.state());

export const perf = (page: Page) => page.evaluate(() => window.__seki!.perf());

/** Freezes the real-time loop and advances the simulation deterministically from the test. */
export const step = (page: Page, n: number, input: Record<string, unknown> = {}) =>
  page.evaluate(([count, frame]) => window.__seki!.step(count as number, frame as Record<string, unknown>), [n, input] as const);

export const teleport = (page: Page, x: number, z: number, yaw = 0, pitch = 0) =>
  page.evaluate(([a, b, c, d]) => window.__seki!.teleport(a, b, c, d), [x, z, yaw, pitch] as const);

export const freeze = (page: Page) => page.evaluate(() => window.__seki!.setPaused(true));
