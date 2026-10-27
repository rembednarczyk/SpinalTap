import type { InputFrame } from "@seki/core";
import { DEFAULT_SETTINGS, type GraphicsQuality, type SettingsVm } from "@seki/ui";

export const SETTINGS_KEY = "seki.settings.v1";

/** The subset of Web Storage the settings need; lets tests pass a fake. */
export type SettingsStorage = Pick<Storage, "getItem" | "setItem">;

const clamp = (v: unknown, min: number, max: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const isQuality = (v: unknown): v is GraphicsQuality => v === "high" || v === "low";

/** Fills gaps and clamps ranges, so a hand-edited or old entry never breaks the game. */
export const sanitizeSettings = (raw: unknown, defaults: SettingsVm = DEFAULT_SETTINGS): SettingsVm => {
  const r = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    quality: isQuality(r.quality) ? r.quality : defaults.quality,
    mouseSensitivity: clamp(r.mouseSensitivity, 0.2, 3, defaults.mouseSensitivity),
    touchSensitivity: clamp(r.touchSensitivity, 0.2, 3, defaults.touchSensitivity),
    volume: clamp(r.volume, 0, 1, defaults.volume),
  };
};

/** Reads saved settings. Storage can be missing or throw (private mode, blocked cookies). */
export const loadSettings = (storage: SettingsStorage | null, defaults: SettingsVm = DEFAULT_SETTINGS): SettingsVm => {
  try {
    const raw = storage?.getItem(SETTINGS_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw), defaults) : defaults;
  } catch {
    return defaults;
  }
};

/** Returns false when the browser refused to store them; the game keeps them for this session. */
export const saveSettings = (storage: SettingsStorage | null, settings: SettingsVm): boolean => {
  try {
    if (!storage) return false;
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
};

/** Scales look deltas; movement and buttons pass through untouched. */
export const scaleLook = (frame: InputFrame, factor: number): InputFrame =>
  factor === 1 || (frame.lookYaw === 0 && frame.lookPitch === 0) ? frame : { ...frame, lookYaw: frame.lookYaw * factor, lookPitch: frame.lookPitch * factor };

/** Settings that the running game cannot change on the fly. */
export const needsReload = (applied: SettingsVm, current: SettingsVm): boolean => applied.quality !== current.quality || applied.volume !== current.volume;
