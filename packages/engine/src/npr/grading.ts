import { Color4, ColorCurves, type Camera, DefaultRenderingPipeline, type Scene } from "../babylon";

/**
 * Post-process colour grading towards a muted, slightly washed-out teal palette, plus the
 * knobs the memory-glitch effect animates (chromatic aberration, grain).
 */
export class Grading {
  readonly pipeline: DefaultRenderingPipeline;
  private glitchTime = 0;
  private static readonly GLITCH_DURATION = 1.4;
  private readonly curves: ColorCurves;
  /** 0..1 blend towards the overdrive look. */
  private overdrive = 0;
  private overdriveTarget = 0;
  private pulseTime = 0;

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
    this.curves = curves;
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

  /** Reflex overdrive: drained colour, cold tint, fringing at the edges. */
  setOverdrive(active: boolean): void {
    this.overdriveTarget = active ? 1 : 0;
  }

  /** Short bright pulse (medkit). */
  pulse(): void {
    this.pulseTime = 0.35;
  }

  update(dt: number): void {
    this.overdrive += Math.sign(this.overdriveTarget - this.overdrive) * Math.min(Math.abs(this.overdriveTarget - this.overdrive), dt * 4);
    this.pulseTime = Math.max(0, this.pulseTime - dt);
    this.glitchTime = Math.max(0, this.glitchTime - dt);
    const t = this.glitchTime / Grading.GLITCH_DURATION;
    const glitch = this.glitchTime > 0 ? Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.sin(t * 60)) : 0;
    const od = this.overdrive;
    this.curves.globalSaturation = -18 - 55 * od;
    this.curves.globalHue = 200;
    this.curves.globalDensity = 30 * od;
    this.pipeline.chromaticAberration.aberrationAmount = 70 * glitch + 10 * od;
    this.pipeline.grain.intensity = 6 + 40 * glitch;
    this.pipeline.imageProcessing.exposure = 1.08 + 0.35 * glitch + this.pulseTime * 0.8;
  }
}
