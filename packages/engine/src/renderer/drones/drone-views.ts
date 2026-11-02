import { type GlowLayer, type Mesh, MeshClass, type Scene, Vector3, VertexBuffer } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { CityKit } from "../city-kit";
import type { CityProps } from "../city-props";
import { type Drone, type DroneKind, DRONE_KINDS, type DronePose, droneFleet, dronePose } from "./drone-flight";
import { type DroneLane, type DroneWorld, planDroneLanes } from "./drone-lanes";
import { type DroneTemplate, droneTemplates } from "./drone-models";

/**
 * How far drones are drawn (m from the camera), where the far version takes over, and how many of
 * each kind are drawn at once near and far, per quality. Phones draw none (`DRONE_SPACING`).
 */
export const DRONE_LOD: Readonly<Record<RenderQuality, { readonly near: number; readonly draw: number; readonly nearSlots: number; readonly farSlots: number }>> = {
  high: { near: 120, draw: 420, nearSlots: 4, farSlots: 10 },
  medium: { near: 90, draw: 300, nearSlots: 2, farSlots: 5 },
  low: { near: 0, draw: 0, nearSlots: 0, farSlots: 0 },
};

/** The map's world for the lanes and a count that changes whenever it does. */
export interface DroneSource {
  readonly version: number;
  readonly world: () => DroneWorld;
}

export interface DroneViewsDeps {
  readonly scene: Scene;
  /** The city kit once it has loaded: its material (ADR-0022). */
  readonly kit: () => CityKit | null;
  /** The props files once they have loaded: the drones' models (`drone-props.glb`). */
  readonly props: () => CityProps | null;
  /** The map city's buildings and streets, null without map data. */
  readonly source: () => DroneSource | null;
  readonly glow: GlowLayer | null;
  readonly eye: () => { readonly x: number; readonly y: number; readonly z: number };
  readonly quality: RenderQuality;
  /** Plans the lanes (default `planDroneLanes`; tests hand fixed ones). */
  readonly plan?: (world: DroneWorld) => readonly DroneLane[];
}

/** A place in the shared buffers for one drone of a kind at one level of detail. */
interface Slot {
  readonly kind: DroneKind;
  readonly near: boolean;
  readonly template: DroneTemplate;
  readonly offset: number;
  shown: boolean;
}

/** Room round a drone for the mesh's bounds (m). */
const PAD = 4;

/**
 * The drones over the street canyons (ADR-0058 stage 7), behind the `BabylonRenderer` facade: all
 * of them in one shared mesh on the city kit's material, moved on the CPU each frame, so one draw
 * call per pass however many fly (the only new draw calls of ADR-0058). The mesh holds a few slots
 * per kind, near and far; each frame the nearest drones take them and the rest are not drawn. The
 * lanes are planned once the map's views stop changing. No moon shadow, no outline; the lights glow.
 */
export class DroneViews {
  private lanes: readonly DroneLane[] = [];
  private fleet: readonly Drone[] = [];
  private planned = -1;
  private seen = -1;
  private time = 0;
  private mesh: Mesh | null = null;
  private slots: Slot[] = [];
  private positions = new Float32Array(0);
  private normals = new Float32Array(0);
  private kitSeen: CityKit | null = null;
  private propsSeen: CityProps | null = null;
  private drawnNear = 0;
  private drawnFar = 0;
  private readonly min = new Vector3();
  private readonly max = new Vector3();

  constructor(private readonly deps: DroneViewsDeps) {}

  /** Lanes and drones planned, those drawn last frame near and far, and the meshes drawn (debug, tests). */
  get stats(): { readonly lanes: number; readonly drones: number; readonly near: number; readonly far: number; readonly meshes: number } {
    return { lanes: this.lanes.length, drones: this.fleet.length, near: this.drawnNear, far: this.drawnFar, meshes: this.mesh?.isEnabled() ? 1 : 0 };
  }

  /** Where each drone is now (debug, tests). */
  poses(): { readonly kind: DroneKind; readonly pose: DronePose }[] {
    return this.fleet.map((d) => ({ kind: d.kind, pose: dronePose(d, this.time) }));
  }

  /** Call once per frame before rendering; `frozen` holds the time (the reference still). */
  update(dt: number, frozen: boolean): void {
    if (DRONE_LOD[this.deps.quality].nearSlots === 0) return;
    this.plan();
    const kit = this.deps.kit();
    if (!kit || this.fleet.length === 0) return;
    const props = this.deps.props();
    if (kit !== this.kitSeen || props !== this.propsSeen) this.layout(kit, props);
    if (!frozen) this.time += dt;
    this.draw();
  }

  /** Plans the lanes when the map's views changed and then held still for a frame. */
  private plan(): void {
    const source = this.deps.source();
    if (!source) return;
    const version = source.version;
    if (version !== this.planned && version === this.seen) {
      this.planned = version;
      this.lanes = (this.deps.plan ?? planDroneLanes)(source.world());
      this.fleet = droneFleet(this.lanes, this.deps.quality);
    }
    this.seen = version;
  }

