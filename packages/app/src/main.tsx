import { BabylonRenderer, BrowserInput, PerfProbe, Stage, SynthAudio } from "@seki/engine";
import { STORY_SOURCE } from "@seki/narrative";
import { IndexedDbSaveStore, SavePersistence } from "@seki/persistence";
import { FixedStepLoop } from "@seki/sim";
import { GameUi, createUiStore } from "@seki/ui";
import { createRoot } from "react-dom/client";
import { browserClock } from "./browser-clock";
import { type DebugApi, createDebugApi } from "./debug-api";
import { GameSession } from "./game-session";

declare global {
  interface Window {
    __seki?: DebugApi;
  }
}

const params = new URLSearchParams(location.search);
const reference = params.has("reference");
const seedParam = params.get("seed");

const randomSeed = (): number => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] ?? 1;
};

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root") as HTMLElement;

const stage = new Stage(canvas, { reference });
const renderer = new BabylonRenderer(stage);
const input = new BrowserInput(canvas);
const audio = new SynthAudio();
const ui = createUiStore();
const probe = new PerfProbe(stage.engine, stage.scene);

const session = new GameSession({
  render: renderer,
  audio,
  persistence: new SavePersistence(new IndexedDbSaveStore()),
  ui,
  story: STORY_SOURCE,
  seed: () => (seedParam ? Number(seedParam) : reference ? 42 : randomSeed()),
  now: () => new Date(),
  onFocusChange: (wantsPointer) => {
    input.enabled = wantsPointer;
    if (wantsPointer) input.requestPointerLock();
    else input.releasePointerLock();
  },
});

const loop = new FixedStepLoop(browserClock, {
  update: () => session.step(input.poll()),
  render: (alpha) => {
    session.render(alpha);
    renderer.frame(stage.engine.getDeltaTime() / 1000);
    stage.scene.render();
  },
});

// Title screen backdrop: a slow look down the street from above the wreck.
const TITLE_VIEW = { position: { x: -3.5, y: 2.2, z: -33 }, target: { x: 2, y: 3.5, z: 0 } };
// Reference frame for NPR snapshots: Seki in front of Kaito under the Neon Koi sign.
const REFERENCE_VIEW = { position: { x: 3.4, y: 1.55, z: 4.6 }, target: { x: 5.5, y: 1.15, z: 0.9 } };

const applyBackdrop = () => {
  if (ui.getState().screen === "title" || reference) {
    const view = reference ? REFERENCE_VIEW : TITLE_VIEW;
    renderer.rig.setReferenceView(view.position, view.target);
  } else {
    renderer.rig.setReferenceView(null);
  }
};
ui.subscribe(applyBackdrop);
applyBackdrop();

// System keys and pointer-lock driven pause.
window.addEventListener("keydown", (e) => {
  audio.unlock();
  if (e.code === "F5") {
    e.preventDefault();
    void session.saveAsync("quick");
  } else if (e.code === "F9") {
    e.preventDefault();
    void session.loadAsync("quick");
  } else if (e.code === "Escape") {
    // With pointer lock the browser consumes Esc and pointerlockchange pauses instead.
    if (session.screen === "paused") session.resume();
    else if (!input.locked) session.pause();
  }
});
window.addEventListener("pointerdown", () => {
  audio.unlock();
  audio.startAmbience();
  if (session.inControl) input.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  if (!input.locked && session.inControl && !reference) session.pause();
});

createRoot(uiRoot).render(<GameUi store={ui} intents={session} />);

const debug = createDebugApi(session, ui, loop, () => probe.sample());
window.__seki = debug;

if (reference) {
  // The snapshot guards the 3D look only; the HUD has its own component tests.
  uiRoot.style.display = "none";
  session.newGame();
  input.enabled = false;
  loop.paused = true;
  debug.teleport(4.6, 0.6, Math.PI / 2 - 0.3);
  session.render(0);
  ui.setState({ toasts: [] });
}

stage.engine.runRenderLoop(() => loop.frame());
stage.scene.executeWhenReady(() => {
  debug.ready = true;
});
