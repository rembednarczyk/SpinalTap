import { type AudioBus, type AudioScenePort, FOV_REFERENCE_ASPECT, type InputFrame, degToRad, horizontalFovOf, isLocale, radToDeg } from "@seki/core";
import {
  type AimAssistMode,
  type AimMode,
  type CameraShoulder,
  type ColorblindMode,
  DEFAULT_SETTINGS,
  type DamageNumbersMode,
  type GraphicsQuality,
  HORIZONTAL_FOV_RANGE,
  HUD_SCALE_RANGE,
  PAD_DEADZONE_SETTING_RANGE,
  PAD_SENSITIVITY_RANGE,
  type PadCurveMode,
  SUBTITLE_SCALE_RANGE,
  type SettingsVm,
  type TouchFireMode,
  isRadioStationId,
} from "@seki/ui";

export const SETTINGS_KEY = "seki.settings.v1";

/**
 * Revision of the defaults an entry was saved under. Revision 2 (1.11) made High quality and
 * damage numbers per hit the defaults; an older entry takes them once, as if never chosen,
 * because the old defaults (Low on phones, no numbers) were saved with every change.
 */
export const SETTINGS_REV = 2;

/** Fields whose default changed in each revision; older entries drop them on load. */
const CHANGED_DEFAULTS: readonly (readonly [number, readonly string[]])[] = [[2, ["quality", "damageNumbers"]]];

const withNewDefaults = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = raw as Record<string, unknown>;
  const rev = typeof r.rev === "number" ? r.rev : 1;
  const out = { ...r };
  for (const [since, fields] of CHANGED_DEFAULTS) if (rev < since) for (const f of fields) delete out[f];
  return out;
};

/** The subset of Web Storage the settings need; lets tests pass a fake. */
export type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const isQuality = (v: unknown): v is GraphicsQuality => v === "high" || v === "medium" || v === "low";
const isAimMode = (v: unknown): v is AimMode => v === "hold" || v === "toggle";
const isShoulder = (v: unknown): v is CameraShoulder => v === "right" || v === "left";
const isDamageMode = (v: unknown): v is DamageNumbersMode => v === "off" || v === "hit" || v === "total";
const isColorblind = (v: unknown): v is ColorblindMode => v === "off" || v === "protan" || v === "deutan" || v === "tritan";
const isTouchFire = (v: unknown): v is TouchFireMode => v === "aims" || v === "separate";
const isPadCurve = (v: unknown): v is PadCurveMode => v === "linear" || v === "classic" || v === "precise";
const isAimAssist = (v: unknown): v is AimAssistMode => v === "off" || v === "light" || v === "standard";
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);

/** The vertical field of view entries saved before ADR-0049 held by default, degrees. */
const LEGACY_DEFAULT_FOV = 62;

/**
 * Horizontal field of view of an entry (ADR-0049). Entries saved before it hold `fov`, the
 * vertical degrees: the untouched default becomes the new default, a value someone chose keeps
 * its width on a 16:9 screen.
 */
const horizontalFovOf16x9 = (r: Record<string, unknown>): unknown => {
  if (r.horizontalFov !== undefined || typeof r.fov !== "number" || !Number.isFinite(r.fov)) return r.horizontalFov;
  if (Math.round(r.fov) === LEGACY_DEFAULT_FOV) return undefined;
  return radToDeg(horizontalFovOf(degToRad(r.fov), FOV_REFERENCE_ASPECT));
};

/** Clamps a field of view request to the allowed horizontal degrees. */
export const clampFieldOfView = (degrees: unknown, fallback: number = DEFAULT_SETTINGS.horizontalFov): number =>
  Math.round(clamp(degrees, HORIZONTAL_FOV_RANGE[0], HORIZONTAL_FOV_RANGE[1], fallback));

/** Only string lists of at most three codes per action survive. */
const sanitizeBindings = (raw: unknown): Record<string, readonly string[]> => {
  if (typeof raw !== "object" || raw === null) return {};
  const out: Record<string, readonly string[]> = {};
  for (const [action, codes] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(codes) && codes.length <= 3 && codes.every((c) => typeof c === "string" && c.length > 0 && c.length < 32)) out[action] = codes as string[];
  }
  return out;
};