  /** Lays out the shared buffers: per kind its near slots, then its far ones. */
  private layout(kit: CityKit, props: CityProps | null): void {
    this.kitSeen = kit;
    this.propsSeen = props;
    const lod = DRONE_LOD[this.deps.quality];
    const templates = droneTemplates(kit.data, props);
    this.slots = [];
    let total = 0;
    for (const kind of DRONE_KINDS) {
      for (const near of [true, false]) {
        const template = near ? templates[kind].near : templates[kind].far;
        for (let k = 0; k < (near ? lod.nearSlots : lod.farSlots); k++) {
          this.slots.push({ kind, near, template, offset: total, shown: false });
          total += template.vertexCount;
        }
      }
    }
    this.positions = new Float32Array(total * 3);
    this.normals = new Float32Array(total * 3);
    const uvs = new Float32Array(total * 2);
    const colors = new Float32Array(total * 4);
    const indices = new Uint32Array(this.slots.reduce((n, s) => n + s.template.indices.length, 0));
    let k = 0;
    for (const s of this.slots) {
      uvs.set(s.template.uvs, s.offset * 2);
      colors.set(s.template.colors, s.offset * 4);
      for (const i of s.template.indices) indices[k++] = i + s.offset;
    }
    const mesh = this.mesh ?? this.createMesh(kit);
    mesh.setVerticesData(VertexBuffer.PositionKind, this.positions, true, 3);
    mesh.setVerticesData(VertexBuffer.NormalKind, this.normals, true, 3);
    mesh.setVerticesData(VertexBuffer.UVKind, uvs, false, 2);
    mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
    mesh.setIndices(indices, total);
    mesh.setEnabled(false);
  }

  /** The nearest drones of each kind into its slots, near ones first; the slots left over fold away. */
  private draw(): void {
    const mesh = this.mesh;
    if (!mesh) return;
    const lod = DRONE_LOD[this.deps.quality];
    const eye = this.deps.eye();
    const seen = this.fleet
      .map((d) => {
        const p = dronePose(d, this.time);
        return { kind: d.kind, p, dist: Math.hypot(p.x - eye.x, p.y - eye.y, p.z - eye.z) };
      })
      .filter((s) => s.dist <= lod.draw)
      .sort((a, b) => a.dist - b.dist);
    this.min.set(Infinity, Infinity, Infinity);
    this.max.set(-Infinity, -Infinity, -Infinity);
    this.drawnNear = 0;
    this.drawnFar = 0;
    const used = new Set<Slot>();
    const take = (kind: DroneKind, near: boolean): Slot | undefined => this.slots.find((f) => f.kind === kind && f.near === near && !used.has(f));
    for (const s of seen) {
      const slot = (s.dist <= lod.near ? take(s.kind, true) : undefined) ?? take(s.kind, false);
      if (!slot) continue;
      used.add(slot);
      if (slot.near) this.drawnNear++;
      else this.drawnFar++;
      this.place(slot, s.p);
      this.min.set(Math.min(this.min.x, s.p.x - PAD), Math.min(this.min.y, s.p.y - 1), Math.min(this.min.z, s.p.z - PAD));
      this.max.set(Math.max(this.max.x, s.p.x + PAD), Math.max(this.max.y, s.p.y + PAD), Math.max(this.max.z, s.p.z + PAD));
    }
    for (const slot of this.slots) {
      if (!used.has(slot) && slot.shown) this.fold(slot);
      slot.shown = used.has(slot);
    }
    const any = used.size > 0;
    if (mesh.isEnabled(false) !== any) mesh.setEnabled(any);
    if (!any) return;
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.updateVerticesData(VertexBuffer.NormalKind, this.normals, false, false);
    mesh.buildBoundingInfo(this.min, this.max);
  }

  /** Writes a slot's template turned by the yaw and moved to the pose. */
  private place(slot: Slot, p: DronePose): void {
    const c = Math.cos(p.yaw);
    const s = Math.sin(p.yaw);
    const src = slot.template.positions;
    const nsrc = slot.template.normals;
    let o = slot.offset * 3;
    for (let i = 0; i < src.length; i += 3, o += 3) {
      const x = src[i] as number;
      const z = src[i + 2] as number;
      this.positions[o] = p.x + x * c + z * s;
      this.positions[o + 1] = p.y + (src[i + 1] as number);
      this.positions[o + 2] = p.z - x * s + z * c;
      const nx = nsrc[i] as number;
      const nz = nsrc[i + 2] as number;
      this.normals[o] = nx * c + nz * s;
      this.normals[o + 1] = nsrc[i + 1] as number;
      this.normals[o + 2] = -nx * s + nz * c;
    }
  }

  /** Folds a slot's vertices into one point, so its triangles draw nothing. */
  private fold(slot: Slot): void {
    const start = slot.offset * 3;
    const end = start + slot.template.vertexCount * 3;
    const [x, y, z] = [this.positions[start] ?? 0, this.positions[start + 1] ?? 0, this.positions[start + 2] ?? 0];
    for (let o = start; o < end; o += 3) {
      this.positions[o] = x;
      this.positions[o + 1] = y;
      this.positions[o + 2] = z;
    }
  }

  private createMesh(kit: CityKit): Mesh {
    const mesh = new MeshClass("drones", this.deps.scene);
    mesh.material = kit.material;
    mesh.isPickable = false;
    mesh.doNotSyncBoundingInfo = true;
    mesh.freezeWorldMatrix();
    this.deps.glow?.addIncludedOnlyMesh(mesh);
    this.mesh = mesh;
    return mesh;
  }
}
