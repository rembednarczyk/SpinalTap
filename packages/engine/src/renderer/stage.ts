import { Color4, Engine, GlowLayer, Scene } from "../babylon";
import type { RenderQuality } from "../npr/quality";

export type { RenderQuality } from "../npr/quality";

export interface StageOptions {
  /** Reference mode: deterministic frame for snapshot tests (no rain, no grain, fixed camera). */
  readonly reference: boolean;
  /**
   * "low" trims the expensive passes (smaller shadow map, no screen-space line art) for phones;
   * "medium" keeps the line art and adds the wet-asphalt probe at a smaller size (ADR-0036).
   */
  readonly quality?: RenderQuality;
}


/** Engine + scene + glow layer. WebGL2 baseline (ADR-0004). */
export class Stage {
  readonly engine: Engine;
  readonly scene: Scene;
  readonly glow: GlowLayer;

  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly options: StageOptions,
  ) {
    const low = options.quality === "low";
    this.engine = new Engine(canvas, !low, { preserveDrawingBuffer: true, stencil: true, antialias: !low }, true);
    // Phones report device pixel ratios of 2-3; cap the render resolution on low quality.
    if (low) this.engine.setHardwareScalingLevel(Math.max(1, (window.devicePixelRatio || 1) / 1.25));
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.06, 0.09, 0.12, 1);
    this.scene.skipPointerMovePicking = true;
    this.glow = new GlowLayer("glow", this.scene, { mainTextureSamples: 2, blurKernelSize: 40 });
    this.glow.intensity = 0.85;
    window.addEventListener("resize", () => this.engine.resize());
  }

  dispose(): void {
    this.scene.dispose();
    this.engine.dispose();
  }
}
