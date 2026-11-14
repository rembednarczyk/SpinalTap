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
  /**
   * Character model files in memory at once (ADR-0076 §4, stage 4b): about 45 MiB of textures a
   * VRoid file, so a phone keeps 5 (about 225 MiB) and a computer 11 (about 500 MiB). Over it the
   * file unused longest, outside the donors, goes.
   */
  readonly modelFiles: number;
  /**
   * Multisampling of the frame the post-process chain starts from (graphics backlog 13.11, step 1).
   * The canvas's own antialiasing never reaches the screen, because the scene renders into the first
   * post-process's texture; 1 leaves the edges to FXAA alone.
   */
  readonly msaa: number;
  /** Sharpening after FXAA, 0 off: it gives back the crispness FXAA takes from the ink lines. */
  readonly sharpen: number;
  /** Contact shade in the line-art pass (graphics backlog 13.11, step 2). */
  readonly contactShade: boolean;
}

export const QUALITY_TIERS: Readonly<Record<RenderQuality, QualityTier>> = {
  low: { shadowMap: 1024, lineArt: false, splashes: false, wetProbe: null, livePreview: false, modelFiles: 5, msaa: 1, sharpen: 0, contactShade: false },
  medium: { shadowMap: 1024, lineArt: true, splashes: false, wetProbe: 128, livePreview: true, modelFiles: 11, msaa: 2, sharpen: 0, contactShade: false },
  high: { shadowMap: 2048, lineArt: true, splashes: true, wetProbe: 256, livePreview: true, modelFiles: 11, msaa: 2, sharpen: 0.25, contactShade: true },
};

export const qualityTier = (q: RenderQuality | undefined): QualityTier => QUALITY_TIERS[q ?? "high"];

/** Surfaces that hold water and sample the probe: the road, puddles, the harbour, wet dressing. */
export const WET_PRESETS: ReadonlySet<PresetName> = new Set<PresetName>(["asphalt", "puddle", "water", "dressing", "mapGround"]);
