import { writeFileSync } from "node:fs";
import { type Page, test } from "@playwright/test";
import { gameState, newGame, teleport, waitForGame, waitForPlay } from "./helpers";

/**
 * A report, not a check (ADR-0046: frame time under SwiftShader measures the runner): what loads
 * or compiles once the game is on screen, and the long frames it costs. Runs only with
 * `HITCH_REPORT=<file.json>` (`HITCH_QUERY` for another URL, e.g. `/?seed=7&quality=low`).
 * WebGL calls, fetches and the render loop's callbacks are timed in the page and a CPU profile is
 * kept next to the report, so the shader programs linked (one per Babylon effect), the uploads and
 * the code of every frame over 50 ms can be put against the scripted minute of play and two
 * district changes: `python3 -I tools/hitch-report/analyze.py <file.json> 50 --list` and
 * `tools/hitch-report/profile.py` (what the CPU did in each long frame).
 */
const out = process.env.HITCH_REPORT;
const query = process.env.HITCH_QUERY ?? "/?seed=7";

type Ev = { t: number; k: string; d: number; n?: string; b?: number };

/** Runs in the page before any of its scripts: times the WebGL calls and the frames. */
const instrument = () => {
  const w = window as unknown as { __hr: { ev: Ev[]; frames: number[]; marks: [number, string][] } };
  const hr = (w.__hr = { ev: [] as Ev[], frames: [] as number[], marks: [] as [number, string][] });
  const wrap = (proto: object, name: string, kind: string, bytes?: (args: unknown[]) => number) => {
    const p = proto as Record<string, unknown>;
    const orig = p[name] as ((...a: unknown[]) => unknown) | undefined;
    if (typeof orig !== "function") return;
    p[name] = function (this: unknown, ...args: unknown[]) {
      const t = performance.now();
      const r = orig.apply(this, args);
      const d = performance.now() - t;
      hr.ev.push({ t, k: kind, d, ...(bytes ? { b: bytes(args) } : {}) });
      return r;
    };
  };
  for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
    wrap(proto, "compileShader", "compile");
    wrap(proto, "linkProgram", "link");
    wrap(proto, "getProgramParameter", "programStatus");
    wrap(proto, "getShaderParameter", "shaderStatus");
    for (const n of ["texImage2D", "texSubImage2D", "texImage3D", "texSubImage3D", "compressedTexImage2D", "texStorage2D", "generateMipmap"]) wrap(proto, n, "texture");
    const size = (a: unknown[]) => (typeof a[1] === "number" ? a[1] : ((a[1] as ArrayBufferView | null)?.byteLength ?? 0));
    wrap(proto, "bufferData", "buffer", size);
    wrap(proto, "readPixels", "readPixels");
    for (const n of ["getError", "getParameter", "finish", "clientWaitSync", "getBufferSubData"]) wrap(proto, n, "sync");
    // Which program a link is: the shaders' defines and uniforms, for the report.
    const p = proto as unknown as Record<string, (...a: unknown[]) => unknown>;
    const link = p.linkProgram!;
    p.linkProgram = function (this: WebGL2RenderingContext, program: unknown) {
      const src = (this.getAttachedShaders(program as WebGLProgram) ?? []).map((s) => this.getShaderSource(s) ?? "").join("\n");
      const defines = [...src.matchAll(/#define (\w+)/g)].map((m) => m[1]).slice(0, 40).join(" ");
      const uniforms = [...src.matchAll(/uniform \w+ (\w+)/g)].map((m) => m[1]).slice(0, 25).join(" ");
      hr.ev.push({ t: performance.now(), k: "linkSrc", d: 0, n: `${src.length}ch | ${defines} | ${uniforms}` });
      return link.call(this, program);
    };
  }
  performance.setResourceTimingBufferSize(20000);
  const fetchOrig = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const s = performance.now();
    const res = await fetchOrig(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    hr.ev.push({ t: s, k: "fetch", d: performance.now() - s, n: url.replace(/^.*\/\/[^/]+/, ""), b: Number(res.headers.get("content-length") ?? 0) });
    return res;
  };
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as (PerformanceEntry & { blockingDuration: number; scripts: { sourceFunctionName: string; sourceURL: string; sourceCharPosition: number; duration: number; invoker: string }[] })[]) {
      const top = [...e.scripts].sort((a, b) => b.duration - a.duration).slice(0, 3);
      hr.ev.push({ t: e.startTime, k: "loaf", d: e.duration, n: top.map((s) => `${s.invoker}|${s.sourceFunctionName}@${s.sourceURL.replace(/^.*\//, "")}:${s.sourceCharPosition} ${Math.round(s.duration)}`).join(" ; ") });
    }
  }).observe({ type: "long-animation-frame", buffered: true });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    raf((t) => {
      const s = performance.now();
      cb(t);
      hr.ev.push({ t: s, k: "raf", d: performance.now() - s });
    });
  new PerformanceObserver((list) => {
    for (const e of list.getEntries() as PerformanceResourceTiming[]) {
      if (/\.(glb|gltf|vrm|png|jpg|ktx2|webp|bin|json|ogg|mp3)(\?|$)/.test(e.name)) hr.ev.push({ t: e.responseEnd, k: "file", d: e.duration, n: e.name.replace(/^.*\/\/[^/]+/, ""), b: e.transferSize });
    }
  }).observe({ type: "resource", buffered: true });
  (window as unknown as { __hrSync: () => number }).__hrSync = function hrSyncMarker() {
    const s = performance.now();
    while (performance.now() - s < 40);
    return s;
  };
  const tick = (t: number) => {
    hr.frames.push(t);
    raf(tick);
  };
  raf(tick);
};

