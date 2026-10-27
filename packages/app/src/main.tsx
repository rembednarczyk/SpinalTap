import { BabylonRenderer, BrowserInput, PerfProbe, PreviewStage, Stage, SynthAudio } from "@seki/engine";
import { audioSampleManifest } from "./audio-manifest";
import { loadModelManifest } from "./model-manifest";
import { STORY_SOURCE } from "@seki/narrative";
import { IndexedDbSaveStore, SavePersistence } from "@seki/persistence";
import { FixedStepLoop } from "@seki/sim";
import { DEFAULT_SETTINGS, GameUi, createUiStore } from "@seki/ui";
import { createRoot } from "react-dom/client";
import { browserClock } from "./browser-clock";
import { type DebugApi, createDebugApi } from "./debug-api";
import { GameSession } from "./game-session";
import { type SettingsStorage, loadSettings, saveSettings, scaleLook } from "./settings";

declare global {
  interface Window {
    __seki?: DebugApi;
  }
}

const params = new URLSearchParams(location.search);
const reference = params.has("reference");
const seedParam = params.get("seed");
// Coarse pointer = phone or tablet; ?touch forces the on-screen pad (testing on desktop).
const touchDevice = params.has("touch") || window.matchMedia("(pointer: coarse)").matches;

const randomSeed = (): number => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] ?? 1;
};

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root") as HTMLElement;

// Accessing localStorage itself throws when site data is blocked.
const storage = ((): SettingsStorage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const deviceDefaults = { ...DEFAULT_SETTINGS, quality: touchDevice ? "low" : "high" } as const;
// The reference frame ignores saved settings so the NPR snapshot never depends on the profile.
const settings = reference ? deviceDefaults : loadSettings(storage, deviceDefaults);
const qualityParam = params.get("quality");
// ?quality wins over the saved setting, so tests and bug reports can force either.
const quality = qualityParam === "low" || qualityParam === "high" ? qualityParam : settings.quality;
const stage = new Stage(canvas, { reference, quality });
const renderer = new BabylonRenderer(stage);
// The character menu's 3D preview: a second scene on the same engine and canvas (ADR-0015).
const preview = new PreviewStage(stage.engine, canvas, { quality });
// Imported character models: models/manifest.json next to the game, ?models=<url> for another
// cast, ?models=off for the procedural one. The reference frame stays procedural so the NPR
// snapshot does not depend on downloads; perf tests pass `off` for the same reason.
const modelsParam = params.get("models");
if (modelsParam !== "off" && (modelsParam || !reference)) {
  // CC0 weapon models replace the box pistols (see public/weapons/README.md).
  const weapons = new URL("weapons/", document.baseURI);
  const weaponModels = { pistol: new URL("pistol.glb", weapons).href, smg: new URL("smg.glb", weapons).href };
  void loadModelManifest(modelsParam ?? "./models/manifest.json").then((m) => {
    if (Object.keys(m).length > 0) renderer.setCharacterModels(m);
    preview.setModels(m, weaponModels);
  });
  renderer.setWeaponModels(weaponModels);
  preview.setModels({}, weaponModels);
}
const input = new BrowserInput(canvas);
// Recorded CC0 sounds from public/audio, loaded after the first gesture; ?audio=off keeps the
// pure synth. Anything missing or undecodable (e.g. Vorbis on old Safari) is synthesized.
const audio = new SynthAudio({ samples: params.get("audio") === "off" ? {} : audioSampleManifest(new URL("audio/", document.baseURI).href) });
audio.setVolume("master", settings.volume);
const ui = createUiStore();
const probe = new PerfProbe(stage.engine, stage.scene);

const session = new GameSession({
  render: renderer,
  audio,
  persistence: new SavePersistence(new IndexedDbSaveStore()),
  ui,
  preview,
  story: STORY_SOURCE,
  seed: () => (seedParam ? Number(seedParam) : reference ? 42 : randomSeed()),
  now: () => new Date(),
  settings: {
    applied: { ...settings, quality },
    save: (next) => saveSettings(storage, next),
    reload: () => location.reload(),
  },
  onFocusChange: (wantsPointer) => {
    input.enabled = wantsPointer;
    if (touchDevice) return;
    if (wantsPointer) input.requestPointerLock();
    else input.releasePointerLock();
  },
});

const loop = new FixedStepLoop(browserClock, {
  update: () => {
    const s = ui.getState().settings;
    input.aimMode = s.aimMode;
    // Zoomed in, the look slows with the field of view (ADR-0019).
    session.step(scaleLook(input.poll(), (touchDevice ? s.touchSensitivity : s.mouseSensitivity) * renderer.rig.lookScale));
  },
  render: (alpha) => {
    session.render(alpha);
    // The menu covers the game, which stays frozen: draw only the preview (and the menu colour).
    if (session.characterScreenOpen) {
      preview.render(stage.engine.getDeltaTime() / 1000);
      return;
    }
    renderer.frame(stage.engine.getDeltaTime() / 1000);
    const player = renderer.cameraTargetTransform;
    if (player) audio.setListener({ position: player.position, yaw: player.yaw, speed: player.speed });
    stage.scene.render();
  },
});

// Title screen backdrop: a slow look down the street from above the wreck.
const TITLE_VIEW = { position: { x: -3.5, y: 2.2, z: -33 }, target: { x: 2, y: 3.5, z: 0 } };
// Reference frame for NPR snapshots: Seki in front of Kaito under the Neon Koi sign.
const REFERENCE_VIEW = { position: { x: 3.4, y: 1.55, z: 4.6 }, target: { x: 5.5, y: 1.15, z: 0.9 } };

let lastScreen: string | null = null;
/** Fixed camera on the title screen and in reference mode; reacts to screen changes only. */
const applyBackdrop = () => {
  const screen = ui.getState().screen;
  if (screen === lastScreen) return;
  lastScreen = screen;
  if (screen === "title" || reference) {
    const view = reference ? REFERENCE_VIEW : TITLE_VIEW;
    renderer.rig.setReferenceView(view.position, view.target);
  } else {
    renderer.rig.setReferenceView(null);
  }
};
ui.subscribe(applyBackdrop);
applyBackdrop();

// Music ducks under conversations; master volume follows the settings live.
let talking = false;
let volume = settings.volume;
ui.subscribe((s) => {
  const nowTalking = s.dialogue !== null;
  if (nowTalking !== talking) {
    talking = nowTalking;
    audio.setMood(talking ? "dialog" : "explore");
  }
  if (s.settings.volume !== volume) {
    volume = s.settings.volume;
    audio.setVolume("master", volume);
  }
});

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
  if (session.inControl && !touchDevice) input.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  if (!input.locked && session.inControl && !reference) session.pause();
});

createRoot(uiRoot).render(<GameUi store={ui} intents={session} touch={touchDevice ? input.virtualPad : undefined} />);

const debug = createDebugApi(session, ui, loop, () => probe.sample(), (position, target) => renderer.rig.setReferenceView(position, target),
  () => renderer.dressedCount,
  () => renderer.rig.camera.position.y,
  () => preview.state,
);
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
