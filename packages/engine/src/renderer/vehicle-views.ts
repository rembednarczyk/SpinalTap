import type { EntityId, Transform, ViewDescriptor } from "@seki/core";
import { type GlowLayer, type Mesh, MeshClass, type Scene, Vector3, VertexBuffer } from "../babylon";
import type { RenderQuality } from "../npr/quality";
import type { CityKit } from "./city-kit";
import { type VehicleTemplate, paintOf, vehicleTemplates } from "./vehicle-models";

export type VehicleDescriptor = Extract<ViewDescriptor, { kind: "vehicle" }>;

/** How far vehicles are drawn, and where the far version takes over (m from the camera), per quality. */
export const VEHICLE_LOD: Readonly<Record<RenderQuality, { readonly near: number; readonly draw: number }>> = {
  high: { near: 90, draw: 240 },
  medium: { near: 70, draw: 180 },
  low: { near: 45, draw: 120 },
};

interface Pair {
  readonly near: VehicleTemplate;
  readonly far: VehicleTemplate;
}

type Shown = "near" | "far" | "none";

interface Member {
  readonly view: VehicleDescriptor;
  transform: Transform;
  pair: Pair | null;
  /** First vertex of its near geometry in the shared buffers; the far one follows it. */
  offset: number;
  /** What was drawn last frame; a parked car is written only when this changes. */
  shown: Shown;
}

export interface VehicleViewsDeps {
  readonly scene: Scene;
  /** The city kit once it has loaded: its models and its material (ADR-0022). */
  readonly kit: () => CityKit | null;
  readonly glow: GlowLayer | null;
  /** Where the camera is (ground plane). */
  readonly eye: () => { readonly x: number; readonly z: number };
  readonly quality: RenderQuality;
}

/** Room round a vehicle for the mesh's bounds (m). */
const PAD = 7;

/**
 * Vehicles sharing one mesh: each is a slot of its buffers (its near and its far geometry), the
 * buffers laid out again only when vehicles come or go. A parked car is written only when its
 * level of detail changes.
 */
class Fleet {
  private readonly members = new Map<EntityId, Member>();
  private readonly templates = new Map<string, Pair | null>();
  private mesh: Mesh | null = null;
  private dirty = false;
  private positions = new Float32Array(0);
  private normals = new Float32Array(0);
  private readonly min = new Vector3();
  private readonly max = new Vector3();
  private kitSeen: CityKit | null = null;

  constructor(
    private readonly deps: VehicleViewsDeps,
    private readonly name: string,
  ) {}

  has(id: EntityId): boolean {
    return this.members.has(id);
  }

  get size(): number {
    return this.members.size;
  }

  /** Vehicles driving and parked, those drawn last frame near and far, and the meshes drawn (debug, tests). */
  get stats(): { readonly driving: number; readonly parked: number; readonly near: number; readonly far: number; readonly meshes: number } {
    let near = 0;
    let far = 0;
    let parked = 0;
    for (const m of this.members.values()) {
      if (m.view.parked) parked++;
      if (m.shown === "near") near++;
      else if (m.shown === "far") far++;
    }
    return { driving: this.members.size - parked, parked, near, far, meshes: this.mesh?.isEnabled() ? 1 : 0 };
  }

  spawn(id: EntityId, view: VehicleDescriptor, t: Transform): void {
    this.members.set(id, { view, transform: t, pair: null, offset: 0, shown: "none" });
    this.dirty = true;
  }

  /** False for an unknown id. */
  move(id: EntityId, t: Transform): boolean {
    const m = this.members.get(id);
    if (!m) return false;
    m.transform = t;
    return true;
  }

  despawn(id: EntityId): void {
    if (this.members.delete(id)) this.dirty = true;
  }

  clear(): void {
    this.members.clear();
    this.dirty = true;
  }

  /** Moves everyone in range and rebuilds the buffers when vehicles came or went. Call once per frame. */
  update(kit: CityKit, eye: { x: number; z: number }): void {
    if (kit !== this.kitSeen) {
      this.kitSeen = kit;
      this.templates.clear();
      this.dirty = true;
    }
    if (this.dirty) this.rebuild(kit);
    this.draw(eye);
  }

  private pairOf(kit: CityKit, view: VehicleDescriptor): Pair | null {
    const paint = paintOf(view.model, view.tint);
    const key = `${view.model}:${paint}`;
    if (!this.templates.has(key)) this.templates.set(key, vehicleTemplates(kit.data, view.model, paint));
    return this.templates.get(key) ?? null;
  }