const mark = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __hr: { marks: [number, string][] } }).__hr.marks.push([performance.now(), n]), name);

/** Holds keys for `ms` of real time, the game loop running, the district noted every 250 ms. */
const hold = async (page: Page, keys: readonly string[], ms: number, districts: [number, string][]) => {
  for (const k of keys) await page.keyboard.down(k);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await gameState(page);
    const [t, dressed, loading] = await page.evaluate(() => [performance.now(), window.__seki!.dressed(), window.__seki!.modelsLoading()]);
    const now = `${s.district ?? "-"} r${s.residents} d${dressed} l${loading} c${s.loadedChunks.length}`;
    if (districts.at(-1)?.[1] !== now) districts.push([t, now]);
    await page.waitForTimeout(250);
  }
  for (const k of keys) await page.keyboard.up(k);
};

test("hitch report: what loads after the game is on screen", async ({ page }) => {
  test.skip(!out, "HITCH_REPORT not set");
  test.setTimeout(400_000);
  await page.addInitScript(instrument);
  await page.goto(query);
  await waitForGame(page);
  await mark(page, "title");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 2000 });
  await cdp.send("Profiler.start");
  const sync = await page.evaluate(() => (window as unknown as { __hrSync: () => number }).__hrSync());
  await newGame(page);
  await mark(page, "newGame");
  const loadMs = await waitForPlay(page);
  await mark(page, "playing");
  const districts: [number, string][] = [];
  await page.mouse.move(640, 360);
  // The first minute: look round, walk, draw the pistol, aim and shoot, melee, TPP and back.
  await hold(page, [], 3000, districts);
  await hold(page, ["KeyW"], 6000, districts);
  await mark(page, "draw");
  await page.keyboard.press("KeyX");
  await hold(page, [], 2500, districts);
  await mark(page, "aim+fire");
  await page.mouse.down({ button: "right" });
  for (let i = 0; i < 4; i++) await page.mouse.click(640, 360);
  await hold(page, [], 1500, districts);
  await page.mouse.up({ button: "right" });
  await page.keyboard.press("KeyR");
  await hold(page, [], 2500, districts);
  await mark(page, "melee");
  await page.keyboard.press("Digit3");
  await hold(page, [], 2500, districts);
  await page.mouse.click(640, 360);
  await hold(page, [], 1500, districts);
  await mark(page, "tpp");
  await page.keyboard.press("KeyV");
  await hold(page, ["KeyW", "ShiftLeft"], 8000, districts);
  await mark(page, "fpp");
  await page.keyboard.press("KeyV");
  await hold(page, ["KeyW"], 6000, districts);
  await mark(page, "scan");
  await hold(page, ["KeyZ"], 2000, districts);
  await hold(page, [], 3000, districts);
  // Then across districts: Krakowskie Przedmieście east to the Rynek, then Podzamcze.
  await mark(page, "to-kanal");
  await teleport(page, 470, -66, Math.PI / 2);
  await hold(page, ["KeyW", "ShiftLeft"], 14000, districts);
  await mark(page, "to-podzamcze");
  await teleport(page, 795, 339, -Math.PI / 2);
  await hold(page, ["KeyW", "ShiftLeft"], 10000, districts);
  await mark(page, "end");
  const data = await page.evaluate(() => (window as unknown as { __hr: unknown }).__hr);
  const { profile } = await cdp.send("Profiler.stop");
  writeFileSync(out!.replace(/\.json$/, ".cpuprofile"), JSON.stringify(profile));
  writeFileSync(out!, JSON.stringify({ query, loadMs, districts, sync, ...(data as object) }));
});
