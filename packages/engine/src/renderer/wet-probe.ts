import { type AbstractMesh, type BaseTexture, ReflectionProbe, type Scene, Vector3 } from "../babylon";

/** Seconds between two probe renders at most once a second while things keep changing. */
export const PROBE_MIN_INTERVAL = 1;
/** The probe sits this far under the street: the camera's eye mirrored in the wet asphalt. */
export const PROBE_DEPTH = -1.7;

/**
 * When the static probe renders (ADR-0036), as pure state: on entering a district, and again
 * when what it reflects changed (a chunk streamed in, the city kit loaded, the light changed),
 * but never more often than once per `PROBE_MIN_INTERVAL`. Idle frames render nothing.
 */
export class ProbeSchedule {
  private dirty = true;
  private since = Infinity;
  private district: string | null = null;

  /** Something the probe shows changed. */
  invalidate(): void {
    this.dirty = true;
  }

  /** The district under the camera; a new one always re-renders. */
  setDistrict(id: string | null): void {
    if (id === null || id === this.district) return;
    this.district = id;
    this.dirty = true;
  }

  /** A render is due, possibly held back by the interval. */
  get pending(): boolean {
    return this.dirty;
  }

  /** True on the frame the probe should render. */
  update(dt: number): boolean {
    this.since += Math.max(0, dt);
    if (!this.dirty || this.since < PROBE_MIN_INTERVAL) return false;
    this.dirty = false;
    this.since = 0;
    return true;
  }
}

/**
 * The static reflection probe of the medium and high qualities: a small cube of everything that
 * glows (neon, signs, holo-ads, the far city) and the sky, rendered once from under the street
 * at the camera's position and sampled by the wet surfaces in cel steps.
 */
export class WetProbe {
  private readonly probe: ReflectionProbe;
  readonly schedule = new ProbeSchedule();
  private renders = 0;

  constructor(
    scene: Scene,
    size: number,
    /** What the probe sees, gathered when it renders. */
    private readonly reflected: () => AbstractMesh[],
  ) {
    this.probe = new ReflectionProbe("wet-probe", size, scene, false);
    // Render once, then only on `resetRefreshCounter`.
    this.probe.refreshRate = 0;
    this.probe.renderList = [];
    // Babylon renders a probe only for the materials that ask for it (standard, PBR); the toon
    // ShaderMaterials do not, so the cube goes in with the scene's own render targets.
    scene.customRenderTargets.push(this.probe.cubeTexture);
  }

  get texture(): BaseTexture {
    return this.probe.cubeTexture;
  }

  /** Renders so far (debug, tests). */
  get renderCount(): number {
    return this.renders;
  }

  /**
   * The probe still owes a render (G-114): it lands up to `PROBE_MIN_INTERVAL` of real time after
   * the city changed, and its six faces add some hundred draw calls to that one frame.
   */
  get pending(): boolean {
    return this.schedule.pending;
  }

  /** Re-renders from under `camera` when the schedule says so. */
  update(dt: number, camera: { x: number; z: number }): void {
    if (!this.schedule.update(dt)) return;
    this.probe.position = new Vector3(camera.x, PROBE_DEPTH, camera.z);
    this.probe.renderList = this.reflected();
    this.probe.cubeTexture.resetRefreshCounter();
    this.renders += 1;
  }
}
