/**
 * A full-screen pass that only draws while its effect shows (frame profile 14.11): chromatic
 * aberration at amount 0 and speed lines at intensity 0 are an identity copy of the whole frame.
 *
 * Off, the pass leaves the camera's chain (Babylon nulls its slot); on, it goes back into the
 * same slot. That is an array write, not a rebuild of the grading pipeline (which would dispose
 * and recreate its passes and targets), and it happens only when the state changes.
 */

/** The part of a camera the gate changes. */
export interface GateCamera<P> {
  readonly _postProcesses: readonly (P | null)[];
  attachPostProcess(pass: P, insertAt?: number | null): number;
  detachPostProcess(pass: P): void;
}

/**
 * The first pass of the chain never leaves it: the scene renders into its target, the only one
 * with a depth buffer and multisampling (Babylon creates them for the first pass only).
 */
export class PassGate<P> {
  /** Where the pass stood in the chain while it is out of it. */
  private slot = -1;

  /** `pass` is read on every change: the pipeline may have rebuilt and replaced it. */
  constructor(
    private readonly camera: GateCamera<P>,
    private readonly pass: () => P | null | undefined,
  ) {}

  /** Puts the pass in the chain while `on`, out of it otherwise; nothing when already so. */
  set(on: boolean): void {
    const pass = this.pass();
    if (!pass) return;
    const at = this.camera._postProcesses.indexOf(pass);
    if (on && at < 0 && this.slot >= 0) {
      this.camera.attachPostProcess(pass, this.slot);
      this.slot = -1;
    } else if (!on && at >= 0 && this.camera._postProcesses.findIndex((p) => p !== null) !== at) {
      this.slot = at;
      this.camera.detachPostProcess(pass);
    }
  }

  /** Whether the pass is in the chain now. */
  get drawing(): boolean {
    const pass = this.pass();
    return !!pass && this.camera._postProcesses.includes(pass);
  }
}
