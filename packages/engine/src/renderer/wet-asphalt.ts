import type { AbstractMesh, BaseTexture } from "../babylon";
import type { Stage } from "./stage";
import { WetProbe } from "./wet-probe";

export interface WetAsphaltDeps {
  readonly stage: Stage;
  /** Cube size of the probe (`qualityTier().wetProbe`). */
  readonly size: number;
  /** What the probe always mirrors: the sky, the signs and the far city (null while missing). */
  readonly fixed: () => readonly (AbstractMesh | null)[];
}

/**
 * The wet asphalt's reflection behind the `BabylonRenderer` facade (ADR-0036): the static probe
 * of the medium and high qualities, what it mirrors, and when it renders again.
 */
export class WetAsphalt {
  private readonly probe: WetProbe;
  /** Kit meshes when the probe last looked: a newly skinned block re-renders it. */
  private kitMeshes = 0;

  constructor(private readonly deps: WetAsphaltDeps) {
    this.probe = new WetProbe(deps.stage.scene, deps.size, () => this.reflected());
  }

  /** The cube the wet presets sample. */
  get texture(): BaseTexture {
    return this.probe.texture;
  }

  /** Renders so far (debug and tests). */
  get renderCount(): number {
    return this.probe.renderCount;
  }

  /** The probe still owes a render (G-114). */
  get pending(): boolean {
    return this.probe.pending;
  }

  /** Something the probe shows changed. */
  invalidate(): void {
    this.probe.schedule.invalidate();
  }

  /** Re-renders the probe on a new district or when what it mirrors changed. */
  update(dt: number, kitMeshes: number, district: string | null, eye: { x: number; z: number }): void {
    if (kitMeshes !== this.kitMeshes) {
      this.kitMeshes = kitMeshes;
      this.probe.schedule.invalidate();
    }
    this.probe.schedule.setDistrict(district);
    this.probe.update(dt, eye);
  }

  /** What the probe mirrors: the sky, the far city, the signs and everything that glows. */
  private reflected(): AbstractMesh[] {
    const { scene, glow } = this.deps.stage;
    const glowing = scene.meshes.filter((m) => m.isEnabled() && m.isVisible && glow.hasMesh(m) && !m.name.startsWith("metro-"));
    const fixed = this.deps.fixed().filter((m): m is AbstractMesh => m !== null);
    return [...new Set<AbstractMesh>([...fixed, ...glowing])];
  }
}