  private draw(eye: { x: number; z: number }): void {
    const mesh = this.mesh;
    if (!mesh) return;
    const lod = VEHICLE_LOD[this.deps.quality];
    this.min.set(Infinity, Infinity, Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    let any = false;
    let wrote = false;
    for (const m of this.members.values()) {
      const pair = m.pair;
      if (!pair) continue;
      const p = m.transform.position;
      const dist = Math.hypot(p.x - eye.x, p.z - eye.z);
      const want: Shown = dist > lod.draw ? "none" : dist > lod.near ? "far" : "near";
      const changed = want !== m.shown;
      if (changed) {
        if (m.shown === "near") this.fold(m.offset, pair.near.vertexCount, p);
        if (m.shown === "far") this.fold(m.offset + pair.near.vertexCount, pair.far.vertexCount, p);
        m.shown = want;
        wrote = true;
      }
      if (want === "none") continue;
      any = true;
      if (changed || !m.view.parked) {
        wrote = true;
        if (want === "near") this.place(pair.near, m.offset, m.transform);
        else this.place(pair.far, m.offset + pair.near.vertexCount, m.transform);
      }
      this.min.set(Math.min(this.min.x, p.x - PAD), Math.min(this.min.y, p.y - 1), Math.min(this.min.z, p.z - PAD));
      this.max.set(Math.max(this.max.x, p.x + PAD), Math.max(this.max.y, p.y + 7), Math.max(this.max.z, p.z + PAD));
    }
    if (mesh.isEnabled(false) !== any) mesh.setEnabled(any);
    if (!any || !wrote) return;
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.updateVerticesData(VertexBuffer.NormalKind, this.normals, false, false);
    mesh.buildBoundingInfo(this.min, this.max);
  }

  /** Writes a template turned by the yaw and moved to the transform into the shared buffers. */
  private place(t: VehicleTemplate, offset: number, tr: Transform): void {
    const c = Math.cos(tr.yaw);
    const s = Math.sin(tr.yaw);
    const { x: px, y: py, z: pz } = tr.position;
    const src = t.positions;
    const nsrc = t.normals;
    let o = offset * 3;
    for (let i = 0; i < src.length; i += 3, o += 3) {
      const x = src[i] as number;
      const z = src[i + 2] as number;
      this.positions[o] = px + x * c + z * s;
      this.positions[o + 1] = py + (src[i + 1] as number);
      this.positions[o + 2] = pz - x * s + z * c;
      const nx = nsrc[i] as number;
      const nz = nsrc[i + 2] as number;
      this.normals[o] = nx * c + nz * s;
      this.normals[o + 1] = nsrc[i + 1] as number;
      this.normals[o + 2] = -nx * s + nz * c;
    }
  }

  /** Folds vertices into a point, so their triangles draw nothing. */
  private fold(offset: number, count: number, p: { x: number; y: number; z: number }): void {
    const end = (offset + count) * 3;
    for (let o = offset * 3; o < end; o += 3) {
      this.positions[o] = p.x;
      this.positions[o + 1] = p.y;
      this.positions[o + 2] = p.z;
    }
  }

  /** Lays out the shared buffers for the vehicles there are now: colours, UVs and triangles change only here. */
  private rebuild(kit: CityKit): void {
    this.dirty = false;
    let total = 0;
    let triangles = 0;
    for (const m of this.members.values()) {
      m.pair = this.pairOf(kit, m.view);
      m.offset = total;
      m.shown = "none";
      if (!m.pair) continue;
      total += m.pair.near.vertexCount + m.pair.far.vertexCount;
      triangles += m.pair.near.indices.length + m.pair.far.indices.length;
    }
    if (total === 0) {
      this.mesh?.setEnabled(false);
      return;
    }
    this.positions = new Float32Array(total * 3);
    this.normals = new Float32Array(total * 3);
    const uvs = new Float32Array(total * 2);
    const colors = new Float32Array(total * 4);
    const indices = new Uint32Array(triangles);
    let k = 0;
    for (const m of this.members.values()) {
      if (!m.pair) continue;
      let at = m.offset;
      for (const t of [m.pair.near, m.pair.far]) {
        uvs.set(t.uvs, at * 2);
        colors.set(t.colors, at * 4);
        for (const i of t.indices) indices[k++] = i + at;
        this.fold(at, t.vertexCount, m.transform.position);
        at += t.vertexCount;
      }
    }
    const mesh = this.mesh ?? this.createMesh(kit);
    mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, this.normals, true, 3);
    mesh.setVerticesData(VertexBuffer.UVKind, uvs, false, 2);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
    mesh.setIndices(indices, total);
  }

  private createMesh(kit: CityKit): Mesh {
    const mesh = new MeshClass(this.name, this.deps.scene);
    mesh.material = kit.material;
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    mesh.freezeWorldMatrix();
    this.deps.glow?.addIncludedOnlyMesh(mesh);
    this.mesh = mesh;
    return mesh;
  }
}

/**
 * The street's vehicles (ADR-0050), drawn in bulk on the city kit's material: the driving ones in
 * one shared mesh, moved on the CPU each frame, the parked cars of the whole city in another;
 * one draw call per pass each however many there are. Near ones are the kit's models, far ones a
 * few boxes, the farthest folded away. Their lamps glow. No moon shadow, no outline: like the
 * kit's buildings.
 */
export class VehicleViews {
  private readonly driving: Fleet;
  private readonly parked: Fleet;

  constructor(private readonly deps: VehicleViewsDeps) {
    this.driving = new Fleet(deps, "vehicles");
    this.parked = new Fleet(deps, "parked");
  }

  has(id: EntityId): boolean {
    return this.driving.has(id) || this.parked.has(id);
  }

  get size(): number {
    return this.driving.size + this.parked.size;
  }

  /** Vehicles driving and parked, those drawn last frame near and far, and the meshes drawn (debug, tests). */
  get stats(): { readonly driving: number; readonly parked: number; readonly near: number; readonly far: number; readonly meshes: number } {
    const d = this.driving.stats;
    const p = this.parked.stats;
    return { driving: d.driving, parked: p.parked, near: d.near + p.near, far: d.far + p.far, meshes: d.meshes + p.meshes };
  }

  spawn(id: EntityId, view: VehicleDescriptor, t: Transform): void {
    this.despawn(id);
    (view.parked ? this.parked : this.driving).spawn(id, view, t);
  }

  /** False for an unknown id. */
  move(id: EntityId, t: Transform): boolean {
    return this.driving.move(id, t);
  }

  despawn(id: EntityId): void {
    this.driving.despawn(id);
    this.parked.despawn(id);
  }

  clear(): void {
    this.driving.clear();
    this.parked.clear();
  }

  /** Call once per frame before rendering; nothing is drawn before the kit has loaded. */
  update(): void {
    const kit = this.deps.kit();
    if (!kit) return;
    const eye = this.deps.eye();
    this.driving.update(kit, eye);
    this.parked.update(kit, eye);
  }
}
