import { Color4, ColorCurves, type Camera, DefaultRenderingPipeline, type Scene } from "../babylon";
import { FlashLimiter } from "../effects/flash-limiter";
import { DISTRICT_PALETTES, type DistrictPalette } from "./district-palette";

/** Wobble of the memory glitch, cycles per second: under the three-flashes-a-second ceiling. */
export const GLITCH_WOBBLE_HZ = 2.5;

/**
 * Post-process colour grading: the district's colour script (ADR-0030) through ColorCurves,
 * plus the knobs the memory-glitch effect animates (chromatic aberration, grain).
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
  private pulseScale = 1;
  /** The running glitch may brighten the frame (it got a flash from the limiter). */
  private glitchFlash = true;
  private reduce = false;
  private palette: DistrictPalette = DISTRICT_PALETTES["shinsekai-7"];

  constructor(
    scene: Scene,
    camera: Camera,
    options: { reference: boolean },
    private readonly limiter: FlashLimiter = new FlashLimiter(),
  ) {
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
    ip.colorCurves = curves;
    this.curves = curves;
    this.setPalette(this.palette);
    p.chromaticAberrationEnabled = true;
    p.chromaticAberration.aberrationAmount = 0;
    p.grainEnabled = !options.reference;
    p.grain.intensity = 6;
    p.grain.animated = !options.reference;
    this.pipeline = p;
  }

  glitch(): void {
    this.glitchTime = Grading.GLITCH_DURATION;
    // Over the flash budget the glitch still plays, without brightening the frame.
    this.glitchFlash = !this.reduce && this.limiter.tryFlash();
  }

  /** The district's tones and saturation (the renderer blends them). */
  setPalette(p: DistrictPalette): void {
    this.palette = p;
    const c = this.curves;
    c.shadowsHue = p.shadows.hue;
    c.shadowsDensity = p.shadows.density;
    c.shadowsSaturation = p.shadows.saturation;
    c.highlightsHue = p.highlights.hue;
    c.highlightsDensity = p.highlights.density;
    c.highlightsSaturation = p.highlights.saturation;
    c.globalSaturation = p.saturation - 55 * this.overdrive;
  }

  /** Accessibility (ADR-0028): no aberration, no brightening glitch, a softer heal pulse. */
  setReduceFlashes(on: boolean): void {
    this.reduce = on;
  }

  /** Reflex overdrive: drained colour, cold tint, fringing at the edges. */
  setOverdrive(active: boolean): void {
    this.overdriveTarget = active ? 1 : 0;
  }

  /** Short bright pulse (medkit). */
  pulse(): void {
    this.pulseTime = 0.35;
    this.pulseScale = this.reduce || !this.limiter.tryFlash() ? 0.3 : 1;
  }

  update(dt: number): void {
    this.overdrive += Math.sign(this.overdriveTarget - this.overdrive) * Math.min(Math.abs(this.overdriveTarget - this.overdrive), dt * 4);
    this.pulseTime = Math.max(0, this.pulseTime - dt);
    this.glitchTime = Math.max(0, this.glitchTime - dt);
    const t = this.glitchTime / Grading.GLITCH_DURATION;
    const elapsed = Grading.GLITCH_DURATION - this.glitchTime;
    // The wobble stays under three cycles a second; reduced flashes keep only the slow swell.
    const wobble = this.reduce ? 1 : 0.6 + 0.4 * Math.sin(elapsed * Math.PI * 2 * GLITCH_WOBBLE_HZ);
    const glitch = this.glitchTime > 0 ? Math.sin(t * Math.PI) * wobble : 0;
    const od = this.overdrive;
    this.curves.globalSaturation = this.palette.saturation - 55 * od;
    this.curves.globalHue = 200;
    this.curves.globalDensity = 30 * od;
    this.pipeline.chromaticAberration.aberrationAmount = this.reduce ? 0 : 70 * glitch + 10 * od;
    this.pipeline.grain.intensity = 6 + (this.reduce ? 12 : 40) * glitch;
    const brighten = this.glitchFlash && !this.reduce ? 0.35 * glitch : 0;
    this.pipeline.imageProcessing.exposure = 1.08 + brighten + this.pulseTime * 0.8 * this.pulseScale;
  }
}
