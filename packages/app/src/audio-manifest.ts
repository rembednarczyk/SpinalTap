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
    // One recorded set per weapon kind (Free Firearm Sound Library, 14.11): near for the player, mid for others.
    shot: { urls: ["gun-pistol-ppq-near.ogg", "gun-pistol-1911-near.ogg"], gain: 0.55, pitch: 0.05, send: 0.55 },
    "shot-revolver": { urls: ["gun-revolver-642-near.ogg"], gain: 0.6, pitch: 0.04, send: 0.6 },
    "shot-smg": { urls: ["gun-smg-m45-near.ogg", "gun-smg-ppsh-near.ogg"], gain: 0.5, pitch: 0.05, send: 0.5 },
    "shot-shotgun": { urls: ["gun-shotgun-nova-near.ogg", "gun-shotgun-model12-near.ogg"], gain: 0.6, pitch: 0.04, send: 0.65 },
    "shot-rifle": { urls: ["gun-rifle-ar15-near.ogg", "gun-rifle-ak47-near.ogg"], gain: 0.55, pitch: 0.04, send: 0.6 },
    "enemy-shot": { urls: ["gun-pistol-ppq-mid.ogg", "gun-smg-m45-mid.ogg"], gain: 0.32, pitch: 0.06, send: 0.85 },
    "enemy-shot-shotgun": { urls: ["gun-shotgun-nova-mid.ogg"], gain: 0.34, pitch: 0.05, send: 0.85 },
    "enemy-shot-rifle": { urls: ["gun-rifle-ar15-mid.ogg", "gun-rifle-sks-mid.ogg"], gain: 0.32, pitch: 0.05, send: 0.85 },
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
    // Weapons, loot and trade (E12).
    // Magazine out, magazine in, slide racked (1.4 s); a per-round reload clicks a shell in.
    reload: { urls: ["reload-handgun-000.ogg"], gain: 0.6, pitch: 0.04, send: 0.15 },
    // One shell pushed into the tube, recorded on a real shotgun (zer0_sol, 21.11): the fingers on the
    // brass, then the follower's click 0.48 s on, as the round's 0.5 s ends. Four takes, no metal tap.
    "reload-round": { urls: range("reload-shell-", ["000", "001", "002", "003"]), gain: 0.8, pitch: 0.03, send: 0.12 },
    // The pump racked after the last shell, back and forth in one recorded stroke (zer0_sol, 21.11).
    "shotgun-pump": { urls: ["shotgun-rack-000.ogg"], gain: 0.65, pitch: 0.03, send: 0.18 },
    "weapon-switch": { urls: range("weapon-switch-", ["000", "001"]), gain: 0.4, pitch: 0.06, send: 0.1 },
    // Each weapon's own handling as it comes out (user notes of 21.11, sources in README): a pistol's slide,
    // a revolver's hammer, an SMG's bolt, a shotgun's pump, a rifle's charging handle; a baton and a blade out of the sheath.
    "draw-pistol": { urls: ["draw-pistol-000.ogg"], gain: 0.5, pitch: 0.04, send: 0.1 },
    "draw-revolver": { urls: ["draw-revolver-000.ogg"], gain: 0.5, pitch: 0.04, send: 0.1 },
    "draw-smg": { urls: ["draw-smg-000.ogg"], gain: 0.45, pitch: 0.04, send: 0.1 },
    "draw-shotgun": { urls: ["draw-shotgun-000.ogg"], gain: 0.5, pitch: 0.03, send: 0.12 },
    "draw-rifle": { urls: ["draw-rifle-000.ogg"], gain: 0.5, pitch: 0.03, send: 0.12 },
    "draw-baton": { urls: ["draw-baton-000.ogg"], gain: 0.55, pitch: 0.05, send: 0.1 },
    "draw-blade": { urls: range("draw-blade-", ["000", "001"]), gain: 0.5, pitch: 0.04, send: 0.2 },
    holster: { urls: range("holster-", ["000", "001"]), gain: 0.5, pitch: 0.05, send: 0.05 },
    "loot-pickup": { urls: range("loot-pickup-", ["000", "001"]), gain: 0.55, pitch: 0.08 },
    // The tin clink sits on the synth's coin triad.
    sell: { urls: range("sell-tin-", ["000", "001"]), gain: 0.45, pitch: 0.05, layerSynth: true },
    repair: { urls: range("repair-hammer-", ["000", "001"]), gain: 0.45, pitch: 0.05, send: 0.2 },
    // W-3's charges (ADR-0082 stage 3c): the recorded crunch over the synth's low boom and rumble.
    explosion: { urls: range("blast-crunch-", ["003", "004"]), gain: 0.75, pitch: 0.04, send: 0.8, layerSynth: true },
    // Recorded in place of the synth (user's request of 18.11: no procedural sounds where a recording fits).
    // Melee (ADR-0019): a blade's swish, the knock of a blow, a pan's clang on a guard; a parry keeps the synth's ring.
    "impact-melee": { urls: ["impact-melee-000.ogg"], gain: 0.5, pitch: 0.08, send: 0.15 },
    swing: { urls: range("swing-", ["000", "001"]), gain: 0.35, pitch: 0.08, send: 0.1 },
    block: { urls: ["block-000.ogg"], gain: 0.45, pitch: 0.06, send: 0.3 },
    parry: { urls: ["parry-000.ogg"], gain: 0.45, pitch: 0.04, send: 0.45, layerSynth: true },
    // Jumps and landings (ADR-0021): cloth on take-off, a step and a bag's drop over the synth's low thud.
    jump: { urls: range("jump-cloth-", ["000", "001"]), gain: 0.3, pitch: 0.08, send: 0.05 },
    land: { urls: range("land-step-", ["000", "001"]), gain: 0.4, pitch: 0.08, send: 0.1, layerSynth: true },
    "land-hard": { urls: ["land-hard-000.ogg"], gain: 0.6, pitch: 0.05, send: 0.25, layerSynth: true },
    // W-3 (ADR-0082): the charge's clamp over the synth's arming beeps, the alarm's two-tone klaxon, one wail of the siren.
    "charge-plant": { urls: ["charge-clamp-000.ogg"], gain: 0.5, pitch: 0.03, send: 0.35, layerSynth: true },
    alarm: { urls: ["alarm-klaxon-000.ogg"], gain: 0.35, pitch: 0, send: 0.6 },
    // Cars (ADR-0050, ADR-0097): a real horn for the street's and her own, her car's doors and its engine started and stopped.
    horn: { urls: ["car-horn-000.ogg"], gain: 0.4, pitch: 0.03, send: 0.45 },
    "car-door-open": { urls: ["car-door-open-000.ogg"], gain: 0.6, pitch: 0.04, send: 0.1 },
    "car-door-close": { urls: ["car-door-close-000.ogg"], gain: 0.5, pitch: 0.04, send: 0.2 },
    "engine-start": { urls: ["engine-start-000.ogg"], gain: 0.45, pitch: 0.02, send: 0.15 },
    "engine-stop": { urls: ["engine-stop-000.ogg"], gain: 0.5, pitch: 0.02, send: 0.15 },
    "alarm-siren": { urls: ["alarm-siren-000.ogg"], gain: 0.3, pitch: 0, send: 0.7 },
  },
  footsteps: { urls: range("step-concrete-", ["000", "001", "002", "003", "004"]), gain: 0.55, pitch: 0.07 },
  rain: { url: "rain-loop.ogg", gain: 0.5, synthLevel: 0.3 },
  engine: { url: "engine-loop-000.ogg", gain: 0.35 },
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
    engine: { ...SOUNDS.engine, url: new URL(SOUNDS.engine.url, base).href },
  };
};

/** Every file the manifest names, relative to the audio folder (tests check they all exist). */
export const audioFiles = (): string[] => [
  ...Object.values(SOUNDS.cues).flatMap((s) => s.urls),
  ...SOUNDS.footsteps.urls,
  SOUNDS.rain.url,
  SOUNDS.engine.url,
];
