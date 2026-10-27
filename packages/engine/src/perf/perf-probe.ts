import { type Engine, type Scene, SceneInstrumentation } from "../babylon";

export interface PerfSample {
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly drawCalls: number;
  readonly activeMeshes: number;
  readonly totalMeshes: number;
  readonly materials: number;
  readonly particles: number;
}

/** Reads Babylon's instrumentation. The numbers feed the CI perf budget check. */
export class PerfProbe {
  private readonly instrumentation: SceneInstrumentation;

  constructor(
    private readonly engine: Engine,
    private readonly scene: Scene,
  ) {
    this.instrumentation = new SceneInstrumentation(scene);
    this.instrumentation.captureFrameTime = true;
  }

  sample(): PerfSample {
    return {
      fps: Math.round(this.engine.getFps()),
      frameTimeMs: Math.round(this.instrumentation.frameTimeCounter.lastSecAverage * 100) / 100,
      drawCalls: this.instrumentation.drawCallsCounter.current,
      activeMeshes: this.scene.getActiveMeshes().length,
      totalMeshes: this.scene.meshes.length,
      materials: this.scene.materials.length,
      particles: this.scene.particleSystems.reduce((n, ps) => n + ps.getActiveCount(), 0),
    };
  }
}
