import type { Vec3 } from "@seki/core";
import { INTERIORS } from "@seki/sim";
import { type AbstractMesh, type Mesh, MeshClass, type Scene, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import type { GeometrySink } from "../city-kit-data";
import type { CityKit } from "../city-kit";
import { w3InsideGeometry } from "./w3-inside-geometry";
import { W3_INTERIOR_RANGE, w3InteriorDistance } from "./w3-interior-cull";
import { type W3Lamp, W3_LAMP_PREFIX, w3LampsFor } from "./w3-lights";
import { linePose } from "./w3-line-anim";
import { lineGeometry } from "./w3-line-geometry";

/** The outer pieces (shut leaves in the facades, the culvert's mouth) are drawn within this of the hall (m). */
export const W3_OUTER_DRAW = 400;
/** Past the inside's range by this much it stays on: no flicker on its edge. */
const HOLD = 4;
/** Over these metres up to the inside's range the lamps fade out, as Alchemia's (ADR-0074). */
const LAMP_FADE = 8;
/** The line moves at most this often (s): a third of the frames at 60 Hz, smooth enough for arms. */
const LINE_STEP = 1 / 30;

/**
 * What of the city stays drawn in the interior mode (ADR-0082 §3.8): the yards round the hall seen
 * through its open doors and the river's bank by the culvert, in the two map cells over them.
 */
export const W3_KEEP = { minX: 2478, maxX: 2590, minZ: 388, maxZ: 456 } as const;

const ROOMS = INTERIORS.filter((i) => i.id === "w3-hall" || i.id === "w3-basement").flatMap((i) => i.rooms);

/** Is the eye in a room of W-3's hall or basement (the interior mode, ADR-0082 §3.8)? */
export const eyeInW3 = (e: Vec3): boolean => ROOMS.some((r) => e.x > r.minX && e.x < r.maxX && e.z > r.minZ && e.z < r.maxZ && e.y > r.bottom && e.y < r.top);

export interface W3ViewDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** The city kit once it has loaded: its material and palette (ADR-0022). */
  readonly kit: () => CityKit | null;
  /** False without Lublin's map city. */
  readonly city: () => boolean;
  readonly eye: () => Vec3;
  /** The arms stand still (low quality, ADR-0082 §4). */
  readonly still: boolean;
}

/**
 * W-3's hall from the inside (ADR-0082 stage 2b), behind the `BabylonRenderer` facade: its rooms,
 * line and furniture baked from the simulation's blocks in one mesh drawn near it, the shut leaves
 * in its facades and the culvert's mouth in a second one drawn from afar, the line's moving parts
 * in a third (still on low quality), and its two nearest lamps. No moon shadow (ADR-0082 §4).
 * `interior` says the eye is in its rooms: the renderer's interior mode.
 */
export class W3View {
  private inside: Mesh | null = null;
  private outer: Mesh | null = null;
  private line: Mesh | null = null;
  private kitSeen: CityKit | null = null;
  private lamps: readonly W3Lamp[] = [];
  private lampLevel = 0;
  private time = 0;
  private lineAge = Infinity;
  /** The eye is in the hall's or the basement's rooms. */
  interior = false;

  /** The lights that take a slot (`ToonMaterials.setLightFocus`): the hall's lamps alone in its rooms, every light outside. */
  get lightScope(): string | null {
    return this.interior ? W3_LAMP_PREFIX : null;
  }

  constructor(private readonly deps: W3ViewDeps) {}

  /** The meshes on and their triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly insideTriangles: number; readonly lineTriangles: number } {
    const on = (m: Mesh | null) => (m?.isEnabled(false) ? 1 : 0);
    const tris = (m: Mesh | null) => (m ? m.getTotalIndices() / 3 : 0);
    return { meshes: on(this.inside) + on(this.outer) + on(this.line), insideTriangles: tris(this.inside), lineTriangles: tris(this.line) };
  }

  /** The lamps on now (tests). */
  get lampsOn(): readonly W3Lamp[] {
    return this.lampLevel > 0 ? this.lamps : [];
  }

