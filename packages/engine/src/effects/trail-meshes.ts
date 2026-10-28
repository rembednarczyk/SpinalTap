import { Color3, type GlowLayer, Matrix, type Mesh, MeshBuilder, type Scene, StandardMaterial, Vector3 } from "../babylon";
import { MAX_TRAILS, type Trail, type TrailKind, segment, trailFade } from "./trails";

/** Beam look per trail: colour and thickness. The dash streak is Seki's cyan, the reflection white-hot. */
const LOOK: Readonly<Record<TrailKind, { color: string; diameter: number }>> = {
  dash: { color: "#5ff2ff", diameter: 0.11 },
  "dash-low": { color: "#ff5fc8", diameter: 0.06 },
  reflect: { color: "#f4fbff", diameter: 0.035 },
};

/**
 * Pooled beams for `TrailState` (ADR-0036): one unit cylinder per slot along local Z, scaled to
 * the trail's length and faded by visibility. Slots without a trail are disabled, so idle
 * frames cost nothing.
 */
export class TrailMeshes {
  private readonly beams: Mesh[] = [];
  private readonly materials: Record<TrailKind, StandardMaterial>;
  private readonly target = new Vector3();

  constructor(scene: Scene, glow: GlowLayer) {
    const mat = (kind: TrailKind) => {
      const m = new StandardMaterial(`fx-trail-${kind}`, scene);
      m.disableLighting = true;
      m.emissiveColor = Color3.FromHexString(LOOK[kind].color);
      return m;
    };
    this.materials = { dash: mat("dash"), "dash-low": mat("dash-low"), reflect: mat("reflect") };
    for (let i = 0; i < MAX_TRAILS; i++) {
      const beam = MeshBuilder.CreateCylinder(`fx-trail-${i}`, { height: 1, diameter: 1, tessellation: 6 }, scene);
      beam.bakeTransformIntoVertices(Matrix.RotationX(Math.PI / 2));
      beam.isPickable = false;
      beam.setEnabled(false);
      glow.addIncludedOnlyMesh(beam);
      this.beams.push(beam);
    }
  }

  update(trails: readonly Trail[]): void {
    for (let i = 0; i < this.beams.length; i++) {
      const beam = this.beams[i]!;
      const t = trails[i];
      const { length, mid } = t ? segment(t.from, t.to) : { length: 0, mid: null };
      if (!t || !mid || length < 0.05) {
        if (beam.isEnabled()) beam.setEnabled(false);
        continue;
      }
      const fade = trailFade(t.ttl, t.life);
      const d = LOOK[t.kind].diameter * (0.4 + 0.6 * fade);
      beam.material = this.materials[t.kind];
      beam.position.set(mid.x, mid.y, mid.z);
      beam.scaling.set(d, d, length);
      beam.lookAt(this.target.set(t.to.x, t.to.y, t.to.z));
      beam.visibility = fade;
      if (!beam.isEnabled()) beam.setEnabled(true);
    }
  }
}
