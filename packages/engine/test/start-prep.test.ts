import type { PrepareStage } from "@seki/core";
import { describe, expect, it } from "vitest";
import { MAX_FILE_FRAMES, STAGE_WEIGHT, StartPrep, type StartPrepDeps } from "../src/renderer/start-prep";

/** Preparing the start of a game (ADR-0057), with a fake scene the test drives frame by frame. */

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await Promise.resolve();
};

const fakeDeps = (over: Partial<StartPrepDeps> = {}) => {
  const log = { drawn: 0, waiting: 0, gpuBusy: false, ready: true };
  const deps: StartPrepDeps = {
    modelFiles: async () => [],
    cityKit: async () => {},
    cityWaiting: () => log.waiting,
    sceneReady: async () => {},
    isReady: () => log.ready,
    canDraw: () => !log.gpuBusy,
    draw: () => {
      log.drawn++;
    },
    ...over,
  };
  return { deps, log };
};

const record = () => {
  const seen: { done: number; stage: PrepareStage }[] = [];
  return { seen, onProgress: (done: number, stage: PrepareStage) => seen.push({ done, stage }) };
};

/** Ticks frames until the run settles (or `max` frames), returning the frames it took. */
const drive = async (prep: StartPrep, settled: () => boolean, max = 2000) => {
  let frames = 0;
  await flush();
  while (!settled() && frames < max) {
    prep.tick();
    frames++;
    await flush();
  }
  return frames;
};

