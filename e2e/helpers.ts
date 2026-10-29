import type { Page } from "@playwright/test";

export const waitForGame = async (page: Page) => {
  await page.waitForFunction(() => window.__seki?.ready === true, null, { timeout: 60_000 });
};

export const gameState = (page: Page) => page.evaluate(() => window.__seki!.state());

export const perf = (page: Page) => page.evaluate(() => window.__seki!.perf());

/** Freezes the real-time loop and advances the simulation deterministically from the test. */
export const step = (page: Page, n: number, input: Record<string, unknown> = {}) =>
  page.evaluate(([count, frame]) => window.__seki!.step(count as number, frame as Record<string, unknown>), [n, input] as const);

/** Moves the player to (x, z), on Lublin's ground there unless `y` gives the floor (a deck, a roof). */
export const teleport = (page: Page, x: number, z: number, yaw = 0, pitch = 0, y?: number) =>
  page.evaluate(([a, b, c, d, e]) => window.__seki!.teleport(a, b, c, d, e ?? undefined), [x, z, yaw, pitch, y ?? null] as const);

/** A set piece's frame (ADR-0045): the market and the docks are moved, the clinic and Neon Koi turned. */
export type Frame = "market" | "docks" | "clinic" | "koi";

/** A point of a set piece in its own coordinates, in the world. */
export const place = (page: Page, frame: Frame, x: number, z: number, y = 0) =>
  page.evaluate(([f, a, b, c]) => window.__seki!.place(f as Frame, a as number, b as number, c as number), [frame, x, y, z] as const);

/** Moves the player to a world point, standing on its height. */
export const teleportTo = (page: Page, p: { x: number; y: number; z: number }, yaw = 0, pitch = 0) => teleport(page, p.x, p.z, yaw, pitch, p.y);

/** Sprints along (x, z) waypoints in the page; returns how many it reached. */
export const walk = (page: Page, route: readonly (readonly [number, number])[]) => page.evaluate((r) => window.__seki!.walk(r), route);

export const freeze = (page: Page) => page.evaluate(() => window.__seki!.setPaused(true));
