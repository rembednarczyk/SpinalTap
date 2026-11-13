/**
 * Multisampling of the rendered frame (graphics backlog 13.11, step 1).
 *
 * With post-processes on the camera Babylon renders the scene into the first post-process's
 * texture, not into the canvas, so the canvas's `antialias` flag never shows. Multisampling that
 * first texture is what smooths the edges of geometry; the screen-space ink lines are drawn later
 * from the geometry buffer and stay with FXAA and the sharpening after it.
 */

/** The part of a post-process this needs: its sample count. */
export interface Multisampled {
  samples: number;
}

/** Samples to ask for: the tier's wish, within what the GPU allows, never below 1. */
export const msaaSamples = (wanted: number, gpuMax: number | undefined): number => Math.max(1, Math.min(wanted, gpuMax ?? 1));

/**
 * Multisamples the first post-process on the camera (the one the scene renders into). Returns the
 * samples set, or 1 when nothing was changed.
 */
export const applyMsaa = (chain: readonly (Multisampled | null | undefined)[], wanted: number, gpuMax: number | undefined): number => {
  const samples = msaaSamples(wanted, gpuMax);
  const first = chain.find((p): p is Multisampled => p != null);
  if (!first || samples <= 1) return 1;
  first.samples = samples;
  return samples;
};
