import type { ControlBindingVm, SettingsVm } from "./ui-vm";

/** Settings and key bindings. Written by the settings controller. */
export interface SettingsUiState {
  readonly settings: SettingsVm;
  /** Remappable controls with their current keys, for the settings and the help screen. */
  readonly controls: readonly ControlBindingVm[];
  /** True when a saved setting only takes effect after the page is reloaded. */
  readonly reloadNeeded: boolean;
}

/** The High effects the player can switch off to see what weighs on the frame (graphics toggles 14.11). */
export type GraphicsEffectId = "contactShade" | "bloom";

export const GRAPHICS_EFFECTS: readonly GraphicsEffectId[] = ["contactShade", "bloom"];

/** One switchable effect as the options show it. */
export interface GraphicsEffectVm {
  /** The chosen quality has the effect; without it the switch is off and inactive. */
  readonly available: boolean;
  /** The effect draws: available and not switched off by the player. */
  readonly on: boolean;
}

/** The graphics switches. Written by the app's graphics effects controller. */
export interface GraphicsUiState {
  readonly graphicsEffects: Readonly<Record<GraphicsEffectId, GraphicsEffectVm>>;
}

/** High by default, so both effects draw. */
export const DEFAULT_GRAPHICS: GraphicsUiState = {
  graphicsEffects: { contactShade: { available: true, on: true }, bloom: { available: true, on: true } },
};
