import type { PresetName } from "./presets";

/** Render quality (ADR-0036): phones take "low", mid laptops "medium", desktops "high". */
export type RenderQuality = "high" | "medium" | "low";

/**
 * Wet asphalt per quality (ADR-0036):
 * - low: the puddle mask and the reflection strips under lamps and signs (ADR-0030), nothing more;
 * - medium: plus a static reflection probe, a small cube of the neon, signs, far city and sky,
 *   rendered once when a district comes in and sampled by the wet surfaces in cel steps;
 * - high: the same probe at a higher resolution. Screen-space reflections stay off: Babylon's
 *   SSR reads reflectivity from the geometry buffer, which only standard and PBR materials
 *   write, so the toon materials would need a second G-buffer pass of their own (see the ADR).
 */
export interface QualityTier {
  /** Moon shadow map size. */
  readonly shadowMap: number;
  /** Screen-space ink lines from the geometry buffer. */
  readonly lineArt: boolean;
  /** Rain splashes on the ground. */
  readonly splashes: boolean;
  /** Cube size of the static wet-asphalt probe, or null for strips only. */
  readonly wetProbe: number | null;
  /** The character preview redraws every frame. */
  readonly livePreview: boolean;
}

export const QUALITY_TIERS: Readonly<Record<RenderQuality, QualityTier>> = {
  low: { shadowMap: 1024, lineArt: false, splashes: false, wetProbe: null, livePreview: false },
  medium: { shadowMap: 1024, lineArt: true, splashes: false, wetProbe: 128, livePreview: true },
  high: { shadowMap: 2048, lineArt: true, splashes: true, wetProbe: 256, livePreview: true },
};

export const qualityTier = (q: RenderQuality | undefined): QualityTier => QUALITY_TIERS[q ?? "high"];

/** Surfaces that hold water and sample the probe: the road, puddles, the harbour, wet dressing. */
export const WET_PRESETS: ReadonlySet<PresetName> = new Set<PresetName>(["asphalt", "puddle", "water", "dressing", "mapGround"]);