/** Fills gaps and clamps ranges, so a hand-edited or old entry never breaks the game. */
export const sanitizeSettings = (raw: unknown, defaults: SettingsVm = DEFAULT_SETTINGS): SettingsVm => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    quality: isQuality(r.quality) ? r.quality : defaults.quality,
    aimMode: isAimMode(r.aimMode) ? r.aimMode : defaults.aimMode,
    crouchMode: isAimMode(r.crouchMode) ? r.crouchMode : defaults.crouchMode,
    sprintMode: isAimMode(r.sprintMode) ? r.sprintMode : defaults.sprintMode,
    // G-275: entries saved before the setting look over the right shoulder.
    shoulder: isShoulder(r.shoulder) ? r.shoulder : defaults.shoulder,
    mouseSensitivity: clamp(r.mouseSensitivity, 0.2, 3, defaults.mouseSensitivity),
    adsSensitivity: clamp(r.adsSensitivity, 0.3, 2, defaults.adsSensitivity),
    invertY: typeof r.invertY === "boolean" ? r.invertY : defaults.invertY,
    touchSensitivity: clamp(r.touchSensitivity, 0.2, 3, defaults.touchSensitivity),
    // ADR-0072: a new field with no default changed, so SETTINGS_REV stays; old entries aim with fire.
    touchFire: isTouchFire(r.touchFire) ? r.touchFire : defaults.touchFire,
    // ADR-0072 stage 4: new fields, so SETTINGS_REV stays; old entries get the radial dead zone,
    // the classic curve and the pad's own sensitivity at 1 instead of the mouse's or the touch one.
    padSensitivity: clamp(r.padSensitivity, PAD_SENSITIVITY_RANGE[0], PAD_SENSITIVITY_RANGE[1], defaults.padSensitivity),
    padDeadzone: Math.round(clamp(r.padDeadzone, PAD_DEADZONE_SETTING_RANGE[0], PAD_DEADZONE_SETTING_RANGE[1], defaults.padDeadzone) * 100) / 100,
    padCurve: isPadCurve(r.padCurve) ? r.padCurve : defaults.padCurve,
    // ADR-0072 stage 3: old entries take the standard assist; no default changed, so SETTINGS_REV stays.
    aimAssist: isAimAssist(r.aimAssist) ? r.aimAssist : defaults.aimAssist,
    horizontalFov: clampFieldOfView(horizontalFovOf16x9(r), defaults.horizontalFov),
    volume: clamp(r.volume, 0, 1, defaults.volume),
    musicVolume: clamp(r.musicVolume, 0, 1, defaults.musicVolume),
    sfxVolume: clamp(r.sfxVolume, 0, 1, defaults.sfxVolume),
    ambienceVolume: clamp(r.ambienceVolume, 0, 1, defaults.ambienceVolume),
    // ADR-0060 stage 1: new fields, so SETTINGS_REV stays. Spoken lines start at full volume;
    // the radio, which played on the music bus, keeps the level an old entry chose for music.
    dialogueVolume: clamp(r.dialogueVolume, 0, 1, defaults.dialogueVolume),
    radioVolume: clamp(r.radioVolume, 0, 1, r.radioVolume === undefined ? clamp(r.musicVolume, 0, 1, defaults.radioVolume) : defaults.radioVolume),
    bindings: sanitizeBindings(r.bindings),
    hints: typeof r.hints === "boolean" ? r.hints : defaults.hints,
    // Entries saved before autosave existed keep it on.
    autosave: bool(r.autosave, defaults.autosave),
    // Wave 1 (ADR-0028): entries saved before these fields existed take the defaults.
    hudAlwaysShow: bool(r.hudAlwaysShow, defaults.hudAlwaysShow),
    damageNumbers: isDamageMode(r.damageNumbers) ? r.damageNumbers : defaults.damageNumbers,
    hudScale: Math.round(clamp(r.hudScale, HUD_SCALE_RANGE[0], HUD_SCALE_RANGE[1], defaults.hudScale) * 20) / 20,
    subtitleScale: Math.round(clamp(r.subtitleScale, SUBTITLE_SCALE_RANGE[0], SUBTITLE_SCALE_RANGE[1], defaults.subtitleScale) * 10) / 10,
    subtitleBackground: bool(r.subtitleBackground, defaults.subtitleBackground),
    legibleFont: bool(r.legibleFont, defaults.legibleFont),
    reduceFlashes: bool(r.reduceFlashes, defaults.reduceFlashes),
    cameraMotion: bool(r.cameraMotion, defaults.cameraMotion),
    untimedBreach: bool(r.untimedBreach, defaults.untimedBreach),
    colorblind: isColorblind(r.colorblind) ? r.colorblind : defaults.colorblind,
    // Wave 2 (ADR-0035).
    radioStation: r.radioStation === null || isRadioStationId(r.radioStation) ? r.radioStation : defaults.radioStation,
    mapMarkers: bool(r.mapMarkers, defaults.mapMarkers),
    highlights: bool(r.highlights, defaults.highlights),
    // ADR-0056: entries saved before the language setting take the default, English.
    locale: isLocale(r.locale) ? r.locale : defaults.locale,
  };
};

