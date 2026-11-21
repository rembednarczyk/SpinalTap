import type { EntityId, Transform, ViewDescriptor } from "@seki/core";
import { type GlowLayer, type Mesh, MeshClass, type Plane, type Scene, Vector3, VertexBuffer } from "../babylon";
import type { RenderQuality } from "../npr/quality";
import type { CityKit } from "./city-kit";
import { type VehicleTemplate, paintOf, vehicleTemplates } from "./vehicle-models";
import { pickVariant } from "./vehicle-variants";
import type { CarAt } from "./alchemia/parking-traffic";
import { CloseUpPool, foldVertices, placeTemplate } from "./vehicle-closeups";
import { CarSmoke } from "./car-smoke";

export type VehicleDescriptor = Extract<ViewDescriptor, { kind: "vehicle" }>;

/** Vehicles driving and parked, those drawn last frame near (close-ups among them) and far, and the meshes drawn (debug, tests). */
export interface FleetStats {
  readonly driving: number;
  readonly parked: number;
  readonly near: number;
  readonly high: number;
  readonly far: number;
  readonly meshes: number;
}

/**
 * How far vehicles are drawn, where the far version takes over (m from the camera), and how many of
 * the nearest wear their close-up within how far (19.11), per quality: `high` places for the parked
 * cars, `driving` for those on the move. The close-ups take places of a pool in the shared mesh
 * (discrete LOD with a fixed pool of the finest level, as the drones' places), so the mesh holds the
 * close-up a few times, not once per car of the city. The driving ones' pool is small, as their
 * buffers go up every frame; its first place is the player's car's, the nearest one (21.11).
 */
export const VEHICLE_LOD: Readonly<Record<RenderQuality, { readonly near: number; readonly draw: number; readonly high: number; readonly driving: number; readonly highReach: number }>> = {
  high: { near: 90, draw: 240, high: 12, driving: 2, highReach: 45 },
  medium: { near: 70, draw: 180, high: 8, driving: 1, highReach: 35 },
  low: { near: 45, draw: 120, high: 0, driving: 0, highReach: 0 },
};

interface Pair {
  readonly near: VehicleTemplate;
  readonly far: VehicleTemplate;
  readonly high?: VehicleTemplate;
}

type Shown = "high" | "near" | "far" | "none";

interface Member {
  readonly view: VehicleDescriptor;
  transform: Transform;
  pair: Pair | null;
  /** First vertex of its near geometry in the shared buffers; the far one follows it. */
  offset: number;
  /** What was drawn last frame; a parked car is written only when this changes. */
  shown: Shown;
  /** Its place in the close-ups' pool while it wears its close-up, else -1. */
  slot: number;
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
/** A vehicle's box for the view test: half its height and its centre above its position (m), 1 below to 7 above. */
const HALF_HEIGHT = 4;
const MID_HEIGHT = 3;

/** Whether the box round a vehicle at `x, y, z` reaches into the view the planes bound (Babylon's: inside is `≥ 0`). */
const boxInView = (planes: readonly Plane[], x: number, y: number, z: number): boolean => {
  const cy = y + MID_HEIGHT;
  for (const { normal: n, d } of planes) {
    if (n.x * x + n.y * cy + n.z * z + d + (Math.abs(n.x) + Math.abs(n.z)) * PAD + Math.abs(n.y) * HALF_HEIGHT < 0) return false;
  }
  return true;
};

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
  /** The close-ups of the nearest few, in a mesh of their own on their skin (user's notes of 21.11). */
  private readonly closeUps: CloseUpPool<Member>;
  /** Positions of the vehicles drawn now, x y z each: what the view test looks at. */
  private readonly drawn: number[] = [];
  private kitSeen: CityKit | null = null;
  private propsSeen: CityKit["loadedProps"] = null;

