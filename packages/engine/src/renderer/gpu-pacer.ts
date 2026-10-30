/** The WebGL2 fence calls the pacer needs (a fake in tests). */
export interface FenceGl {
  readonly SYNC_GPU_COMMANDS_COMPLETE: number;
  readonly SYNC_STATUS: number;
  readonly SIGNALED: number;
  fenceSync(condition: number, flags: number): WebGLSync | null;
  getSyncParameter(sync: WebGLSync, pname: number): unknown;
  deleteSync(sync: WebGLSync | null): void;
  isContextLost(): boolean;
}

/**
 * Keeps the GPU at most `maxInFlight` drawn frames behind the page (G-029). A slow GPU (Chrome's
 * SwiftShader in CI, a weak phone) takes the frames the page hands it into a queue that nothing
 * waits for, until a synchronous call (a shader's link status, a texture upload, a readback)
 * waits it all out and blocks the page for seconds: the title screen built a 12 s queue, and a
 * click on it hung. A frame is drawn only once the GPU has finished all but the last one; on a
 * GPU that keeps up the fences are done by the next frame, so nothing is skipped. Two frames in
 * flight, not one, because Chrome may report a fence finished only a frame late.
 * Without WebGL2 fences (`gl` null) every frame is drawn.
 */
export class GpuPacer {
  private readonly inFlight: WebGLSync[] = [];

  constructor(
    private readonly gl: FenceGl | null,
    private readonly maxInFlight = 2,
  ) {}

  /** The GPU has caught up enough for another frame. Polls the fences, never waits for them. */
  get canDraw(): boolean {
    const gl = this.gl;
    if (!gl) return true;
    // Fences from a lost context never signal (the status reads null): counted as done, or the
    // pacer would hold every frame after a context loss and the picture would freeze.
    if (gl.isContextLost()) {
      this.reset();
      return true;
    }
    while (this.inFlight.length > 0 && this.finished(gl, this.inFlight[0]!)) gl.deleteSync(this.inFlight.shift()!);
    return this.inFlight.length < this.maxInFlight;
  }

  /** Forgets the fences in flight: the context they belong to was lost or restored. */
  reset(): void {
    this.inFlight.length = 0;
  }

  private finished(gl: FenceGl, sync: WebGLSync): boolean {
    const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
    return status === null || status === gl.SIGNALED;
  }

  /** Call right after a frame was drawn: marks where its GPU work ends. */
  drawn(): void {
    const gl = this.gl;
    const sync = gl?.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync) this.inFlight.push(sync);
  }
}
