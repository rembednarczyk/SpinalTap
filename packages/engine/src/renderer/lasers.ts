import { Color3, type GlowLayer, type Mesh, MeshBuilder, type Scene, StandardMaterial, Vector3 } from "../babylon";
import type { EntityId, Transform } from "@seki/core";

/** Where the laser leaves the sniper (its scope at eye height) and where it lands (the chest). */
const SCOPE_HEIGHT = 1.58;
const CHEST_HEIGHT = 1.25;
const BEAM = 0.018;

interface Laser {
  readonly beam: Mesh;
  readonly glint: Mesh;
  readonly targetId: EntityId;
  life: number;
  readonly duration: number;
}

/**
 * Sniper lasers (ADR-0024): a thin red beam from the scope to the target and a glint at the
 * scope that swells as the shot nears. Each follows both characters every frame and goes out
 * when its time is up or the simulation switches it off. Two shared materials, no lights.
 */
export class Lasers {
  private readonly active = new Map<EntityId, Laser>();
  private readonly beamMat: StandardMaterial;
  private readonly glintMat: StandardMaterial;

  constructor(
    private readonly scene: Scene,
    private readonly glow: GlowLayer,
  ) {
    this.beamMat = new StandardMaterial("laser-beam", scene);
    this.beamMat.disableLighting = true;
    this.beamMat.emissiveColor = Color3.FromHexString("#ff2030");
    this.beamMat.alpha = 0.75;
    this.glintMat = new StandardMaterial("laser-glint", scene);
    this.glintMat.disableLighting = true;
    this.glintMat.emissiveColor = Color3.FromHexString("#ffd0d0");
  }

  start(shooterId: EntityId, targetId: EntityId, duration: number): void {
    this.stop(shooterId);
    const beam = MeshBuilder.CreateBox(`laser-${shooterId}`, { width: BEAM, height: BEAM, depth: 1 }, this.scene);
    beam.material = this.beamMat;
    beam.isPickable = false;
    const glint = MeshBuilder.CreateSphere(`laser-glint-${shooterId}`, { diameter: 0.12, segments: 6 }, this.scene);
    glint.material = this.glintMat;
    glint.isPickable = false;
    this.glow.addIncludedOnlyMesh(beam);
    this.glow.addIncludedOnlyMesh(glint);
    beam.setEnabled(false);
    glint.setEnabled(false);
    this.active.set(shooterId, { beam, glint, targetId, life: duration, duration });
  }

  stop(shooterId: EntityId): void {
    const l = this.active.get(shooterId);
    if (!l) return;
    this.active.delete(shooterId);
    this.glow.removeIncludedOnlyMesh(l.beam);
    this.glow.removeIncludedOnlyMesh(l.glint);
    l.beam.dispose();
    l.glint.dispose();
  }

  clear(): void {
    for (const id of [...this.active.keys()]) this.stop(id);
  }

  get count(): number {
    return this.active.size;
  }

  /** Follows shooter and target; `transformOf` gives the latest render transform of an entity. */
  update(dt: number, transformOf: (id: EntityId) => Transform | null): void {
    for (const [id, l] of [...this.active]) {
      l.life -= dt;
      const from = transformOf(id);
      const to = transformOf(l.targetId);
      if (l.life <= 0 || !from || !to) {
        this.stop(id);
        continue;
      }
      const a = new Vector3(from.position.x, from.position.y + SCOPE_HEIGHT, from.position.z);
      const b = new Vector3(to.position.x, to.position.y + CHEST_HEIGHT, to.position.z);
      const length = Vector3.Distance(a, b);
      l.beam.position.copyFrom(a.add(b).scale(0.5));
      l.beam.scaling.z = Math.max(0.01, length);
      l.beam.lookAt(b);
      l.glint.position.copyFrom(a);
      // The glint swells as the shot nears: the last half second is unmistakable.
      const urgency = 1 - Math.max(0, l.life) / l.duration;
      l.glint.scaling.setAll(0.6 + 1.6 * urgency * urgency);
      l.beam.setEnabled(true);
      l.glint.setEnabled(true);
    }
  }
}
