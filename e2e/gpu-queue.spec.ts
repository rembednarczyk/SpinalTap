import { expect, test } from "@playwright/test";
import { freeze, step, waitForGame, waitForPlay } from "./helpers";

/**
 * Frames the game may draw while the GPU works off what it was handed before (G-029): the two
 * frames the pacer lets ahead, and one more it may draw in the animation frame the wait ends in.
 */
const MOST_AHEAD = 3;
/** Waits measured: each one is the GPU working off the whole queue in front of a fence. */
const WAITS = 3;

test("the title screen draws no further ahead of the GPU than the pacer allows (G-029)", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/?seed=11");
  await waitForGame(page);
  // A fence after everything handed to the GPU so far; the frames drawn before it is done are
  // the queue the game builds in front of a readback. Under SwiftShader the title's frames took
  // longer on the GPU than on the page, the queue grew to 12 s and a click on the menu hung.
  const ahead = await page.evaluate(async (waits) => {
    const gl = (document.getElementById("game-canvas") as HTMLCanvasElement).getContext("webgl2")!;
    const frames = () => window.__seki!.frames!();
    const nextFrame = () => new Promise((done) => requestAnimationFrame(done));
    const out: number[] = [];
    for (let i = 0; i < waits; i++) {
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
      const from = frames();
      while (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) await nextFrame();
      gl.deleteSync(fence);
      out.push(frames() - from);
    }
    return out;
  }, WAITS);
  test.info().annotations.push({ type: "gpu-queue", description: `frames drawn while the GPU caught up: ${ahead.join(", ")}` });
  expect(Math.max(...ahead)).toBeLessThanOrEqual(MOST_AHEAD);
});

test("the character menu's preview draws no further ahead of the GPU than the pacer allows (G-031)", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/?seed=7&models=off");
  await waitForGame(page);
  await page.getByRole("button", { name: "New Game" }).click();
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1);
  await page.keyboard.press("KeyI");
  await expect(page.getByTestId("character-screen")).toBeVisible();
  // The preview redraws every frame on medium and high: unpaced, it drew 22-24 frames while the
  // GPU worked off the 2-3 s queue in front of each fence (load 12-19).
  const ahead = await page.evaluate(async (waits) => {
    const gl = (document.getElementById("game-canvas") as HTMLCanvasElement).getContext("webgl2")!;
    const renders = () => window.__seki!.preview()!.renders;
    const nextFrame = () => new Promise((done) => requestAnimationFrame(done));
    const out: number[] = [];
    for (let i = 0; i < waits; i++) {
      const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)!;
      const from = renders();
      while (gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED) await nextFrame();
      gl.deleteSync(fence);
      out.push(renders() - from);
    }
    return out;
  }, WAITS);
  test.info().annotations.push({ type: "gpu-queue", description: `preview frames drawn while the GPU caught up: ${ahead.join(", ")}` });
  expect(Math.max(...ahead)).toBeLessThanOrEqual(MOST_AHEAD);
});

test("the game draws again after the WebGL context is lost and restored (G-029)", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/?seed=11");
  await waitForGame(page);
  await page.evaluate(() => {
    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    const lose = canvas.getContext("webgl2")!.getExtension("WEBGL_lose_context")!;
    (window as unknown as { __restored: boolean }).__restored = false;
    canvas.addEventListener("webglcontextrestored", () => ((window as unknown as { __restored: boolean }).__restored = true), { once: true });
    // Restored a moment after the loss, as a browser does after a GPU reset.
    canvas.addEventListener("webglcontextlost", () => setTimeout(() => lose.restoreContext(), 1000), { once: true });
    lose.loseContext();
  });
  await page.waitForFunction(() => (window as unknown as { __restored: boolean }).__restored, null, { timeout: 60_000 });
  // Fences made before the loss never signal: a pacer that kept them held every frame after it.
  const drawn = await page.evaluate(() => window.__seki!.frames!());
  await page.waitForFunction((n) => window.__seki!.frames!() >= n + 3, drawn, { timeout: 60_000 });
});
