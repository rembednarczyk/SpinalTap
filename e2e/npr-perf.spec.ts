import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Page, expect, test } from "@playwright/test";
import { type Frame, freeze, gameState, perf, place, sampleNow, step, teleport, teleportTo, newGame, waitForGame, waitForPlay } from "./helpers";

const budgets = JSON.parse(readFileSync("tools/perf-budgets.json", "utf8")) as {
  scenes: Record<string, { drawCalls: number; activeMeshes: number; activeTriangles?: number }>;
};

/**
 * Keeps a sample in reports/perf.json at once, so a failed test (which restarts the worker)
 * does not lose the others'. Frame time is reported, not checked: under SwiftShader it measures
 * the runner, not the game (ADR-0046).
 */
const record = (scene: string, sample: unknown) => {
  mkdirSync("reports", { recursive: true });
  const file = "reports/perf.json";
  const report = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  writeFileSync(file, JSON.stringify({ ...report, [scene]: sample }, null, 2));
};

test("NPR reference frame matches the approved snapshot", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  // The reference frame stops rendering once Lublin round it is built in detail (ADR-0045).
  await page.waitForFunction(() => window.__seki!.still, null, { timeout: 60_000 });
  // Pixels straight from the canvas (ADR-0046): an element screenshot waits for the compositor,
  // which under SwiftShader in CI did not settle within the expect timeout.
  const png = await page.evaluate(() => window.__seki!.capture!());
  expect(Buffer.from(png.slice(png.indexOf(",") + 1), "base64")).toMatchSnapshot("reference-m0.png", { maxDiffPixelRatio: 0.02, threshold: 0.2 });
});

test("reference scene stays within the perf budget", async ({ page }) => {
  await page.goto("/?reference");
  await waitForGame(page);
  // The reference frame draws only its still (G-001): the sample is of the snapshot's frame.
  await page.waitForFunction(() => window.__seki!.still, null, { timeout: 60_000 });
  within("reference", await perf(page));
});

/** Checks a sample against its scene's budget and keeps it for the report. */
function within(scene: string, sample: Awaited<ReturnType<typeof perf>>) {
  record(scene, sample);
  const budget = budgets.scenes[scene]!;
  expect(sample.drawCalls).toBeLessThanOrEqual(budget.drawCalls);
  expect(sample.activeMeshes).toBeLessThanOrEqual(budget.activeMeshes);
  // Pieces baked into one mesh (trees, bollards, chains) cost no draw call but triangles: a ceiling where the phone needs one.
  if (budget.activeTriangles !== undefined) expect(sample.activeTriangles).toBeLessThanOrEqual(budget.activeTriangles);
}

/** A new game in TPP, frozen: the simulation steps only from the test. */
const startTpp = async (page: Page, query: string) => {
  await page.goto(query);
  await waitForGame(page);
  await newGame(page);
  await waitForPlay(page);
  await freeze(page);
  await step(page, 1, { toggleCamera: true });
};

/** Pages whose game in TPP is already running (`cityScenes`): a scene there only moves the player. */
const running = new WeakSet<Page>();

/** The scenes' walks were counted at the run of 4.2 m/s; at 3.5 the same ground takes 1.2 times the steps. */
const WALK_SCALE = 4.2 / 3.5;

/** The player put at a spot of Lublin (ADR-0045) in TPP and walked a little; a new game first unless the page runs one. */
const tppAt = async (page: Page, at: { frame?: Frame; x: number; z: number; y?: number; yaw: number; walk: number }, query = "/?seed=3&models=off") => {
  if (!running.has(page)) await startTpp(page, query);
  if (at.frame) await teleportTo(page, await place(page, at.frame, at.x, at.z), at.yaw);
  else if (at.y !== undefined) await teleportTo(page, { x: at.x, y: at.y, z: at.z }, at.yaw);
  else await teleport(page, at.x, at.z, at.yaw);
  // As far as the scenes were set up for: the run is 3.5 m/s since 21.11 (4.2 before), so 1.2 times the steps.
  await step(page, Math.round(at.walk * WALK_SCALE), { moveZ: 1 });
};

/**
 * The city's scenes in TPP share one game (ADR-0046, 21.11): the title screen and a new game took
 * about 30 s of each scene's 55 (some 50 s of 85-90 on a slow runner, past the 90 s limit with
 * the frames), so the game starts once and each scene only puts the player at its spot and walks.
 * In order, as before; the W-3 and phone scenes keep a game of their own (W-3's checks its chunks
 * exactly, the phones another quality).
 */