describe("StartPrep", () => {
  it("runs the four stages in order, monotonic, ending at 1", async () => {
    const { deps, log } = fakeDeps();
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    let over = false;
    void prep.run(onProgress).then(() => (over = true));
    expect(prep.active).toBe(true);
    const frames = await drive(prep, () => over);
    expect(over).toBe(true);
    expect(prep.active).toBe(false);
    const stages = [...new Set(seen.map((s) => s.stage))];
    expect(stages).toEqual(["models", "cityKit", "city", "shaders"]);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!.done).toBeGreaterThanOrEqual(seen[i - 1]!.done);
    expect(seen.at(-1)!.done).toBeCloseTo(1, 9);
    // Nothing to load: two settled frames for the city, three warm-up frames, nothing more.
    expect(log.drawn).toBe(3);
    expect(frames).toBeLessThanOrEqual(6);
  });

  it("a stage without work ends at once, with no frame", async () => {
    const { deps } = fakeDeps();
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    void prep.run(onProgress);
    await flush(10);
    // Models (none) and the kit (none) are over before the first frame.
    expect(seen.find((s) => s.stage === "city")?.done).toBeCloseTo(STAGE_WEIGHT.models + STAGE_WEIGHT.cityKit, 9);
  });

  it("counts every model file, a failed one too, and never fails itself", async () => {
    let fail!: (e: unknown) => void;
    let ok!: () => void;
    const broken = new Promise((_, reject) => (fail = reject));
    const fine = new Promise<void>((resolve) => (ok = resolve));
    const { deps } = fakeDeps({ modelFiles: async () => [broken, fine], cityKit: () => Promise.reject(new Error("kit 404")) });
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    let over = false;
    void prep.run(onProgress).then(() => (over = true));
    await flush();
    expect(seen.at(-1)).toEqual({ done: 0, stage: "models" });
    fail(new Error("vrm 404"));
    await flush();
    expect(seen.at(-1)!.done).toBeCloseTo(STAGE_WEIGHT.models / 2, 9);
    ok();
    await drive(prep, () => over);
    expect(over).toBe(true);
  });

  it("waits for the city to settle, following the cells left", async () => {
    const { deps, log } = fakeDeps();
    log.waiting = 8;
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    let over = false;
    void prep.run(onProgress).then(() => (over = true));
    await flush(10);
    for (let i = 0; i < 4; i++) prep.tick();
    expect(seen.filter((s) => s.stage === "city").length).toBeGreaterThan(0);
    log.waiting = 2;
    prep.tick();
    const city = seen.filter((s) => s.stage === "city").at(-1)!.done;
    expect(city).toBeCloseTo(0.5 + 0.3 * (1 - 2 / 8), 9);
    expect(log.drawn).toBe(0);
    log.waiting = 0;
    await drive(prep, () => over);
    expect(over).toBe(true);
  });

  it("draws warm-up frames only when the GPU pacer allows, until the scene stays ready", async () => {
    const { deps, log } = fakeDeps();
    log.gpuBusy = true;
    const prep = new StartPrep(deps);
    let over = false;
    void prep.run(() => {}).then(() => (over = true));
    await flush(10);
    for (let i = 0; i < 20; i++) {
      prep.tick();
      await flush();
    }
    expect(log.drawn).toBe(0);
    expect(over).toBe(false);
    log.gpuBusy = false;
    log.ready = false;
    for (let i = 0; i < 6; i++) {
      prep.tick();
      await flush();
    }
    // A drawn frame asked for more shaders: it keeps warming up.
    expect(log.drawn).toBe(6);
    expect(over).toBe(false);
    log.ready = true;
    await drive(prep, () => over);
    expect(over).toBe(true);
  });

  it("a newer run ends the older one, which reports nothing more", async () => {
    const { deps, log } = fakeDeps();
    log.waiting = 5;
    const prep = new StartPrep(deps);
    const first = record();
    let firstOver = false;
    void prep.run(first.onProgress).then(() => (firstOver = true));
    await flush(10);
    prep.tick();
    const reports = first.seen.length;
    const second = record();
    let secondOver = false;
    void prep.run(second.onProgress).then(() => (secondOver = true));
    await flush(10);
    expect(firstOver).toBe(true);
    log.waiting = 0;
    await drive(prep, () => secondOver);
    expect(secondOver).toBe(true);
    expect(first.seen.length).toBe(reports);
    expect(second.seen.at(-1)!.done).toBeCloseTo(1, 9);
  });

  it("gives up on a stage that never ends, so the start is never held", async () => {
    const { deps, log } = fakeDeps();
    log.waiting = 3;
    const prep = new StartPrep(deps);
    let over = false;
    void prep.run(() => {}).then(() => (over = true));
    const frames = await drive(prep, () => over, 5000);
    expect(over).toBe(true);
    expect(frames).toBeLessThan(1000);
  });
  it("a model download that never answers ends the stage after its frames, like a failed one", async () => {
    const hang = new Promise<never>(() => {});
    const { deps } = fakeDeps({ modelFiles: () => hang });
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    let over = false;
    void prep.run(onProgress).then(() => (over = true));
    const frames = await drive(prep, () => over, 5000);
    expect(over).toBe(true);
    expect(frames).toBeLessThan(MAX_FILE_FRAMES + 20);
    expect(seen.at(-1)!.done).toBeCloseTo(1, 9);
  });

  it("a model file and a city kit that never answer do not hold the start, nor move the bar back", async () => {
    let ok!: () => void;
    const late = new Promise<void>((resolve) => (ok = resolve));
    const { deps } = fakeDeps({ modelFiles: async () => [late, new Promise(() => {})], cityKit: () => new Promise(() => {}) });
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    let over = false;
    void prep.run(onProgress).then(() => (over = true));
    const frames = await drive(prep, () => over, 5000);
    expect(over).toBe(true);
    expect(frames).toBeLessThan(2 * MAX_FILE_FRAMES + 20);
    const count = seen.length;
    // A file that answers after its stage gave up reports nothing more.
    ok();
    await flush();
    expect(seen.length).toBe(count);
    for (let i = 1; i < seen.length; i++) expect(seen[i]!.done).toBeGreaterThanOrEqual(seen[i - 1]!.done);
    expect(seen.at(-1)!.done).toBeCloseTo(1, 9);
  });

  it("cancel ends the run under way: no warm-up frame is drawn after it", async () => {
    const { deps, log } = fakeDeps();
    log.ready = false;
    const prep = new StartPrep(deps);
    const { seen, onProgress } = record();
    let over = false;
    void prep.run(onProgress).then(() => (over = true));
    await drive(prep, () => log.drawn > 0);
    expect(log.drawn).toBeGreaterThan(0);
    const drawn = log.drawn;
    const count = seen.length;
    prep.cancel();
    expect(prep.active).toBe(false);
    for (let i = 0; i < 20; i++) {
      prep.tick();
      await flush();
    }
    expect(over).toBe(true);
    expect(log.drawn).toBe(drawn);
    expect(seen.length).toBe(count);
  });
});
