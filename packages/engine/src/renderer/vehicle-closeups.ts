import type { Transform } from "@seki/core";
import { type GlowLayer, type Mesh, MeshClass, type Plane, type Scene, type ShaderMaterial, type Vector3, VertexBuffer } from "../babylon";
import { rampPitch } from "./alchemia/parking-traffic";
import type { VehicleTemplate } from "./vehicle-models";

/**
 * Writes a template turned by the yaw and moved to the transform into `positions` and `normals` at
 * vertex `offset`; on Alchemia's ramp down to P-1 its nose tipped to the ramp's grade first
 * (`rampPitch`), a car with physics (ADR-0097) by its own tilt.
 */
export const placeTemplate = (t: VehicleTemplate, positions: Float32Array, normals: Float32Array, offset: number, tr: Transform): void => {
  const c = Math.cos(tr.yaw);
  const s = Math.sin(tr.yaw);
  // A car with physics brings its own tilt: its nose up is the negative of its pitch.
  const pitch = tr.tilt ? -tr.tilt.pitch : rampPitch(tr.position.x, tr.position.z, tr.yaw);
  const roll = tr.tilt?.roll ?? 0;
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  const [cr, sr] = [Math.cos(roll), Math.sin(roll)];
  const { x: px, y: py, z: pz } = tr.position;
  const src = t.positions;
  const nsrc = t.normals;
  let o = offset * 3;
  for (let i = 0; i < src.length; i += 3, o += 3) {
    // Over to its right about its own z (its right side down), nose up about its own x (its front +z), then its heading about y.
    const x0 = src[i] as number;
    const y0 = src[i + 1] as number;
    const x = x0 * cr + y0 * sr;
    const yr = y0 * cr - x0 * sr;
    const y = yr * cp + (src[i + 2] as number) * sp;
    const z = (src[i + 2] as number) * cp - yr * sp;
    positions[o] = px + x * c + z * s;
    positions[o + 1] = py + y;
    positions[o + 2] = pz - x * s + z * c;
    const nx0 = nsrc[i] as number;
    const ny0 = nsrc[i + 1] as number;
    const nx = nx0 * cr + ny0 * sr;
    const nyr = ny0 * cr - nx0 * sr;
    const ny = nyr * cp + (nsrc[i + 2] as number) * sp;
    const nz = (nsrc[i + 2] as number) * cp - nyr * sp;
    normals[o] = nx * c + nz * s;
    normals[o + 1] = ny;
    normals[o + 2] = -nx * s + nz * c;
  }
};

/** Folds `count` vertices from `offset` into a point, so their triangles draw nothing. */
export const foldVertices = (positions: Float32Array, offset: number, count: number, p: { x: number; y: number; z: number }): void => {
  const end = (offset + count) * 3;
  for (let o = offset * 3; o < end; o += 3) {
    positions[o] = p.x;
    positions[o + 1] = p.y;
    positions[o + 2] = p.z;
  }
};

/** What of a fleet's vehicle the pool needs: where it is, its close-up, its place in the pool. */
export interface PoolMember {
  readonly transform: Transform;
  slot: number;
}

/**
 * The close-ups of the nearest few vehicles of a fleet (19.11): a fixed pool of places for one
 * close-up each (discrete LOD with a fixed pool of the finest level), in a mesh of its own so the
 * close-up can wear its own texture (`VehicleTemplate.skin`, user's notes of 21.11): one more draw
 * call while a close-up is shown, none otherwise. Each place is laid out once for the close-up's
 * topology; a vehicle takes a place, is written into it every frame it moves, and gives it back
 * folded.
 */
export class CloseUpPool<M extends PoolMember> {
  private mesh: Mesh | null = null;
  private positions = new Float32Array(0);
  private normals = new Float32Array(0);
  private colors = new Float32Array(0);
  private owners: (M | null)[] = [];
  private verts = 0;
  private painted = false;
  private wrote = false;

  constructor(
    private readonly scene: Scene,
    private readonly name: string,
    private readonly glow: GlowLayer | null,
    /** The fleet's view test: the pool is in the view when one of its vehicles is. */
    private readonly inView: (planes: readonly Plane[]) => boolean,
  ) {}