  constructor(
    private readonly deps: VehicleViewsDeps,
    private readonly name: string,
    /** Its pool of close-ups in `VEHICLE_LOD`: the parked cars' (`high`) or the driving ones' (`driving`). */
    private readonly pool: "high" | "driving",
  ) {
    this.closeUps = new CloseUpPool<Member>(deps.scene, name, deps.glow, (planes) => this.inView(planes));
  }

  has(id: EntityId): boolean {
    return this.members.has(id);
  }

  get size(): number {
    return this.members.size;
  }

  /** Vehicles driving and parked, those drawn last frame near and far, and the meshes drawn (debug, tests). */
  get stats(): FleetStats {
    let near = 0;
    let far = 0;
    let high = 0;
    let parked = 0;
    for (const m of this.members.values()) {
      if (m.view.parked) parked++;
      if (m.shown === "near") near++;
      else if (m.shown === "high") high++;
      else if (m.shown === "far") far++;
    }
    return { driving: this.members.size - parked, parked, near: near + high, high, far, meshes: (this.mesh?.isEnabled() ? 1 : 0) + (this.closeUps.drawn ? 1 : 0) };
  }

  spawn(id: EntityId, view: VehicleDescriptor, t: Transform): void {
    this.members.set(id, { view, transform: t, pair: null, offset: 0, shown: "none", slot: -1 });
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

  /** Where each one is and its heading. */
  *cars(): IterableIterator<CarAt> {
    for (const m of this.members.values()) yield { x: m.transform.position.x, z: m.transform.position.z, yaw: m.transform.yaw };
  }

  /** The damaged vehicles' transforms, nearest to `eye` first (their smoke). */
  damaged(eye: { x: number; z: number }): Transform[] {
    const near = (t: Transform) => Math.hypot(t.position.x - eye.x, t.position.z - eye.z);
    return [...this.members.values()].map((m) => m.transform).filter((t) => (t.damage ?? 0) > 0).sort((a, b) => near(a) - near(b));
  }

  clear(): void {
    this.members.clear();
    this.dirty = true;
  }

  /** Moves everyone in range and rebuilds the buffers when vehicles came or went. Call once per frame. */
  update(kit: CityKit, eye: { x: number; z: number }): void {
    // The vehicles' looks come with the props files (ADR-0058 stage 4), after the kit.
    if (kit !== this.kitSeen || kit.loadedProps !== this.propsSeen) {
      this.kitSeen = kit;
      this.propsSeen = kit.loadedProps;
      this.templates.clear();
      this.dirty = true;
    }
    if (this.dirty) this.rebuild(kit);
    this.draw(eye);
  }

  private pairOf(kit: CityKit, view: VehicleDescriptor): Pair | null {
    const props = kit.loadedProps;
    const variant = pickVariant(view.model, view.tint, (k) => kit.data.models.has(k) || (props?.data.models.has(k) ?? false));
    const paint = variant?.paint ?? paintOf(view.model, view.tint);
    const key = `${view.model}:${variant?.key ?? ""}:${paint}`;
    if (!this.templates.has(key)) this.templates.set(key, vehicleTemplates(kit.data, view.model, paint, { props, variant, lite: this.deps.quality === "low" }));
    return this.templates.get(key) ?? null;
  }

  private draw(eye: { x: number; z: number }): void {
    const mesh = this.mesh;
    if (!mesh) return;
    const lod = VEHICLE_LOD[this.deps.quality];
    this.min.set(Infinity, Infinity, Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    let any = false;
    let wrote = this.releaseHigh(this.closest(eye));
    this.drawn.length = 0;
    for (const m of this.members.values()) {
      const pair = m.pair;
      if (!pair) continue;
      const p = m.transform.position;
      const dist = Math.hypot(p.x - eye.x, p.z - eye.z);
      const want: Shown = dist > lod.draw ? "none" : dist > lod.near ? "far" : m.shown === "high" || this.wantsHigh.has(m) ? "high" : "near";
      const changed = want !== m.shown;
      if (changed) {
        if (m.shown === "near") foldVertices(this.positions, m.offset, pair.near.vertexCount, p);
        if (m.shown === "far") foldVertices(this.positions, m.offset + pair.near.vertexCount, pair.far.vertexCount, p);
        if (want === "high" && pair.high) this.closeUps.take(m, pair.high);
        m.shown = want === "high" && m.slot < 0 ? "near" : want;
        wrote = true;
      }
      if (m.shown === "none") continue;
      any = true;
      this.drawn.push(p.x, p.y, p.z);
      if (changed || !m.view.parked) {
        wrote = true;
        if (m.shown === "high") this.closeUps.place(m.slot, pair.high!, m.transform);
        else if (m.shown === "near") placeTemplate(pair.near, this.positions, this.normals, m.offset, m.transform);
        else placeTemplate(pair.far, this.positions, this.normals, m.offset + pair.near.vertexCount, m.transform);
      }
      this.min.set(Math.min(this.min.x, p.x - PAD), Math.min(this.min.y, p.y - 1), Math.min(this.min.z, p.z - PAD));
      this.max.set(Math.max(this.max.x, p.x + PAD), Math.max(this.max.y, p.y + 7), Math.max(this.max.z, p.z + PAD));
    }
    this.closeUps.upload(this.min, this.max);
    if (mesh.isEnabled(false) !== any) mesh.setEnabled(any);
    if (!any || !wrote) return;
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.updateVerticesData(VertexBuffer.NormalKind, this.normals, false, false);
    mesh.buildBoundingInfo(this.min, this.max);
  }

  /** Those of the vehicles with a close-up that should wear it: the nearest within reach, as many as the pool has places. */
  private readonly wantsHigh = new Set<Member>();

  private closest(eye: { x: number; z: number }): ReadonlySet<Member> {
    this.wantsHigh.clear();
    const lod = VEHICLE_LOD[this.deps.quality];
    if (this.closeUps.places === 0) return this.wantsHigh;
    const near: [number, Member][] = [];
    for (const m of this.members.values()) {
      if (m.pair?.high?.vertexCount !== this.closeUps.vertexCount) continue;
      const p = m.transform.position;
      const d = Math.hypot(p.x - eye.x, p.z - eye.z);
      if (d <= Math.min(lod.highReach, lod.near)) near.push([d, m]);
    }
    near.sort((a, b) => a[0] - b[0]);
    for (const [, m] of near.slice(0, this.closeUps.places)) this.wantsHigh.add(m);
    return this.wantsHigh;
  }

  /** Gives back the places of those no longer among the nearest: their close-up folded, their near version drawn again. True when it gave one back. */
  private releaseHigh(keep: ReadonlySet<Member>): boolean {
    let gave = false;
    for (const [slot, m] of [...this.closeUps.holders()]) {
      if (!m || keep.has(m)) continue;
      this.closeUps.release(slot, m.transform.position);
      m.shown = "none";
      gave = true;
    }
    return gave;
  }

  /** Lays out the shared buffers for the vehicles there are now: colours, UVs and triangles change only here. */
  private rebuild(kit: CityKit): void {
    this.dirty = false;
    let total = 0;
    let triangles = 0;
    let high: VehicleTemplate | null = null;
    for (const m of this.members.values()) {
      m.pair = this.pairOf(kit, m.view);
      m.offset = total;
      m.shown = "none";
      m.slot = -1;
      if (!m.pair) continue;
      high ??= m.pair.high ?? null;
      total += m.pair.near.vertexCount + m.pair.far.vertexCount;
      triangles += m.pair.near.indices.length + m.pair.far.indices.length;
    }
    // The close-ups' pool in its own mesh, on the close-up's skin when it has one (else the kit's palette).
    this.closeUps.layout(high, VEHICLE_LOD[this.deps.quality][this.pool], (high?.skin ? kit.skinMaterial(high.skin) : null) ?? kit.material);
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
        foldVertices(this.positions, at, t.vertexCount, m.transform.position);
        at += t.vertexCount;
      }
    }
    const mesh = this.mesh ?? this.createMesh(kit);
    mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, this.normals, true, 3);
    mesh.setVerticesData(VertexBuffer.UVKind, uvs, false, 2);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, true, 4);
    mesh.setIndices(indices, total);
  }

  private createMesh(kit: CityKit): Mesh {
    const mesh = new MeshClass(this.name, this.deps.scene);
    mesh.material = kit.material;
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    mesh.freezeWorldMatrix();
    this.deps.glow?.addIncludedOnlyMesh(mesh);
    // The bounds hold every vehicle in range, and their sphere (Babylon's default test) reaches into
    // the view with cars far behind the camera and to its sides (G-595): the fleet is in the view
    // only when one of its vehicles is.
    mesh.isInFrustum = (planes) => this.inView(planes);
    this.mesh = mesh;
    return mesh;
  }

  private inView(planes: readonly Plane[]): boolean {
    const d = this.drawn;
    for (let i = 0; i < d.length; i += 3) if (boxInView(planes, d[i] as number, d[i + 1] as number, d[i + 2] as number)) return true;
    return false;
  }
}

