import { degToRad } from "@seki/core";
import { BabylonRenderer, BrowserInput, PerfProbe, PreviewStage, Stage, SynthAudio } from "@seki/engine";
import { audioSampleManifest } from "./audio-manifest";
import { loadModelManifest } from "./model-manifest";
import { STORY_SOURCE } from "@seki/narrative";
import { IndexedDbSaveStore, SavePersistence } from "@seki/persistence";
import { FixedStepLoop, ground, koiPoint, rayGeometry } from "@seki/sim";
import { DEFAULT_SETTINGS, GameUi, createUiStore } from "@seki/ui";
import { createRoot } from "react-dom/client";
import { browserClock } from "./browser-clock";
import { type DebugApi, createDebugApi } from "./debug-api";
import { GameSession } from "./game-session";
import { keymapFor } from "./controls";
import { type SettingsStorage, applyEffects, loadHintsSeen, loadSettings, saveHintsSeen, saveSettings, scaleLook } from "./settings";

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
// The reference frame never shows hints (the NPR snapshot is of the scene alone).
// A system-wide "reduce motion" turns the flashes and the glitch down from the start (ADR-0028).
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const deviceDefaults = { ...DEFAULT_SETTINGS, quality: touchDevice ? "low" : "high", hints: !reference, reduceFlashes: reducedMotion } as const;
// The reference frame ignores saved settings so the NPR snapshot never depends on the profile.
const settings = reference ? deviceDefaults : loadSettings(storage, deviceDefaults);
const qualityParam = params.get("quality");
// ?quality wins over the saved setting, so tests and bug reports can force any tier (ADR-0036).
const quality = qualityParam === "low" || qualityParam === "medium" || qualityParam === "high" ? qualityParam : settings.quality;
const renderQuality = quality;
const crowdParam = params.get("crowd");
const stage = new Stage(canvas, { reference, quality: renderQuality });
// Buildings and vehicles from the CC0 city kit (public/city/README.md, ADR-0022); ?city=off keeps
// the plain blocks. The reference frame uses it too: the scene is ready only once it is in.
// Lublin is drawn to the horizon from the map (ADR-0045): no far city of the old streets.
const renderer = new BabylonRenderer(stage, { cityKit: params.get("city") === "off" ? null : new URL("city/city-kit.glb", document.baseURI).href, farCity: false });
// The character menu's 3D preview: a second scene on the same engine and canvas (ADR-0015).
const preview = new PreviewStage(stage.engine, canvas, { quality: renderQuality });
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
  touch: touchDevice,
  // The crowd follows the graphics quality (ADR-0041); ?crowd=off|low|medium|high overrides it.
  crowd: crowdParam === "off" || crowdParam === "low" || crowdParam === "medium" || crowdParam === "high" ? crowdParam : quality,
  hints: { seen: loadHintsSeen(storage), save: (seen) => saveHintsSeen(storage, seen) },
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
// The TPP camera stops at the map's buildings and the terrain too (ADR-0045): the simulation's
// own ray through its solids, handed to the camera through the app.
renderer.rig.setOccluder((origin, dir, maxDist) => rayGeometry(session.sim.world, origin, dir, maxDist));

/** Controls from the settings: key bindings, hold or toggle buttons and the field of view. */
let controlsFor: unknown = null;
const applyControls = (s: typeof settings) => {
  if (controlsFor === s) return;
  controlsFor = s;
  input.keymap = keymapFor(s.bindings);
  input.setButtonModes({ aim: s.aimMode, crouch: s.crouchMode, sprint: s.sprintMode });
  renderer.rig.horizontalFov = degToRad(s.horizontalFov);
  applyEffects(renderer, s);
};

