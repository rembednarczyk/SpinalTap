import type { Vec3 } from "@seki/core";
import { CAPSULE_CEILING, CAPSULE_ORIGIN } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityKit } from "../city-kit";
import type { CityProps } from "../city-props";
import { capsuleGeometry } from "./capsule-geometry";

/**
 * How near the eye the capsule room is drawn (m from the middle of its floor), and the margin it
 * goes off beyond that. Far enough that its doorway never shows an empty building from the
 * street in front; the street scenes of `npr-perf` stand well outside it.
 */
export const CAPSULE_DRAW = 45;
const CAPSULE_HOLD = 5;

/** The room's lamp: warm, under the ceiling, as far as its corners. */
const LAMP = { color: "#ffd9a8", range: 5.5, intensity: 1.1 } as const;
const LAMP_KEY = "capsule-room";

export interface CapsuleRoomDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** The city kit once it has loaded: its material and palette (ADR-0022). */
  readonly kit: () => CityKit | null;
  /** The props files once they have loaded: the room's model (`room-props.glb`). */
  readonly props: () => CityProps | null;
  /** False without Lublin's map city (the room is cut into one of its tenements). */
  readonly city: () => boolean;
  readonly eye: () => Vec3;
}

/**
 * The capsule room on Jezuicka (ADR-0063 stage 3), behind the `BabylonRenderer` facade: its shell
 * and its model in one mesh on the city kit's material, one draw call (two with the G-buffer),
 * on only near the room, so the street's draw calls stay as they were. No moon shadow, no glow
 * layer: the room stands under three storeys and its screens and strips are bright in the kit's
 * own emissive colour; its lamp is a point light while the mesh is on.
 */
export class CapsuleRoomView {
  private mesh: Mesh | null = null;
  private kitSeen: CityKit | null = null;
  private propsSeen: CityProps | null = null;
  private model = false;
  private lit = false;

  constructor(private readonly deps: CapsuleRoomDeps) {}

  /** The mesh drawn last frame, whether it holds the model and its triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly model: boolean; readonly triangles: number } {
    const on = this.mesh?.isEnabled(false) ?? false;
    return { meshes: on ? 1 : 0, model: this.model, triangles: this.mesh ? this.mesh.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false);
      return;
    }
    const e = this.deps.eye();
    const d = Math.hypot(e.x - CAPSULE_ORIGIN.x, e.z - CAPSULE_ORIGIN.z);
    const want = d < CAPSULE_DRAW + (this.mesh?.isEnabled(false) ? CAPSULE_HOLD : 0);
    if (want && (kit !== this.kitSeen || this.deps.props() !== this.propsSeen)) this.build(kit);
    this.show(want);
  }

  private build(kit: CityKit): void {
    const props = this.deps.props();
    this.kitSeen = kit;
    this.propsSeen = props;
    const { sink, model } = capsuleGeometry(kit.data, props);
    this.model = model;
    const mesh = this.mesh ?? new MeshClass("capsule-room", this.deps.scene);
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
    const lit = on && this.mesh !== null;
    if (lit === this.lit) return;
    this.lit = lit;
    if (lit) this.deps.materials.addLight(LAMP_KEY, { ...LAMP, position: { x: CAPSULE_ORIGIN.x, y: CAPSULE_ORIGIN.y + CAPSULE_CEILING - 0.3, z: CAPSULE_ORIGIN.z } });
    else this.deps.materials.removeLight(LAMP_KEY);
  }
}
