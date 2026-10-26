import { Color4, ColorCurves, type Camera, DefaultRenderingPipeline, type Scene } from "../babylon";

/**
 * Post-process colour grading towards a muted, slightly washed-out teal palette, plus the
 * knobs the memory-glitch effect animates (chromatic aberration, grain).
 */
export class Grading {
  readonly pipeline: DefaultRenderingPipeline;
  private glitchTime = 0;
  private static readonly GLITCH_DURATION = 1.4;

  constructor(scene: Scene, camera: Camera, options: { reference: boolean }) {
    const p = new DefaultRenderingPipeline("grading", false, scene, [camera]);
    p.fxaaEnabled = true;
    p.imageProcessingEnabled = true;
    const ip = p.imageProcessing;
    ip.contrast = 1.18;
    ip.exposure = 1.08;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 2.2;
    ip.vignetteColor = new Color4(0.02, 0.05, 0.08, 0);
    ip.colorCurvesEnabled = true;
    const curves = new ColorCurves();
    curves.globalSaturation = -18;
    curves.shadowsHue = 195;
    curves.shadowsDensity = 35;
    curves.shadowsSaturation = 25;
    curves.highlightsHue = 35;
    curves.highlightsDensity = 12;
    curves.highlightsSaturation = 10;
    ip.colorCurves = curves;
    p.chromaticAberrationEnabled = true;
    p.chromaticAberration.aberrationAmount = 0;
    p.grainEnabled = !options.reference;
    p.grain.intensity = 6;
    p.grain.animated = !options.reference;
    this.pipeline = p;
  }

  glitch(): void {
    this.glitchTime = Grading.GLITCH_DURATION;
  }

  update(dt: number): void {
    if (this.glitchTime <= 0) return;
    this.glitchTime = Math.max(0, this.glitchTime - dt);
    const t = this.glitchTime / Grading.GLITCH_DURATION;
    const pulse = Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(t * 60));
    this.pipeline.chromaticAberration.aberrationAmount = 70 * pulse;
    this.pipeline.grain.intensity = 6 + 40 * pulse;
    this.pipeline.imageProcessing.exposure = 1.08 + 0.35 * pulse;
  }
}
