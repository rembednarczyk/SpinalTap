import { type GraphicsEffects, graphicsEffectsOf } from "@seki/engine";
import type { GraphicsUiState, SettingsVm } from "@seki/ui";

/** The settings the graphics switches follow. */
export type GraphicsSettings = Pick<SettingsVm, "quality" | "contactShade" | "bloom">;

/**
 * The switches as the options show them (graphics toggles 14.11): an effect the chosen quality
 * does not build is off and inactive; one it builds is on unless the player switched it off.
 */
export const graphicsEffectsVm = (s: GraphicsSettings): GraphicsUiState["graphicsEffects"] => {
  const built = graphicsEffectsOf(s.quality);
  return {
    contactShade: { available: built.contactShade, on: built.contactShade && s.contactShade },
    bloom: { available: built.bloom, on: built.bloom && s.bloom },
  };
};

/** What the renderer gets: the player's choices; a quality without an effect ignores its switch. */
export const graphicsEffectsOfSettings = (s: GraphicsSettings): GraphicsEffects => ({ contactShade: s.contactShade, bloom: s.bloom });
