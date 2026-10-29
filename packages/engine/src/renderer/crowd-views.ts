import type { ActivityId, EntityId, Transform, ViewDescriptor } from "@seki/core";
import { type Mesh, MeshClass, type Scene, Vector3, VertexBuffer } from "../babylon";
import { applyOutline } from "../npr/outline";
import type { ToonMaterials } from "../npr/toon-material";
import { crowdLook } from "./crowd-look";
import { type PuppetState, freshPuppet, partMatrices, poseParts, puppetPose, setPuppetActivity, stepPuppet } from "./crowd-pose";
import { type PuppetTemplate, buildPuppet } from "./crowd-puppet";
import { easeLift, groundLift } from "./ground-lift";

export type CrowdDescriptor = Extract<ViewDescriptor, { kind: "crowd" }>;

interface Member {
  readonly template: PuppetTemplate;
  readonly umbrella: boolean;
  transform: Transform;
  readonly state: PuppetState;
  lift: number;
  /** First vertex of this resident in the shared buffers. */
  offset: number;
  /** Drawn last frame (inside the draw distance). */
  shown: boolean;
}

export interface CrowdViewsDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** Where the camera is (ground plane). */
  readonly eye: () => { readonly x: number; readonly z: number };
  /** Residents farther than this from the camera are not drawn (m). */
  readonly drawDistance: number;
}

/** Room around a figure for the mesh's bounds: arms, umbrella, a little lean (m). */
const PAD = 0.9;
const TOP = 2.4;

/**
 * The residents of the city (ADR-0041), drawn in bulk: every resident's low-poly figure is
 * posed on the CPU each frame (the walk, the activities, cowering) and written into one shared,
 * vertex-coloured mesh with the characters' toon material and outline. However many there are,
 * the crowd costs one mesh and a draw call per pass; far ones are left out, and none casts the
 * moon shadow. Not dressed with imported models: those stay for the named cast.
 */
export class CrowdViews {
  private readonly members = new Map<EntityId, Member>();
  private readonly templates = new Map<string, PuppetTemplate>();
  private readonly parts = partMatrices();
  private mesh: Mesh | null = null;
  private dirty = false;
  private positions = new Float32Array(0);
  private normals = new Float32Array(0);
  private readonly min = new Vector3();
  private readonly max = new Vector3();

  constructor(private readonly deps: CrowdViewsDeps) {}

  has(id: EntityId): boolean {
    return this.members.has(id);
  }

  get size(): number {
    return this.members.size;
  }

  ids(): EntityId[] {
    return [...this.members.keys()];
  }

  /** Residents drawn in the last frame (debug and tests). */
  get drawn(): number {
    let n = 0;
    for (const m of this.members.values()) if (m.shown) n++;
    return n;
  }

  /** The shared mesh, once there is anyone to draw (debug and tests). */
  get meshOrNull(): Mesh | null {
    return this.mesh;
  }

