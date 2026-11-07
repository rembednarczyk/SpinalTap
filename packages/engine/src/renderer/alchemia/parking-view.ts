import type { Vec3 } from "@seki/core";
import { P1, P1_RAMP_CUT, P1_STAIR, P1_STAIR_CUT, groundY } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, Vector3, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import { type CityKitData, GeometrySink, swatchUv } from "../city-kit-data";
import type { CityKit } from "../city-kit";
import { parkingInside } from "./parking-geometry";
import { type CarPose, SHUTTERS, SHUTTER_RISE, carPoses, shutterLifts } from "./parking-traffic";

/**
 * Alchemia's P-1 under its car park (ADR-0074 stage 4), behind the `BabylonRenderer` facade: the
 * room in the ground (floors, ceilings, walls, cabins, fittings and lights) in one mesh on the
 * city kit's material, on only within `PARKING_DRAW` of its outline, with its cold lamp (§6); and
 * the moving cars with the cabins' shutters in a second, small one rewritten every frame, on only
 * near the ramp or in the room. One draw call each (two with the G-buffer). What shows of P-1 from
 * the car park (the trench, its ramp, the stair house) is Alchemia's outside mesh's.
 */
export const PARKING_DRAW = 30;
const PARKING_HOLD = 5;
/** The moving cars are seen this near the ramp's trench or the room. */
export const TRAFFIC_DRAW = 40;
/** In the frozen reference views (`npr-perf`) the cars stand where they are at this time. */
const REFERENCE_TIME = 12;

const LAMP = {
  color: "#bfe4ff",
  range: 24,
  intensity: 0.9,
  position: { x: (P1.minX + P1.maxX) / 2, y: P1.ceiling - 0.4, z: (P1.minZ + P1.maxZ) / 2 },
  clip: { minX: P1.minX, maxX: P1.maxX, minZ: P1.minZ, maxZ: P1.maxZ },
} as const;
export const PARKING_LAMP_KEY = "alchemia-parking";

export interface ParkingDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly kit: () => CityKit | null;
  readonly city: () => boolean;
  readonly eye: () => Vec3;
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

/** A car in its own frame (its front +z, its wheels' foot at 0): body, glasshouse, wheels. */
const carTemplate = (data: CityKitData, paint: string): GeometrySink => {
  const s = new GeometrySink();
  s.box({ x: 0, y: 0.6, z: 0 }, [X, Y, Z], [0.88, 0.32, 2.2], swatchUv(data, paint));
  s.box({ x: 0, y: 1.15, z: -0.2 }, [X, Y, Z], [0.78, 0.25, 1.15], swatchUv(data, "glass-dark"));
  for (const [x, z] of [[-0.82, 1.4], [0.82, 1.4], [-0.82, -1.4], [0.82, -1.4]] as const) s.box({ x, y: 0.32, z }, [X, Y, Z], [0.12, 0.32, 0.32], swatchUv(data, "dark"));
  s.box({ x: 0, y: 0.62, z: 2.21 }, [X, Y, Z], [0.7, 0.06, 0.01], swatchUv(data, "win-warm"));
  return s;
};

