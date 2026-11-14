import { type RenderQuality, qualityTier } from "./quality";

/**
 * Effects of the High quality the player can switch off in the options, to see what weighs on
 * the frame (graphics toggles 14.11). Both apply at once, without a reload.
 */
export interface GraphicsEffects {
  /** Contact shade in front of the line art (graphics backlog 13.11, step 2). */
  readonly contactShade: boolean;
  /** Bloom over the brightest pixels (graphics backlog 13.11, step 3). */
  readonly bloom: boolean;
}

/** Which of the effects a quality builds at all: only these can be switched. */
export const graphicsEffectsOf = (quality: RenderQuality | undefined): GraphicsEffects => {
  const tier = qualityTier(quality);
  return { contactShade: tier.contactShade, bloom: tier.bloom > 0 };
};
