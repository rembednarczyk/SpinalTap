import type { Vec3 } from "@seki/core";
import { P1, P1_CABINS, P1_RAMP_CUT, P1_STAIR, P1_STAIR_CUT, groundY } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, Vector3, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import type { CityKit } from "../city-kit";
import { parkingInside } from "./parking-geometry";
import { type CarAt, SHUTTERS, SHUTTER_RISE, shutterLifts } from "./parking-traffic";

/**
 * Alchemia's P-1 under its car park (ADR-0074 stage 4), behind the `BabylonRenderer` facade: the
 * room in the ground (floors, ceilings, walls, cabins, fittings and lights) in one mesh on the
 * city kit's material, on only within `PARKING_DRAW` of its outline, with its cold lamp (§6); and
 * the cabins' shutters in a second, small one rewritten every frame, on with the room, going up
 * before the simulation's cars (G-491: they drive with the rest of the traffic,
 * `vehicle-views.ts`). One draw call each (two with the G-buffer). What shows of P-1 from the car
 * park (the trench, its ramp, the stair house) is Alchemia's outside mesh's.
 */
export const PARKING_DRAW = 30;
const PARKING_HOLD = 5;

/**
 * In the ceiling's fittings, a hand into its slab: a light under the ceiling lit its underside,
 * a pool and a highlight where no fitting hangs, which from the deck read as a cone through it (G-490).
 */
const LAMP = {
  color: "#bfe4ff",
  range: 24,
  intensity: 0.9,
  position: { x: (P1.minX + P1.maxX) / 2, y: P1.ceiling + 0.05, z: (P1.minZ + P1.maxZ) / 2 },
  clip: { minX: P1.minX, maxX: P1.maxX, minZ: P1.minZ, maxZ: P1.maxZ },
} as const;
export const PARKING_LAMP_KEY = "alchemia-parking";

export interface ParkingDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly kit: () => CityKit | null;
  readonly city: () => boolean;
  readonly eye: () => Vec3;
  /** The cars driving now (the simulation's traffic as drawn): the shutters go up before them. */
  readonly cars?: () => Iterable<CarAt>;
}

const toRect = (e: Vec3, r: { minX: number; maxX: number; minZ: number; maxZ: number }): number => Math.hypot(Math.max(r.minX - e.x, 0, e.x - r.maxX), Math.max(r.minZ - e.z, 0, e.z - r.maxZ));

const inRect = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/**
 * Whether a roof is over (x, y, z) in P-1 (ADR-0074 stage 4), where no rain falls (as on a metro
 * platform): under the car park's ground over the room, and in the stair core's house; not in the
 * ramp's open trench.
 */
export const parkingRoofOver = (x: number, y: number, z: number): boolean => {
  if (inRect(P1_STAIR_CUT.bounds, x, z)) return y < P1_STAIR.top + P1_STAIR.house;
  if (!inRect(P1, x, z) || inRect(P1_RAMP_CUT.bounds, x, z)) return false;
  return y < groundY(x, z) - 0.2;
};

const X: Vec3 = { x: 1, y: 0, z: 0 };
const Y: Vec3 = { x: 0, y: 1, z: 0 };
const Z: Vec3 = { x: 0, y: 0, z: 1 };

/** A shutter in its own frame (centred on its foot): a slatted steel leaf. */
const shutterTemplate = (data: CityKitData, b: (typeof SHUTTERS)[number]): GeometrySink => {
  const s = new GeometrySink();
  s.box({ x: 0, y: (b.y1 - b.y0) / 2, z: 0 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, "metal"));
  return s;
};

/** Where a shutter of the moving mesh is this frame: moved up its doorway. */
type Pose = { readonly x: number; readonly y: number; readonly z: number };

export class ParkingView {
  private inside: Mesh | null = null;
  private moving: Mesh | null = null;
  private parts: { readonly template: GeometrySink; readonly offset: number }[] = [];
  private positions: Float32Array = new Float32Array(0);
  private kitSeen: CityKit | null = null;
  private lit = false;
  private lifts: number[] = SHUTTERS.map(() => 0);

  constructor(private readonly deps: ParkingDeps) {}

