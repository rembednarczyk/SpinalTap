import type { AudioCue } from "@seki/core";
import type { AudioSampleManifest, SampleSet } from "@seki/engine";

/**
 * Recorded CC0 sounds shipped in public/audio (sources and licences: public/audio/README.md).
 * File names are relative to the audio folder; `audioSampleManifest` resolves them against the
 * page, so the engine never knows where the app keeps its files. Cues without an entry, and
 * every file that fails to load or decode, stay synthesized.
 */
const range = (prefix: string, ids: readonly string[]): string[] => ids.map((id) => `${prefix}${id}.ogg`);

const SOUNDS = {
  cues: {
    shot: { urls: ["gun-pistol-ppq-near.ogg", "gun-pistol-1911-near.ogg", "gun-smg-m45-near.ogg"], gain: 0.55, pitch: 0.05, send: 0.55 },
    "enemy-shot": { urls: ["gun-pistol-ppq-mid.ogg", "gun-smg-m45-mid.ogg"], gain: 0.32, pitch: 0.06, send: 0.85 },
    hit: { urls: range("hit-punch-", ["000", "001", "002"]), gain: 0.5, pitch: 0.08, send: 0.15 },
    critical: { urls: range("crit-punch-", ["000", "001", "002"]), gain: 0.6, pitch: 0.06, send: 0.25, layerSynth: true },
    hurt: { urls: range("hurt-soft-", ["000", "001", "002"]), gain: 0.7, pitch: 0.08 },
    kill: { urls: ["kill-plate-000.ogg", "kill-metal-000.ogg"], gain: 0.45, pitch: 0.05, send: 0.4, layerSynth: true },
    "ui-select": { urls: ["ui-select-001.ogg", "ui-select-002.ogg"], gain: 0.5, pitch: 0.03 },
    "quest-update": { urls: ["ui-confirm-001.ogg"], gain: 0.55, pitch: 0 },
    save: { urls: ["ui-save-click-001.ogg"], gain: 0.5, pitch: 0.02 },
    purchase: { urls: ["ui-purchase-002.ogg"], gain: 0.55, pitch: 0 },
    denied: { urls: ["ui-error-004.ogg", "ui-error-005.ogg"], gain: 0.5, pitch: 0.02 },
    // The recorded glitches sit on top of the bent synth chord, both through the bitcrusher.
    memory: { urls: range("glitch-", ["001", "002", "003", "004"]), gain: 0.6, pitch: 0.1, layerSynth: true },
    heal: { urls: ["clinic-heal-000.ogg", "clinic-heal-001.ogg"], gain: 0.4, pitch: 0.04, send: 0.35 },
    overdrive: { urls: ["cyber-overdrive.ogg"], gain: 0.35, pitch: 0.03, layerSynth: true },
  },
  footsteps: { urls: range("step-concrete-", ["000", "001", "002", "003", "004"]), gain: 0.55, pitch: 0.07 },
  rain: { url: "rain-loop.ogg", gain: 0.5, synthLevel: 0.3 },
} as const satisfies AudioSampleManifest;

const resolveSet = (set: SampleSet, base: string): SampleSet => ({ ...set, urls: set.urls.map((u) => new URL(u, base).href) });

/** The manifest with absolute URLs under `base` (e.g. `new URL("audio/", document.baseURI)`). */
export const audioSampleManifest = (base: string): AudioSampleManifest => {
  const cues: Partial<Record<AudioCue, SampleSet>> = {};
  for (const [cue, set] of Object.entries(SOUNDS.cues) as [AudioCue, SampleSet][]) cues[cue] = resolveSet(set, base);
  return {
    cues,
    footsteps: resolveSet(SOUNDS.footsteps, base),
    rain: { ...SOUNDS.rain, url: new URL(SOUNDS.rain.url, base).href },
  };
};

/** Every file the manifest names, relative to the audio folder (tests check they all exist). */
export const audioFiles = (): string[] => [
  ...Object.values(SOUNDS.cues).flatMap((s) => s.urls),
  ...SOUNDS.footsteps.urls,
  SOUNDS.rain.url,
];