/** Reads saved settings. Storage can be missing or throw (private mode, blocked cookies). */
export const loadSettings = (storage: SettingsStorage | null, defaults: SettingsVm = DEFAULT_SETTINGS): SettingsVm => {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return raw ? sanitizeSettings(withNewDefaults(JSON.parse(raw)), defaults) : defaults;
  } catch {
    return defaults;
  }
};

/** Returns false when the browser refused to store them; the game keeps them for this session. */
export const saveSettings = (storage: SettingsStorage | null, settings: SettingsVm): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, rev: SETTINGS_REV }));
    return true;
  } catch {
    return false;
  }
};

/** Scales look deltas (and flips the pitch for an inverted Y); movement and buttons pass through untouched. */
export const scaleLook = (frame: InputFrame, factor: number, invertY = false): InputFrame =>
  (factor === 1 && !invertY) || (frame.lookYaw === 0 && frame.lookPitch === 0)
    ? frame
    : { ...frame, lookYaw: frame.lookYaw * factor, lookPitch: frame.lookPitch * factor * (invertY ? -1 : 1) };

/**
 * The accessibility flag the engine reads (ADR-0028): "reduce flashes and glitch" turns off
 * aberration, glitch and flicker. The renderer does not take it yet; once it has
 * `setReduceFlashes`, this hands it over with no change here.
 */
export interface EffectsTarget {
  setReduceFlashes?(on: boolean): void;
  /** Proposed render contract (ADR-0035): outlines of interactive objects on or off. */
  setHighlights?(on: boolean): void;
}

export const applyEffects = (target: object, settings: Pick<SettingsVm, "reduceFlashes"> & Partial<Pick<SettingsVm, "highlights">>): void => {
  (target as EffectsTarget).setReduceFlashes?.(settings.reduceFlashes);
  if (settings.highlights !== undefined) (target as EffectsTarget).setHighlights?.(settings.highlights);
};

/** Setting of each mix bus (ADR-0060 stage 1). */
export const VOLUME_SETTINGS = {
  master: "volume",
  music: "musicVolume",
  sfx: "sfxVolume",
  ambience: "ambienceVolume",
  dialogue: "dialogueVolume",
  radio: "radioVolume",
} as const satisfies Record<AudioBus, keyof SettingsVm>;

export type VolumeSettings = Pick<SettingsVm, (typeof VOLUME_SETTINGS)[AudioBus]>;

/** The volumes of the settings on the mix (master and the buses, ADR-0060 stage 1). */
export const applyVolumes = (audio: Pick<AudioScenePort, "setVolume">, s: VolumeSettings): void => {
  for (const [bus, key] of Object.entries(VOLUME_SETTINGS) as [AudioBus, keyof VolumeSettings][]) audio.setVolume(bus, s[key]);
};

/** True when any bus volume differs between the two settings. */
export const volumesDiffer = (a: VolumeSettings, b: VolumeSettings): boolean => Object.values(VOLUME_SETTINGS).some((k) => a[k] !== b[k]);

/** Settings that the running game cannot change on the fly. */
/** Only the graphics quality needs a reload; volume and sensitivity apply at once. */
export const needsReload = (applied: SettingsVm, current: SettingsVm): boolean => applied.quality !== current.quality;

export const HINTS_KEY = "seki.hints.v1";

/** Ids of the first-run hints already seen; empty when storage is missing or broken. */
export const loadHintsSeen = (storage: SettingsStorage | null): string[] => {
  try {
    const raw = JSON.parse(storage?.getItem(HINTS_KEY) ?? "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const saveHintsSeen = (storage: SettingsStorage | null, seen: readonly string[]): void => {
  try {
    storage?.setItem(HINTS_KEY, JSON.stringify(seen));
  } catch {
    // The hints come back next time; nothing else depends on them.
  }
};
