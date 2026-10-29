import { type Engine, type Scene, SceneInstrumentation } from "../babylon";

export interface PerfSample {
  readonly fps: number;
  readonly frameTimeMs: number;
  readonly drawCalls: number;
  readonly activeMeshes: number;
  readonly totalMeshes: number;
  readonly materials: number;
  readonly particles: number;
  /** Active meshes by their name without the numbers (`props`, `props-halo`, `parked`, `e`, ...): where a budget goes (ADR-0050). */
  readonly byName: Readonly<Record<string, number>>;
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
      byName: this.byName(),
    };
  }

  private byName(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const m of this.scene.getActiveMeshes().data.slice(0, this.scene.getActiveMeshes().length)) {
      // The name without its numbers: `props-far-1:0` and `props-far-2:1` count together.
      const k = m.name.replace(/[-_ :]*-?\d.*$/, "") || m.name;
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  }
}