  /** The meshes drawn last frame and the room's triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly triangles: number } {
    const on = (m: Mesh | null) => (m?.isEnabled(false) ? 1 : 0);
    return { meshes: on(this.inside) + on(this.moving), triangles: this.inside ? this.inside.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering; `reference` keeps the shutters down. */
  update(dt: number, reference = false): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false);
      return;
    }
    const e = this.deps.eye();
    const near = toRect(e, P1);
    const inn = near < PARKING_DRAW + (this.inside?.isEnabled(false) ? PARKING_HOLD : 0);
    if (inn && kit !== this.kitSeen) this.build(kit);
    this.show(inn);
    if (inn) this.drive(dt, reference);
  }

  private build(kit: CityKit): void {
    this.kitSeen = kit;
    const data = kit.data;
    this.inside = this.fill(this.inside, "alchemia-parking", parkingInside(data), kit, false);
    const templates = SHUTTERS.map((b) => shutterTemplate(data, b));
    const all = new GeometrySink();
    this.parts = templates.map((t) => {
      const offset = all.vertexCount;
      const base = offset;
      all.positions.push(...t.positions);
      all.normals.push(...t.normals);
      all.uvs.push(...t.uvs);
      all.colors.push(...t.colors);
      all.indices.push(...t.indices.map((i) => i + base));
      return { template: t, offset };
    });
    this.positions = new Float32Array(all.positions);
    this.moving = this.fill(this.moving, "alchemia-parking-shutters", all, kit, true);
  }

  private fill(mesh: Mesh | null, name: string, sink: GeometrySink, kit: CityKit, updatable: boolean): Mesh {
    const m = mesh ?? new MeshClass(name, this.deps.scene);
    m.material = kit.material;
    m.isPickable = false;
    m.setVerticesData(VertexBuffer.PositionKind, sink.positions, updatable, 3);
    m.setVerticesData(VertexBuffer.NormalKind, sink.normals, updatable, 3);
    m.setVerticesData(VertexBuffer.UVKind, sink.uvs, false, 2);
    m.setVerticesData(VertexBuffer.ColorKind, sink.colors, false, 4);
    m.setIndices(sink.indices, sink.vertexCount);
    m.refreshBoundingInfo();
    if (!updatable) m.freezeWorldMatrix();
    return m;
  }

  /** The shutters to this frame's lifts, up before the cars by their doorways (shut in the frozen reference views). */
  private drive(dt: number, reference: boolean): void {
    const mesh = this.moving;
    if (!mesh) return;
    this.lifts = reference ? SHUTTERS.map(() => 0) : shutterLifts(this.lifts, this.deps.cars?.() ?? [], dt);
    SHUTTERS.forEach((s, i) => this.place(i, { x: (s.x0 + s.x1) / 2, y: s.y0 + this.lifts[i]! * SHUTTER_RISE, z: (s.z0 + s.z1) / 2 }));
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.buildBoundingInfo(new Vector3(P1_CABINS[0]!.minX, P1.floor - 1, P1_CABINS[0]!.minZ), new Vector3(P1_CABINS[1]!.maxX, P1.floor + SHUTTER_RISE * 2, P1_CABINS[1]!.maxZ));
  }

  /** Writes shutter `i`'s template moved to its pose (normals as they are). */
  private place(i: number, p: Pose): void {
    const part = this.parts[i];
    if (!part) return;
    const src = part.template.positions;
    let o = part.offset * 3;
    for (let k = 0; k < src.length; k += 3, o += 3) this.positions.set([p.x + (src[k] ?? 0), p.y + (src[k + 1] ?? 0), p.z + (src[k + 2] ?? 0)], o);
  }

  private show(inn: boolean): void {
    if (this.inside && this.inside.isEnabled(false) !== inn) this.inside.setEnabled(inn);
    if (this.moving && this.moving.isEnabled(false) !== inn) this.moving.setEnabled(inn);
    const lit = inn && this.inside !== null;
    if (lit === this.lit) return;
    this.lit = lit;
    if (lit) this.deps.materials.addLight(PARKING_LAMP_KEY, LAMP);
    else this.deps.materials.removeLight(PARKING_LAMP_KEY);
  }
}
