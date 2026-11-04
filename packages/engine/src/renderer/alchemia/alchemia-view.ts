import type { Vec3 } from "@seki/core";
import { ALCHEMIA_CENTRE } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, VertexBuffer } from "../../babylon";
import type { CityKit } from "../city-kit";
import type { CityProps } from "../city-props";
import { alchemiaGeometry } from "./alchemia-geometry";

/**
 * How near the eye Alchemia is drawn (m from the middle of the group), and the margin it goes off
 * beyond that: from the streets round the plot, from behind the Ratusz (some 115 m) and across
 * the square, while the street scenes of `npr-perf` (165 m and more from it) stay as they were.
 */
export const ALCHEMIA_DRAW = 150;
const ALCHEMIA_HOLD = 10;

export interface AlchemiaDeps {
  readonly scene: Scene;
  /** The city kit once it has loaded: its material and palette (ADR-0022). */
  readonly kit: () => CityKit | null;
  /** The props files once they have loaded: the hall's models (`alchemia-props.glb`). */
  readonly props: () => CityProps | null;
  /** False without Lublin's map city (the hall stands on one of its squares). */
  readonly city: () => boolean;
  readonly eye: () => Vec3;
}

/**
 * Alchemia on Plac Ofiar Getta (ADR-0063 stage 4), behind the `BabylonRenderer` facade: the hall,
 * its five stalls and their plinths in one mesh on the city kit's material, one draw call (two
 * with the G-buffer), on only within `ALCHEMIA_DRAW` of the group. No moon shadow and no glow
 * layer: its neon and lit windows are bright in the kit's own emissive colours.
 */
export class AlchemiaView {
  private mesh: Mesh | null = null;
  private kitSeen: CityKit | null = null;
  private propsSeen: CityProps | null = null;
  private models = 0;

  constructor(private readonly deps: AlchemiaDeps) {}

  /** The mesh drawn last frame, how many modules are models and its triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly models: number; readonly triangles: number } {
    const on = this.mesh?.isEnabled(false) ?? false;
    return { meshes: on ? 1 : 0, models: this.models, triangles: this.mesh ? this.mesh.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false);
      return;
    }
    const e = this.deps.eye();
    const d = Math.hypot(e.x - ALCHEMIA_CENTRE.x, e.z - ALCHEMIA_CENTRE.z);
    const want = d < ALCHEMIA_DRAW + (this.mesh?.isEnabled(false) ? ALCHEMIA_HOLD : 0);
    if (want && (kit !== this.kitSeen || this.deps.props() !== this.propsSeen)) this.build(kit);
    this.show(want);
  }

  private build(kit: CityKit): void {
    const props = this.deps.props();
    this.kitSeen = kit;
    this.propsSeen = props;
    const { sink, models } = alchemiaGeometry(kit.data, props);
    this.models = models;
    const mesh = this.mesh ?? new MeshClass("alchemia", this.deps.scene);
    mesh.material = kit.material;
    mesh.isPickable = false;
    mesh.setVerticesData(VertexBuffer.PositionKind, sink.positions, false, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, sink.normals, false, 3);
    mesh.setVerticesData(VertexBuffer.UVKind, sink.uvs, false, 2);
    mesh.setVerticesData(VertexBuffer.ColorKind, sink.colors, false, 4);
    mesh.setIndices(sink.indices, sink.vertexCount);
    mesh.refreshBoundingInfo();
    mesh.freezeWorldMatrix();
    this.mesh = mesh;
  }

  private show(on: boolean): void {
    if (this.mesh && this.mesh.isEnabled(false) !== on) this.mesh.setEnabled(on);
  }
}