/**
 * The street's vehicles (ADR-0050), drawn in bulk on the city kit's material: the driving ones in
 * one shared mesh, moved on the CPU each frame, the parked cars of the whole city in another;
 * one draw call per pass each however many there are. Near ones are the kit's models, far ones a
 * few boxes, the farthest folded away; with `vehicle-props.glb` each has the look its seed picks
 * (ADR-0058 stage 4), its far version after its silhouette and, on phones, its light version. Their lamps glow. No moon shadow, no outline: like the
 * kit's buildings.
 */
export class VehicleViews {
  private readonly driving: Fleet;
  private readonly parked: Fleet;
  /** Smoke from the damaged cars' bonnets (ADR-0097 §5). */
  private readonly smoke: CarSmoke;

  constructor(private readonly deps: VehicleViewsDeps) {
    this.driving = new Fleet(deps, "vehicles", "driving");
    this.parked = new Fleet(deps, "parked", "high");
    this.smoke = new CarSmoke(deps.scene);
  }

  /** True while a damaged car smokes (tests, stats). */
  get smoking(): boolean {
    return this.smoke.drawn;
  }

  has(id: EntityId): boolean {
    return this.driving.has(id) || this.parked.has(id);
  }

  get size(): number {
    return this.driving.size + this.parked.size;
  }

