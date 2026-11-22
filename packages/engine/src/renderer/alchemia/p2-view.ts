import type { Vec3 } from "@seki/core";
import { ALCHEMIA_LAMP_PREFIX } from "./alchemia-lights";
import { ALCHEMIA_T1, P1, P1_STAIR_DOWN, P2, P2_ANNEX, P2_STORE_PIECES, P2_CORRIDOR, P2_CUTTING, SHELTER, SHELTER_GATE_STAIR, SHELTER_HATCH, SHELTER_HATCH_HEAD, SHELTER_PASSAGE } from "@seki/sim";
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
 * slabs). The cutting and the portal's parapet are Alchemia's outside mesh's. The shelter under T2
 * (stage 5d1) is in the same mesh, with a lamp of its own (§6, weak emergency light) on with the
 * eye in it; its hatch's shaft is Alchemia's outside mesh's.
 */

type Rect = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

const toRect = (e: Vec3, r: Rect): number => Math.hypot(Math.max(r.minX - e.x, 0, e.x - r.maxX), Math.max(r.minZ - e.z, 0, e.z - r.maxZ));
const inRect = (r: Rect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** On P-1 (in its outline) this near the flight's hole P-2 shows through it. */
export const P2_HOLE_DRAW = 14;
/** On T2 (under T1's level) this near the cutting P-2 shows through its portal. */
export const P2_PORTAL_DRAW = 35;
const HOLD = 3;

/**
 * The store's orange glow: the robots' beacons in the ceiling over their lane (`p2-store.ts`), so the lamp
 * hangs over the lane by its third beacon, at the store's middle (§13 of the rules of 22.11: no light from
 * nowhere); a reach to the store's far side from there.
 */
const BEACON = (() => {
  const mid = (P2.minZ + P2.maxZ) / 2;
  const up = P2_STORE_PIECES.filter((p) => p.kind === "beacon" && p.box.y1 >= P2.ceiling - 0.01);
  const b = up.reduce((a, p) => (Math.abs((p.box.z0 + p.box.z1) / 2 - mid) < Math.abs((a.box.z0 + a.box.z1) / 2 - mid) ? p : a));
  return { x: (b.box.x0 + b.box.x1) / 2, z: (b.box.z0 + b.box.z1) / 2 };
})();
const LAMP = {
  color: "#ff9a4a",
  range: 22,
  // The half-dark kept (under half of P-1's light), its slot its own since the interior mode (§13, 60-30-10).
  intensity: 0.6,
  position: { x: BEACON.x, y: P2.ceiling + 0.05, z: BEACON.z },
  clip: { minX: P2.minX, maxX: P2.maxX, minZ: P2.minZ, maxZ: P2.maxZ },
} as const;
/** Keyed as Alchemia's lamps: in its interior mode (`AlchemiaInterior`) only these take the shader's slots. */
export const P2_LAMP_KEY = `${ALCHEMIA_LAMP_PREFIX}p2`;

const SHELTER_LAMP = {
  // The caged bulbs' warm amber, the shelter's only colour (§13).
  color: "#ffb060",
  range: 16,
  intensity: 0.6,
  position: { x: (SHELTER.minX + SHELTER.maxX) / 2, y: SHELTER.ceiling - 0.3, z: (SHELTER.minZ + SHELTER.maxZ) / 2 },
  clip: { minX: SHELTER.minX, maxX: SHELTER.maxX, minZ: SHELTER_GATE_STAIR.minZ, maxZ: SHELTER.maxZ },
} as const;
export const SHELTER_LAMP_KEY = `${ALCHEMIA_LAMP_PREFIX}shelter`;

/** P-2's store, its annex and its corridor. */
const P2_PARTS: readonly Rect[] = [P2, P2_ANNEX, P2_CORRIDOR];
const inP2 = (x: number, z: number): boolean => P2_PARTS.some((r) => inRect(r, x, z));

/** The shelter's flight down from the gate (under T1, under P-2's corridor's slab); its passage, its room and the hatch's flight (under P-2's floor). */
const SHELTER_STAIR: Rect = { ...SHELTER_GATE_STAIR, maxZ: SHELTER_PASSAGE.minZ };
const SHELTER_LOWER: readonly Rect[] = [SHELTER_PASSAGE, SHELTER, { ...SHELTER_HATCH, maxX: SHELTER_HATCH_HEAD }];

/** Is the eye down in the shelter (stage 5d1)? */
export const eyeInShelter = (e: Vec3): boolean => (e.y < P2.slab && inRect(SHELTER_STAIR, e.x, e.z)) || (e.y < P2.floor - 0.4 && SHELTER_LOWER.some((r) => inRect(r, e.x, e.z)));

/** Is the eye down in P-2: in its store, annex or corridor (or over its flight), under P-1's floor, or in the shelter by it? */
export const eyeInP2 = (e: Vec3): boolean => (e.y < P1.floor - 0.2 && inP2(e.x, e.z)) || eyeInShelter(e);

/** Can the eye see into P-2 from where it is? (`hold` grows the reach while it is on.) */
export const p2Visible = (e: Vec3, hold = 0): boolean => {
  if (eyeInP2(e)) return true;
  if (inRect(P1, e.x, e.z) && e.y > P1.floor - 1 && e.y < P1.ceiling && toRect(e, P1_STAIR_DOWN) < P2_HOLE_DRAW + hold) return true;
  return e.y < ALCHEMIA_T1 && (toRect(e, P2_CUTTING) < P2_PORTAL_DRAW + hold || toRect(e, SHELTER_HATCH) < P2_PORTAL_DRAW + hold);
};

/** Whether a roof is over (x, y, z) in P-2, where no rain falls: under its ceiling in the store and the corridor, not in the cutting. */
export const p2RoofOver = (x: number, y: number, z: number): boolean => (y < P2.slab && inP2(x, z)) || eyeInShelter({ x, y, z });

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
  private lit: string | null = null;

  constructor(private readonly deps: P2Deps) {}

  /** The meshes drawn last frame and the store's triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly triangles: number } {
    return { meshes: this.mesh?.isEnabled(false) ? 1 : 0, triangles: this.mesh ? this.mesh.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false, null);
      return;
    }
    const e = this.deps.eye();
    const on = p2Visible(e, this.mesh?.isEnabled(false) ? HOLD : 0);
    if (on && kit !== this.kitSeen) this.build(kit);
    this.show(on, on && eyeInShelter(e) ? SHELTER_LAMP_KEY : on && eyeInP2(e) ? P2_LAMP_KEY : null);
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

  /** Shows the mesh or not, and turns on the lamp `lamp` (P-2's or the shelter's), the other off. */
  private show(on: boolean, lamp: string | null): void {
    if (this.mesh && this.mesh.isEnabled(false) !== on) this.mesh.setEnabled(on);
    const lit = this.mesh !== null ? lamp : null;
    if (lit === this.lit) return;
    if (this.lit) this.deps.materials.removeLight(this.lit);
    this.lit = lit;
    if (lit) this.deps.materials.addLight(lit, lit === SHELTER_LAMP_KEY ? SHELTER_LAMP : LAMP);
  }
}
