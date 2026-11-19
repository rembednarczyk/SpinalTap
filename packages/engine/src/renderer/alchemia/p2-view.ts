import type { Vec3 } from "@seki/core";
import { ALCHEMIA_T1, P1, P1_STAIR_DOWN, P2, P2_ANNEX, P2_CORRIDOR, P2_CUTTING } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityKit } from "../city-kit";
import { p2Inside } from "./p2-geometry";

/**
 * Alchemia's P-2 under P-1 (ADR-0074 stage 5a), behind the `BabylonRenderer` facade: the store and
 * its corridor in one mesh on the city kit's material, one draw call (two with the G-buffer), on
 * only where it can be seen: from inside it, from P-1 near the hole of its flight, and from T2
 * before its cutting. Its one lamp is dim and orange (§6, half-dark with the robots' beacons),
 * clipped to the store and on only with the eye down there; P-1's and the food hall's lamps over it
 * go off then (the toon shader's lights have no occlusion, G-263: they would light it through the
 * slabs). The cutting and the portal's parapet are Alchemia's outside mesh's.
 */

type Rect = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

const toRect = (e: Vec3, r: Rect): number => Math.hypot(Math.max(r.minX - e.x, 0, e.x - r.maxX), Math.max(r.minZ - e.z, 0, e.z - r.maxZ));
const inRect = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** On P-1 (in its outline) this near the flight's hole P-2 shows through it. */
export const P2_HOLE_DRAW = 14;
/** On T2 (under T1's level) this near the cutting P-2 shows through its portal. */
export const P2_PORTAL_DRAW = 35;
const HOLD = 3;

const LAMP = {
  color: "#ff9a4a",
  range: 18,
  intensity: 0.45,
  position: { x: (P2.minX + P2.maxX) / 2, y: P2.ceiling + 0.05, z: (P2.minZ + P2.maxZ) / 2 },
  clip: { minX: P2.minX, maxX: P2.maxX, minZ: P2.minZ, maxZ: P2.maxZ },
} as const;
export const P2_LAMP_KEY = "alchemia-p2";

/** P-2's store, its annex and its corridor. */
const P2_PARTS: readonly Rect[] = [P2, P2_ANNEX, P2_CORRIDOR];
const inP2 = (x: number, z: number): boolean => P2_PARTS.some((r) => inRect(r, x, z));

/** Is the eye down in P-2: in its store, annex or corridor (or over its flight), under P-1's floor? */
export const eyeInP2 = (e: Vec3): boolean => e.y < P1.floor - 0.2 && inP2(e.x, e.z);

/** Can the eye see into P-2 from where it is? (`hold` grows the reach while it is on.) */
export const p2Visible = (e: Vec3, hold = 0): boolean => {
  if (eyeInP2(e)) return true;
  if (inRect(P1, e.x, e.z) && e.y > P1.floor - 1 && e.y < P1.ceiling && toRect(e, P1_STAIR_DOWN) < P2_HOLE_DRAW + hold) return true;
  return e.y < ALCHEMIA_T1 && toRect(e, P2_CUTTING) < P2_PORTAL_DRAW + hold;
};

/** Whether a roof is over (x, y, z) in P-2, where no rain falls: under its ceiling in the store and the corridor, not in the cutting. */
export const p2RoofOver = (x: number, y: number, z: number): boolean => y < P2.slab && inP2(x, z);

export interface P2Deps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly kit: () => CityKit | null;
  readonly city: () => boolean;
  readonly eye: () => Vec3;
}

export class P2View {
  private mesh: Mesh | null = null;
  private kitSeen: CityKit | null = null;
  private lit = false;

  constructor(private readonly deps: P2Deps) {}

  /** The meshes drawn last frame and the store's triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly triangles: number } {
    return { meshes: this.mesh?.isEnabled(false) ? 1 : 0, triangles: this.mesh ? this.mesh.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false, false);
      return;
    }
    const e = this.deps.eye();
    const on = p2Visible(e, this.mesh?.isEnabled(false) ? HOLD : 0);
    if (on && kit !== this.kitSeen) this.build(kit);
    this.show(on, on && eyeInP2(e));
  }

  private build(kit: CityKit): void {
    this.kitSeen = kit;
    const sink = p2Inside(kit.data);
    const m = this.mesh ?? new MeshClass("alchemia-p2", this.deps.scene);
    m.material = kit.material;
    m.isPickable = false;
    m.setVerticesData(VertexBuffer.PositionKind, sink.positions, false, 3);
    m.setVerticesData(VertexBuffer.NormalKind, sink.normals, false, 3);
    m.setVerticesData(VertexBuffer.UVKind, sink.uvs, false, 2);
    m.setVerticesData(VertexBuffer.ColorKind, sink.colors, false, 4);
    m.setIndices(sink.indices, sink.vertexCount);
    m.refreshBoundingInfo();
    m.freezeWorldMatrix();
    this.mesh = m;
  }

  private show(on: boolean, lamp: boolean): void {
    if (this.mesh && this.mesh.isEnabled(false) !== on) this.mesh.setEnabled(on);
    const lit = lamp && this.mesh !== null;
    if (lit === this.lit) return;
    this.lit = lit;
    if (lit) this.deps.materials.addLight(P2_LAMP_KEY, LAMP);
    else this.deps.materials.removeLight(P2_LAMP_KEY);
  }
}