test.describe("the city in TPP, one game", () => {
  test.describe.configure({ mode: "serial" });
  let page: Page;
  test.beforeAll(async ({ browser }, info) => {
    page = await browser.newPage({ baseURL: info.project.use.baseURL, viewport: info.project.use.viewport ?? null });
    await startTpp(page, "/?seed=3&models=off");
    running.add(page);
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test("Krakowskie Przedmieście in TPP stays within the perf budget", async () => {
    // The deptak west of the clinic and Neon Koi, walking east between the tenements.
    await tppAt(page, { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 });
    expect((await gameState(page)).district).toBe("shinsekai-7");
    within("krakowskie-tpp", await sampleNow(page));
  });

  test("the Rynek in TPP stays within the perf budget", async () => {
    // Up Bramowa from Brama Krakowska onto the Rynek, the Trybunał ahead.
    await tppAt(page, { x: 520, z: -63, yaw: Math.atan2(41, 23), walk: 60 });
    expect((await gameState(page)).district).toBe("kanal");
    within("rynek-tpp", await sampleNow(page));
  });

  test("Aleja Tysiąclecia on Podzamcze in TPP stays within the perf budget", async () => {
    // Where the market stood until ADR-0063 moved it to Alchemia: on the avenue, looking west towards Plac Zamkowy.
    await tppAt(page, { x: 795, z: 339, yaw: -Math.PI / 2, walk: 30 });
    expect((await gameState(page)).loadedChunks).not.toContain("krakowskie-2-0");
    within("podzamcze-tpp", await sampleNow(page));
  });

  test("Alchemia's T1 in TPP stays within the perf budget", async () => {
    // On T1 north of the food hall (ADR-0074 stage 1), walking south to its lit front and the way in: the hall in the frame.
    await tppAt(page, { x: 418, z: 78, yaw: Math.PI, walk: 20 });
    expect((await gameState(page)).loadedChunks).toContain("krakowskie-2-1");
    within("alchemia-tpp", await sampleNow(page));
  });

  test("Alchemia's stairs down to T2 in TPP stays within the perf budget", async () => {
    // On the stairs from T1 down to T2 (ADR-0074 stage 2), walking down north-north-east: T2, the Arkady's arches and their upper floor in the frame.
    await tppAt(page, { x: 429.5, z: 79, yaw: 0.25, walk: 20 });
    expect((await gameState(page)).loadedChunks).toContain("krakowskie-2-1");
    within("alchemia-t2-tpp", await sampleNow(page));
  });

  test("Alchemia's car park P-1 in TPP stays within the perf budget", async () => {
    // On P-1 under the car park (ADR-0074 stage 4), on the apron by the ramp's foot walking north-west to the hand-over cabins: the cabins, the deck and the ramp in the frame.
    await tppAt(page, { x: 410, z: 22.5, y: -6.4, yaw: -Math.PI / 4, walk: 12 });
    const s = await gameState(page);
    expect(s.loadedChunks).toContain("krakowskie-2-1");
    within("alchemia-p1", await sampleNow(page));
  });
});

test("Alchemia's car park P-2 in TPP stays within the perf budget", async ({ page }) => {
  // In P-2's automated store under P-1 (ADR-0074 stage 5a), on the service aisle by the control room walking north-west:
  // the racks with the cars on their pallets, the robots' lane with its orange beacons, the flight from P-1 in the frame.
  await tppAt(page, { x: 413.5, z: 8, y: -9.2, yaw: -Math.PI / 5, walk: 12 });
  const s = await gameState(page);
  expect(s.loadedChunks).toContain("krakowskie-2-1");
  within("alchemia-p2", await sampleNow(page));
});

test("the building site at Zielona 5A in TPP stays within the perf budget", async ({ page }) => {
  // On Zielona south-west of the site's gate (ADR-0087), walking north-east to it: the fence with its ads, the gate and
  // the board, the containers and the crane over the dig in the frame (no scaffold since G-893: its wall bears a venue's board).
  await tppAt(page, { x: 238.8, z: -6.5, yaw: 0.675, walk: 20 });
  expect((await gameState(page)).loadedChunks).toContain("krakowskie-1-1");
  within("zielona-budowa-tpp", await sampleNow(page));
});

test("Tessen's W-3 from the Lutosławski bridge at night in TPP stays within the perf budget", async ({ page }) => {
  // On the bridge's deck (+1.8 over W-3's floor), walking east along it towards the wagon gate:
  // the tower, the pier, the quay and the hall's shell over the river (ADR-0082).
  await tppAt(page, { x: 2460.2, z: 422.5, y: -26.75, yaw: 2.11, walk: 30 });
  expect([...(await gameState(page)).loadedChunks].sort()).toEqual(["nabrzeze-0-1", "nabrzeze-w3"]);
  within("w3-zewnatrz", await sampleNow(page));
});

test("Tessen's W-3 hall from the aisle in TPP stays within the perf budget", async ({ page }) => {
  // Inside the assembly hall (ADR-0082 stage 2) by the wagon airlock, walking east along the
  // production aisle towards the test chamber's gate: the belts, the arms, the gallery and the crane.
  await tppAt(page, { x: 2511, z: 418, y: -28.6, yaw: Math.PI / 2, walk: 20 });
  expect((await gameState(page)).loadedChunks).toContain("nabrzeze-w3");
  within("w3-hala", await sampleNow(page));
});

test("a phone (low quality, 800x370) in Tessen's W-3 hall stays within the perf budget", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 370 });
  await tppAt(page, { x: 2511, z: 418, y: -28.6, yaw: Math.PI / 2, walk: 20 }, "/?seed=3&models=off&quality=low&touch");
  expect((await gameState(page)).loadedChunks).toContain("nabrzeze-w3");
  within("phone-w3-hala", await sampleNow(page));
});

test("a phone (low quality, 800x370) on the deptak stays within the perf budget", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 370 });
  await tppAt(page, { x: 270, z: -81, yaw: Math.PI / 2, walk: 60 }, "/?seed=3&models=off&quality=low&touch");
  within("phone-low", await sampleNow(page));
});
