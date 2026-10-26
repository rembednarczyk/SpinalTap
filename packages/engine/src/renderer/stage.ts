import { Color4, Engine, GlowLayer, Scene } from "../babylon";

export interface StageOptions {
  /** Reference mode: deterministic frame for snapshot tests (no rain, no grain, fixed camera). */
  readonly reference: boolean;
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
    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, true);
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