const loop = new FixedStepLoop(browserClock, {
  update: () => {
    const s = ui.getState().settings;
    applyControls(s);
    // Zoomed in, the look slows with the field of view (ADR-0019); the ADS setting on top.
    const zoom = renderer.rig.lookScale;
    const ads = zoom < 0.999 ? s.adsSensitivity : 1;
    session.step(scaleLook(input.poll(), (touchDevice ? s.touchSensitivity : s.mouseSensitivity) * zoom * ads, s.invertY));
  },
  render: (alpha) => {
    session.render(alpha);
    // The menu covers the game, which stays frozen: draw only the preview (and the menu colour).
    if (session.characterScreenOpen) {
      preview.render(stage.engine.getDeltaTime() / 1000);
      return;
    }
    renderer.setScanning(ui.getState().scanning);
    renderer.frame(stage.engine.getDeltaTime() / 1000);
    const player = renderer.cameraTargetTransform;
    if (player) audio.setListener({ position: player.position, yaw: player.yaw, speed: player.speed });
    stage.scene.render();
  },
});

// Title screen backdrop: from the corner of Plac Litewski by the wreck, down the deptak.
const TITLE_VIEW = { position: ground(146, -49, 2.2), target: ground(232, -64, 3.5) };
// Reference frame for NPR snapshots: Seki on the deptak in front of Neon Koi, under its sign.
const REFERENCE_VIEW = { position: koiPoint(3.4, 1.55, 4.6), target: koiPoint(5.5, 1.15, 0.9) };
const REFERENCE_SPOT = koiPoint(4.6, 0, 0.6);

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
  } else if (e.code === "KeyP" && !e.repeat) {
    // P pauses too, as in most PC games (Esc is taken by the browser while the mouse is locked).
    if (session.screen === "paused") session.resume();
    else if (session.inControl) {
      input.releasePointerLock();
      session.pause();
    }
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
  () => renderer.modelsLoading,
  () => renderer.citySettled,
);
debug.capture = () => renderer.captureFrame();
window.__seki = debug;

// Wave 1 effects over the whole frame (ADR-0030): hits on the player, quickhack uploads, heat
// and the scanner's focus. The scanner itself follows the store in the render loop.
session.bus.on("DamageDealt", (e) => {
  if (e.targetId === session.sim.player()?.id) renderer.gameplayFx({ kind: "player-hurt", amount: e.amount });
});
session.bus.on("QuickhackStarted", () => renderer.gameplayFx({ kind: "quickhack", phase: "started" }));
session.bus.on("QuickhackApplied", () => renderer.gameplayFx({ kind: "quickhack", phase: "applied" }));
session.bus.on("HeatChanged", (e) => renderer.gameplayFx({ kind: "heat", level: e.level, searching: e.searching }));
session.bus.on("ScanFocusChanged", (e) => renderer.setScanFocus(e.targetId, e.kind));
// Wave 2 (ADR-0036): dash and reflection effects, the metro car while the destination streams in.
session.bus.on("Dashed", (e) => renderer.gameplayFx({ kind: "dash", entityId: e.entityId, at: e.at, air: e.air }));
session.bus.on("ProjectileReflected", (e) => renderer.gameplayFx({ kind: "reflect", defenderId: e.defenderId, at: e.at, to: e.to }));
session.bus.on("MetroDeparted", (e) => renderer.setMetroRide({ from: e.from, to: e.to, seconds: e.seconds }));
session.bus.on("MetroArrived", () => renderer.setMetroRide(null));

if (reference) {
  // The snapshot guards the 3D look only; the HUD has its own component tests.
  uiRoot.style.display = "none";
  session.newGame();
  input.enabled = false;
  loop.paused = true;
  debug.teleport(REFERENCE_SPOT.x, REFERENCE_SPOT.z, Math.PI - 0.3);
  session.render(0);
  ui.setState({ toasts: [] });
}

/**
 * The reference frame is a still: once the city round it is built in detail, a few more frames
 * settle the post-process and then rendering stops. Under SwiftShader a frame of Lublin takes
 * about 600 ms, and a canvas redrawn that slowly never gives the snapshot two equal captures
 * within its timeout (ADR-0046: the cause, not a longer timeout).
 */
const REFERENCE_SETTLE_FRAMES = 8;
let settledFrames = 0;
stage.engine.runRenderLoop(() => {
  loop.frame();
  if (!reference || !debug.ready || !renderer.citySettled) return;
  if (++settledFrames >= REFERENCE_SETTLE_FRAMES) {
    stage.engine.stopRenderLoop();
    debug.still = true;
  }
});
stage.scene.executeWhenReady(() => {
  debug.ready = true;
});
