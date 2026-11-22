import { ROOM_DETAILS } from "@seki/sim";
import type { StreetPropItem, Vec3 } from "@seki/core";
import type { Mesh, Scene } from "../babylon";
import type { RenderQuality } from "../npr/quality";
import type { ToonMaterials } from "../npr/toon-material";
import type { CityProps } from "./city-props";
import { sinkToMesh } from "./dressing";
import { MeshSink } from "./mesh-sink";
import { toWorld } from "./mapcity/prop-batch";
import { bakeRoomDetail } from "./mapcity/room-detail-models";

export interface RoomDetailDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** The rooms' detail's models once the props files have loaded (ADR-0098). */
  readonly props: () => CityProps | null;
  readonly eye: () => Vec3;
  readonly quality: RenderQuality;
}

/** How near a room the eye draws its detail (m from its box, up and down too), per quality: through its door or window, not from the next street. */
export const ROOM_DETAIL_NEAR: Readonly<Record<RenderQuality, number>> = { high: 45, medium: 35, low: 25 };
/** Past the edge a shown room's detail stays this much longer, so it does not blink at it. */
const HOLD = 5;

interface Room {
  readonly items: readonly StreetPropItem[];
  readonly box: { readonly x0: number; readonly x1: number; readonly y0: number; readonly y1: number; readonly z0: number; readonly z1: number };
  /** Its detail baked, the first time it came near after the props had loaded. */
  sink: MeshSink | null;
  near: boolean;
}

const boxOf = (items: readonly StreetPropItem[]): Room["box"] => {
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const zs = items.map((i) => i.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) };
};

const out = (v: number, a: number, b: number): number => (v < a ? a - v : v > b ? v - b : 0);
const distance = (e: Vec3, b: Room["box"]): number => Math.hypot(out(e.x, b.x0, b.x1), out(e.y, b.y0, b.y1), out(e.z, b.z0, b.z1));

/** The sinks one after another in one. */
const joined = (sinks: readonly MeshSink[]): MeshSink => {
  const all = new MeshSink();
  for (const k of sinks) {
    const base = all.vertexCount;
    all.positions.push(...k.positions);
    all.normals.push(...k.normals);
    all.colors.push(...k.colors);
    all.uvs.push(...k.uvs);
    all.uvs2.push(...k.uvs2);
    for (const i of k.indices) all.indices.push(base + i);
  }
  return all;
};

/**
 * The rooms' detail built by Blender after their cards (ADR-0098), behind the `BabylonRenderer` facade: each room's
 * models baked the first time the eye comes near it after the props have loaded, the rooms within `ROOM_DETAIL_NEAR`
 * of it drawn as one mesh on the street props' material, made again when that set changes. In the city's furniture
 * blocks they were drawn whole from 170 m (`PROP_LOD`), a room's walls between: Neon Koi's bar from the street, W-3's
 * hall's pallets over a phone's budget. One mesh near any room (P-2 and its shelter under it are two rooms), none away.
 */
export class RoomDetailViews {
  private readonly rooms: Room[] = ROOM_DETAILS.filter((r) => r.length > 0).map((items) => ({ items, box: boxOf(items), sink: null, near: false }));
  private mesh: Mesh | null = null;
  private props: CityProps | null = null;

  constructor(private readonly deps: RoomDetailDeps) {}

  /** The rooms drawn now and their triangles (debug, tests). */
  get stats(): { readonly shown: number; readonly triangles: number; readonly meshes: number } {
    const on = this.mesh?.isEnabled(false) ?? false;
    return { shown: on ? this.rooms.filter((r) => r.near).length : 0, triangles: on && this.mesh ? this.mesh.getTotalIndices() / 3 : 0, meshes: on ? 1 : 0 };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const props = this.deps.props();
    const e = this.deps.eye();
    const reach = ROOM_DETAIL_NEAR[this.deps.quality];
    let changed = props !== this.props;
    if (changed) {
      this.props = props;
      for (const r of this.rooms) r.sink = null;
    }
    for (const r of this.rooms) {
      const near = props !== null && distance(e, r.box) < reach + (r.near ? HOLD : 0);
      if (near !== r.near) {
        r.near = near;
        changed = true;
      }
    }
    if (changed) this.build(props);
  }

  private build(props: CityProps | null): void {
    this.mesh?.dispose(false, false);
    this.mesh = null;
    const near = this.rooms.filter((r) => r.near);
    if (!props || near.length === 0) return;
    for (const r of near) r.sink ??= this.bake(r, props);
    const sink = joined(near.map((r) => r.sink!));
    if (sink.empty) return;
    const m = sinkToMesh(this.deps.scene, "room-detail", sink);
    m.material = this.deps.materials.get("streetProp");
    m.isPickable = false;
    m.freezeWorldMatrix();
    this.mesh = m;
  }

  private bake(r: Room, props: CityProps): MeshSink {
    const sink = new MeshSink();
    for (const p of toWorld(r.items, { x: 0, y: 0, z: 0 })) bakeRoomDetail(sink, props, p, this.deps.quality);
    return sink;
  }
}