  /** Places in the pool. */
  get places(): number {
    return this.owners.length;
  }

  /** A place's vertices: the close-up's that the pool is laid out for (0 with no pool). */
  get vertexCount(): number {
    return this.verts;
  }

  /** The vehicles holding a place now. */
  holders(): IterableIterator<[number, M | null]> {
    return this.owners.entries();
  }

  /** Lays the pool out for `places` close-ups of `high` on `material`; none with no close-up. Every place is given back. */
  layout(high: VehicleTemplate | null, places: number, material: ShaderMaterial): void {
    for (const m of this.owners) if (m) m.slot = -1;
    const count = high ? places : 0;
    this.owners = Array.from({ length: count }, () => null);
    this.verts = high?.vertexCount ?? 0;
    if (!high || count === 0) {
      this.mesh?.setEnabled(false);
      return;
    }
    const total = count * this.verts;
    this.positions = new Float32Array(total * 3);
    this.normals = new Float32Array(total * 3);
    this.colors = new Float32Array(total * 4);
    const uvs = new Float32Array(total * 2);
    const indices = new Uint32Array(count * high.indices.length);
    let k = 0;
    for (let slot = 0; slot < count; slot++) {
      const at = slot * this.verts;
      uvs.set(high.uvs, at * 2);
      this.colors.set(high.colors, at * 4);
      for (const i of high.indices) indices[k++] = i + at;
    }
    const mesh = this.mesh ?? this.createMesh();
    mesh.material = material;
    mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, this.normals, true, 3);
    mesh.setVerticesData(VertexBuffer.UVKind, uvs, false, 2);
    mesh.setVerticesData(VertexBuffer.ColorKind, this.colors, true, 4);
    mesh.setIndices(indices, total);
    mesh.setEnabled(false);
  }

  /** A free place for `m`, painted in the colours of its close-up `high`; false when none is free. */
  take(m: M, high: VehicleTemplate): boolean {
    const slot = this.owners.indexOf(null);
    if (slot < 0 || high.vertexCount !== this.verts) return false;
    this.owners[slot] = m;
    m.slot = slot;
    this.colors.set(high.colors, slot * this.verts * 4);
    this.painted = true;
    return true;
  }

  /** Gives back the place of `slot`: its close-up folded at `at`. */
  release(slot: number, at: { x: number; y: number; z: number }): void {
    const m = this.owners[slot];
    if (!m) return;
    foldVertices(this.positions, slot * this.verts, this.verts, at);
    this.owners[slot] = null;
    m.slot = -1;
    this.wrote = true;
  }

  /** Writes the close-up `high` of the holder of `slot` where its transform puts it. */
  place(slot: number, high: VehicleTemplate, tr: Transform): void {
    placeTemplate(high, this.positions, this.normals, slot * this.verts, tr);
    this.wrote = true;
  }

  /** Sends what changed this frame to the mesh, shown while a place is held; its bounds those of the fleet. */
  upload(min: Vector3, max: Vector3): void {
    const mesh = this.mesh;
    if (!mesh) return;
    const shown = this.owners.some((m) => m !== null);
    if (mesh.isEnabled(false) !== shown) mesh.setEnabled(shown);
    if (!shown || !this.wrote) return;
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.updateVerticesData(VertexBuffer.NormalKind, this.normals, false, false);
    if (this.painted) mesh.updateVerticesData(VertexBuffer.ColorKind, this.colors, false, false);
    mesh.buildBoundingInfo(min, max);
    this.wrote = false;
    this.painted = false;
  }

  /** True while the pool's mesh is drawn (stats). */
  get drawn(): boolean {
    return this.mesh?.isEnabled() ?? false;
  }

  private createMesh(): Mesh {
    const mesh = new MeshClass(`${this.name}-hi`, this.scene);
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    mesh.freezeWorldMatrix();
    this.glow?.addIncludedOnlyMesh(mesh);
    mesh.isInFrustum = (planes) => this.inView(planes);
    this.mesh = mesh;
    return mesh;
  }
}
