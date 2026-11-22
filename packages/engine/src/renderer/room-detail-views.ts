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
  mesh: Mesh | null;
  seen: CityProps | null;
}

const boxOf = (items: readonly StreetPropItem[]): Room["box"] => {
  const xs = items.map((i) => i.x);
  const ys = items.map((i) => i.y);
  const zs = items.map((i) => i.z);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), z0: Math.min(...zs), z1: Math.max(...zs) };
};

const out = (v: number, a: number, b: number): number => (v < a ? a - v : v > b ? v - b : 0);
const distance = (e: Vec3, b: Room["box"]): number => Math.hypot(out(e.x, b.x0, b.x1), out(e.y, b.y0, b.y1), out(e.z, b.z0, b.z1));

/**
 * The rooms' detail built by Blender after their cards (ADR-0098), behind the `BabylonRenderer` facade: one mesh a room
 * on the street props' material, baked the first time the eye comes near it after the props have loaded, drawn only
 * within `ROOM_DETAIL_NEAR` of it. In the city's furniture blocks it was drawn whole from 170 m (`PROP_LOD`), a room's
 * walls between: Neon Koi's bar from the street, W-3's hall's pallets over a phone's budget. One draw call a room near.
 */
export class RoomDetailViews {
  private readonly rooms: Room[] = ROOM_DETAILS.filter((r) => r.length > 0).map((items) => ({ items, box: boxOf(items), mesh: null, seen: null }));

  constructor(private readonly deps: RoomDetailDeps) {}

  /** The rooms drawn now and their triangles (debug, tests). */
  get stats(): { readonly shown: number; readonly triangles: number } {
    let shown = 0;
    let triangles = 0;
    for (const r of this.rooms)
      if (r.mesh?.isEnabled(false)) {
        shown++;
        triangles += r.mesh.getTotalIndices() / 3;
      }
    return { shown, triangles };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const props = this.deps.props();
    const e = this.deps.eye();
    const near = ROOM_DETAIL_NEAR[this.deps.quality];
    for (const r of this.rooms) {
      const on = props !== null && distance(e, r.box) < near + (r.mesh?.isEnabled(false) ? HOLD : 0);
      if (on && props !== r.seen) this.build(r, props);
      if (r.mesh && r.mesh.isEnabled(false) !== on) r.mesh.setEnabled(on);
    }
  }

  private build(r: Room, props: CityProps): void {
    r.seen = props;
    const sink = new MeshSink();
    for (const p of toWorld(r.items, { x: 0, y: 0, z: 0 })) bakeRoomDetail(sink, props, p, this.deps.quality);
    r.mesh?.dispose(false, false);
    r.mesh = null;
    if (sink.empty) return;
    const m = sinkToMesh(this.deps.scene, "room-detail", sink);
    m.material = this.deps.materials.get("streetProp");
    m.isPickable = false;
    m.freezeWorldMatrix();
    m.setEnabled(false);
    r.mesh = m;
  }
}