  /** Walls the camera keeps in front of (the baked inside and outer pieces). */
  isBlocker(m: AbstractMesh): boolean {
    return m === this.inside || m === this.outer;
  }

  /** Call once per frame before rendering; `frozen` holds the line (the reference still). */
  update(dt: number, frozen: boolean): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.interior = false;
      this.show(false, false, 0);
      return;
    }
    const eye = this.deps.eye();
    const d = w3InteriorDistance(eye);
    const near = d < W3_INTERIOR_RANGE + (this.inside?.isEnabled(false) ? HOLD : 0);
    const out = d < W3_OUTER_DRAW;
    if ((near || out) && kit !== this.kitSeen) this.build(kit);
    this.interior = near && eyeInW3(eye);
    if (near) this.updateLamps(eye);
    this.show(out, near, Math.max(0, Math.min(1, (W3_INTERIOR_RANGE - d) / LAMP_FADE)));
    if (!frozen) this.time += dt;
    this.lineAge += frozen ? 0 : dt;
    if (near && !this.deps.still && this.lineAge >= LINE_STEP) this.moveLine(kit);
  }

  private build(kit: CityKit): void {
    this.kitSeen = kit;
    const { inside, outer } = w3InsideGeometry(kit.data);
    this.inside = this.fill(this.inside, "w3-inside", inside, kit, false);
    this.outer = this.fill(this.outer, "w3-outer", outer, kit, false);
    this.line = this.fill(this.line, "w3-line", lineGeometry(kit.data, linePose(this.time, undefined, this.deps.still)), kit, !this.deps.still);
    this.lineAge = 0;
  }

  private fill(mesh: Mesh | null, name: string, sink: GeometrySink, kit: CityKit, moving: boolean): Mesh {
    mesh?.dispose(false, false);
    const m = new MeshClass(name, this.deps.scene);
    m.material = kit.material;
    m.isPickable = false;
    m.setVerticesData(VertexBuffer.PositionKind, sink.positions, moving, 3);
    m.setVerticesData(VertexBuffer.NormalKind, sink.normals, moving, 3);
    m.setVerticesData(VertexBuffer.UVKind, sink.uvs, moving, 2);
    m.setVerticesData(VertexBuffer.ColorKind, sink.colors, false, 4);
    m.setIndices(sink.indices, sink.vertexCount);
    m.refreshBoundingInfo();
    m.freezeWorldMatrix();
    return m;
  }

  /** The line's next pose: the same boxes moved, the beacons' swatches swapped. */
  private moveLine(kit: CityKit): void {
    const m = this.line;
    if (!m) return;
    this.lineAge = 0;
    const s = lineGeometry(kit.data, linePose(this.time));
    m.updateVerticesData(VertexBuffer.PositionKind, s.positions);
    m.updateVerticesData(VertexBuffer.NormalKind, s.normals);
    m.updateVerticesData(VertexBuffer.UVKind, s.uvs);
  }

  /** The two lamps nearest the eye on, the others off; all of them only while the inside is drawn. */
  private updateLamps(eye: Vec3): void {
    const next = w3LampsFor(eye);
    if (next.every((l, i) => l === this.lamps[i]) && next.length === this.lamps.length) return;
    for (const l of this.lamps) if (!next.includes(l)) this.deps.materials.removeLight(l.key);
    this.lamps = next;
    this.lampLevel = -1;
  }

  private show(out: boolean, near: boolean, fade: number): void {
    if (this.outer && this.outer.isEnabled(false) !== out) this.outer.setEnabled(out);
    for (const m of [this.inside, this.line]) if (m && m.isEnabled(false) !== near) m.setEnabled(near);
    const level = near && this.inside ? fade : 0;
    if (level === this.lampLevel) return;
    this.lampLevel = level;
    for (const l of this.lamps) {
      if (level > 0) this.deps.materials.addLight(l.key, { ...l.light, intensity: l.light.intensity * level });
      else this.deps.materials.removeLight(l.key);
    }
  }
}