  /** Vehicles driving and parked, those drawn last frame near and far, and the meshes drawn (debug, tests). */
  get stats(): FleetStats {
    const d = this.driving.stats;
    const p = this.parked.stats;
    return { driving: d.driving, parked: p.parked, near: d.near + p.near, high: d.high + p.high, far: d.far + p.far, meshes: d.meshes + p.meshes };
  }

  spawn(id: EntityId, view: VehicleDescriptor, t: Transform): void {
    this.despawn(id);
    (view.parked ? this.parked : this.driving).spawn(id, view, t);
  }

  /** False for an unknown id. */
  move(id: EntityId, t: Transform): boolean {
    return this.driving.move(id, t);
  }

  /** The vehicles driving now, where each one is and its heading (Alchemia's P-1 lifts its shutters before them). */
  cars(): IterableIterator<CarAt> {
    return this.driving.cars();
  }

  despawn(id: EntityId): void {
    this.driving.despawn(id);
    this.parked.despawn(id);
  }

  clear(): void {
    this.driving.clear();
    this.parked.clear();
  }

  /** Call once per frame (`dt` s on) before rendering; nothing is drawn before the kit has loaded. */
  update(dt = 0): void {
    const kit = this.deps.kit();
    if (!kit) return;
    const eye = this.deps.eye();
    this.driving.update(kit, eye);
    this.parked.update(kit, eye);
    this.smoke.update(dt, this.driving.damaged(eye));
  }
}