  spawn(id: EntityId, view: CrowdDescriptor, t: Transform): void {
    const key = `${view.look}:${view.umbrella ? 1 : 0}`;
    let template = this.templates.get(key);
    if (!template) {
      template = buildPuppet(crowdLook(view.look), view.umbrella);
      this.templates.set(key, template);
    }
    this.members.set(id, { template, umbrella: view.umbrella, transform: t, state: freshPuppet(), lift: groundLift(t.position.x, t.position.y, t.position.z), offset: 0, shown: false });
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

  setActivity(id: EntityId, activity: ActivityId | null): void {
    const m = this.members.get(id);
    if (m) setPuppetActivity(m.state, activity);
  }

  clear(): void {
    this.members.clear();
    this.dirty = true;
  }

  /** Poses everyone in range and uploads the figures. Call once per frame before rendering. */
  update(dt: number): void {
    if (this.dirty) this.rebuild();
    const mesh = this.mesh;
    if (!mesh) return;
    const eye = this.deps.eye();
    const limit = this.deps.drawDistance * this.deps.drawDistance;
    this.min.set(Infinity, Infinity, Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    let any = false;
    for (const m of this.members.values()) {
      const p = m.transform.position;
      const near = (p.x - eye.x) ** 2 + (p.z - eye.z) ** 2 <= limit;
      if (!near) {
        if (m.shown) this.collapse(m);
        m.shown = false;
        continue;
      }
      m.shown = true;
      any = true;
      const t = m.transform;
      stepPuppet(m.state, t.speed, t.crouch ?? 0, dt);
      m.lift = easeLift(m.lift, groundLift(p.x, p.y, p.z), dt);
      const pose = puppetPose(m.state, t.speed, m.template.dims, m.umbrella);
      poseParts(this.parts, m.template.dims, pose, p.x, p.y + m.lift, p.z, t.yaw);
      this.write(m);
      this.min.set(Math.min(this.min.x, p.x - PAD), Math.min(this.min.y, p.y - 0.2), Math.min(this.min.z, p.z - PAD));
      this.max.set(Math.max(this.max.x, p.x + PAD), Math.max(this.max.y, p.y + TOP), Math.max(this.max.z, p.z + PAD));
    }
    if (mesh.isEnabled(false) !== any) mesh.setEnabled(any);
    if (!any) return;
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.updateVerticesData(VertexBuffer.NormalKind, this.normals, false, false);
    mesh.buildBoundingInfo(this.min, this.max);
  }

  /** Bakes one figure's parts into the shared buffers. */
  private write(m: Member): void {
    const { positions: src, normals: nsrc, parts, vertexCount } = m.template;
    const pos = this.positions;
    const nor = this.normals;
    let o = m.offset * 3;
    for (let v = 0; v < vertexCount; v++, o += 3) {
      const a = this.parts[parts[v] as number] as Float64Array;
      const i = v * 3;
      const x = src[i] as number;
      const y = src[i + 1] as number;
      const z = src[i + 2] as number;
      pos[o] = (a[0] as number) * x + (a[1] as number) * y + (a[2] as number) * z + (a[3] as number);
      pos[o + 1] = (a[4] as number) * x + (a[5] as number) * y + (a[6] as number) * z + (a[7] as number);
      pos[o + 2] = (a[8] as number) * x + (a[9] as number) * y + (a[10] as number) * z + (a[11] as number);
      const nx = nsrc[i] as number;
      const ny = nsrc[i + 1] as number;
      const nz = nsrc[i + 2] as number;
      nor[o] = (a[0] as number) * nx + (a[1] as number) * ny + (a[2] as number) * nz;
      nor[o + 1] = (a[4] as number) * nx + (a[5] as number) * ny + (a[6] as number) * nz;
      nor[o + 2] = (a[8] as number) * nx + (a[9] as number) * ny + (a[10] as number) * nz;
    }
  }

  /** Out of range: its triangles fold into a point at its feet, so they draw nothing. */
  private collapse(m: Member): void {
    const p = m.transform.position;
    const end = (m.offset + m.template.vertexCount) * 3;
    for (let o = m.offset * 3; o < end; o += 3) {
      this.positions[o] = p.x;
      this.positions[o + 1] = p.y;
      this.positions[o + 2] = p.z;
    }
  }

  /** Lays out the shared buffers for who is in the world now: colours and triangles change only here. */
  private rebuild(): void {
    this.dirty = false;
    let total = 0;
    let triangles = 0;
    for (const m of this.members.values()) {
      m.offset = total;
      m.shown = false;
      total += m.template.vertexCount;
      triangles += m.template.indices.length;
    }
    if (total === 0) {
      this.mesh?.setEnabled(false);
      return;
    }
    this.positions = new Float32Array(total * 3);
    this.normals = new Float32Array(total * 3);
    const colors = new Float32Array(total * 4);
    const indices = new Uint32Array(triangles);
    let k = 0;
    for (const m of this.members.values()) {
      colors.set(m.template.colors, m.offset * 4);
      for (const i of m.template.indices) indices[k++] = i + m.offset;
      this.collapse(m);
    }
    const mesh = this.mesh ?? this.createMesh();
    mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, this.normals, true, 3);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
    mesh.setIndices(indices, total);
  }

  private createMesh(): Mesh {
    const mesh = new MeshClass("crowd", this.deps.scene);
    mesh.material = this.deps.materials.get("crowd");
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    applyOutline(mesh);
    mesh.freezeWorldMatrix();
    this.mesh = mesh;
    return mesh;
  }
}
