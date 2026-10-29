import { expect, test } from "@playwright/test";
import { freeze, step, waitForGame } from "./helpers";

test("placeholder VRoid cast dresses the characters", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?seed=11");
  await waitForGame(page);
  await page.getByRole("button", { name: "Nowa gra" }).click({ timeout: 60_000 });
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
  await page.waitForFunction(() => window.__seki!.dressed() > 0, null, { timeout: 90_000 });
  await step(page, 10, { moveZ: 1 });
  const perf = await page.evaluate(() => window.__seki!.perf());
  // A new game wakes in the clinic (ADR-0038) with Kaito, Mori and the Neon Koi cast and the
  // passers-by (ADR-0040) in streaming range: about 490 draw calls once every VRoid is dressed.
  expect(perf.drawCalls).toBeLessThan(520);
  expect(errors).toEqual([]);
});