/** A shutter in its own frame (centred on its foot): a slatted steel leaf. */
const shutterTemplate = (data: CityKitData, b: (typeof SHUTTERS)[number]): GeometrySink => {
  const s = new GeometrySink();
  s.box({ x: 0, y: (b.y1 - b.y0) / 2, z: 0 }, [X, Y, Z], [(b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, (b.z1 - b.z0) / 2], swatchUv(data, "metal"));
  return s;
};

/** Where a part of the moving mesh is this frame: moved, turned by yaw and pitch, or folded away (null). */
type Pose = { readonly x: number; readonly y: number; readonly z: number; readonly yaw: number; readonly pitch: number } | null;

export class ParkingView {
  private inside: Mesh | null = null;
  private moving: Mesh | null = null;
  private parts: { readonly template: GeometrySink; readonly offset: number }[] = [];
  private positions: Float32Array = new Float32Array(0);
  private normals: Float32Array = new Float32Array(0);
  private kitSeen: CityKit | null = null;
  private lit = false;
  private time = 0;

  constructor(private readonly deps: ParkingDeps) {}

  /** The meshes drawn last frame and the room's triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly triangles: number } {
    const on = (m: Mesh | null) => (m?.isEnabled(false) ? 1 : 0);
    return { meshes: on(this.inside) + on(this.moving), triangles: this.inside ? this.inside.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering; `reference` holds the cars still. */
  update(dt: number, reference = false): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false, false);
      return;
    }
    this.time = reference ? REFERENCE_TIME : this.time + dt;
    const e = this.deps.eye();
    const near = toRect(e, P1);
    const inn = near < PARKING_DRAW + (this.inside?.isEnabled(false) ? PARKING_HOLD : 0);
    const cars = Math.min(near, toRect(e, P1_RAMP_CUT.bounds)) < TRAFFIC_DRAW;
    if ((inn || cars) && kit !== this.kitSeen) this.build(kit);
    this.show(inn, cars);
    if (cars) this.drive();
  }

  private build(kit: CityKit): void {
    this.kitSeen = kit;
    const data = kit.data;
    this.inside = this.fill(this.inside, "alchemia-parking", parkingInside(data), kit, false);
    const templates = [carTemplate(data, "metal"), carTemplate(data, "door"), ...SHUTTERS.map((b) => shutterTemplate(data, b))];
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
    this.normals = new Float32Array(all.normals);
    this.moving = this.fill(this.moving, "alchemia-parking-cars", all, kit, true);
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

  /** The cars and the shutters to this frame's poses. */
  private drive(): void {
    const mesh = this.moving;
    if (!mesh) return;
    const [a, b] = carPoses(this.time);
    const lifts = shutterLifts(this.time);
    const shutter = (i: number): Pose => {
      const s = SHUTTERS[i]!;
      return { x: (s.x0 + s.x1) / 2, y: s.y0 + lifts[i]! * SHUTTER_RISE, z: (s.z0 + s.z1) / 2, yaw: 0, pitch: 0 };
    };
    const poses: Pose[] = [a, b, shutter(0), shutter(1)];
    poses.forEach((p, i) => this.place(i, p));
    mesh.updateVerticesData(VertexBuffer.PositionKind, this.positions, false, false);
    mesh.updateVerticesData(VertexBuffer.NormalKind, this.normals, false, false);
    mesh.buildBoundingInfo(new Vector3(P1.minX - 2, P1.floor - 1, P1_RAMP_CUT.bounds.minZ - 6), new Vector3(P1.maxX + 2, 2, P1.maxZ + 2));
  }

  /** Writes part `i`'s template moved to its pose, or folded into a point under the floor. */
  private place(i: number, p: Pose | CarPose | null): void {
    const part = this.parts[i];
    if (!part) return;
    const src = part.template.positions;
    const nsrc = part.template.normals;
    const [cy, sy] = p ? [Math.cos(p.yaw), Math.sin(p.yaw)] : [1, 0];
    const [cp, sp] = p ? [Math.cos(p.pitch), Math.sin(p.pitch)] : [1, 0];
    let o = part.offset * 3;
    for (let k = 0; k < src.length; k += 3, o += 3) {
      if (!p) {
        this.positions.set([LAMP.position.x, P1.floor - 2, LAMP.position.z], o);
        continue;
      }
      const turn = (x: number, y: number, z: number): [number, number, number] => {
        // Nose up about the car's own x (its front +z), then its heading about y.
        const y1 = y * cp + z * sp;
        const z1 = -y * sp + z * cp;
        return [x * cy + z1 * sy, y1, -x * sy + z1 * cy];
      };
      const [x, y, z] = turn(src[k] ?? 0, src[k + 1] ?? 0, src[k + 2] ?? 0);
      this.positions.set([p.x + x, p.y + y, p.z + z], o);
      const [nx, ny, nz] = turn(nsrc[k] ?? 0, nsrc[k + 1] ?? 0, nsrc[k + 2] ?? 0);
      this.normals.set([nx, ny, nz], o);
    }
  }

  private show(inn: boolean, cars: boolean): void {
    if (this.inside && this.inside.isEnabled(false) !== inn) this.inside.setEnabled(inn);
    if (this.moving && this.moving.isEnabled(false) !== cars) this.moving.setEnabled(cars);
    const lit = inn && this.inside !== null;
    if (lit === this.lit) return;
    this.lit = lit;
    if (lit) this.deps.materials.addLight(PARKING_LAMP_KEY, LAMP);
    else this.deps.materials.removeLight(PARKING_LAMP_KEY);
  }
}
