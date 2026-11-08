import type { Vec3 } from "@seki/core";
import { ALCHEMIA_CENTRE, ARKADY_CENTRE, FOODHALL, FOODHALL_INNER } from "@seki/sim";
import { type Mesh, MeshClass, type Scene, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import type { GeometrySink } from "../city-kit-data";
import type { CityKit } from "../city-kit";
import { alchemiaGeometry } from "./alchemia-geometry";
import { ParkingView } from "./parking-view";
import type { CarAt } from "./parking-traffic";

/**
 * How near the eye Alchemia's outside is drawn (m from the middle of the hall or of the Arkady,
 * whichever is nearer), and the margin it goes off beyond that: from the streets round the plot and from behind the Ratusz (some 115 m), while the
 * street scenes of `npr-perf` (the Rynek's from 149 m) stay as they were. The inside is drawn only
 * within `INSIDE_DRAW` of the hall's walls (ADR-0074 §7).
 */
export const ALCHEMIA_DRAW = 135;
const ALCHEMIA_HOLD = 10;
export const INSIDE_DRAW = 45;
const INSIDE_HOLD = 5;

/**
 * The hall's lamp (ADR-0074 §6): warm, under the ceiling over its middle, as far as its corners and
 * only inside its walls (the toon shader's lights have no occlusion, G-263).
 */
const LAMP = {
  color: "#ffd2a0",
  range: 26,
  intensity: 1.0,
  position: { x: ALCHEMIA_CENTRE.x, y: FOODHALL.ceiling - 0.4, z: ALCHEMIA_CENTRE.z },
  clip: { minX: FOODHALL_INNER.minX - 0.05, maxX: FOODHALL_INNER.maxX + 0.05, minZ: FOODHALL_INNER.minZ - 0.05, maxZ: FOODHALL_INNER.maxZ + 0.05 },
} as const;
export const ALCHEMIA_LAMP_KEY = "alchemia-foodhall";
/** Over these metres up to INSIDE_DRAW the lamp fades out, so it does not go on in one step with the mesh. */
const LAMP_FADE = 10;

export interface AlchemiaDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** The city kit once it has loaded: its material and palette (ADR-0022). */
  readonly kit: () => CityKit | null;
  /** False without Lublin's map city (the hall stands on one of its squares). */
  readonly city: () => boolean;
  readonly eye: () => Vec3;
  /** The traffic's cars as drawn (P-1's shutters go up before them, ADR-0074 §4). */
  readonly cars?: () => Iterable<CarAt>;
}

/** Horizontal distance from the eye to the hall's outline; 0 inside. */
const toHall = (e: Vec3): number => Math.hypot(Math.max(FOODHALL.minX - e.x, 0, e.x - FOODHALL.maxX), Math.max(FOODHALL.minZ - e.z, 0, e.z - FOODHALL.maxZ));

/**
 * Alchemia on Plac Ofiar Getta (ADR-0074 stage 1), behind the `BabylonRenderer` facade: its
 * outside (the food hall's shell, its green roof, the lift's kiosk, the terraces' steps) in one
 * mesh on the city kit's material, on within `ALCHEMIA_DRAW` (ADR-0074 §7 has 150 m: 135 keeps the Rynek's scene out); its inside (units, counters, tables,
 * stairs, signs and lights) in a second one, on near the hall only, with its lamp. One draw call
 * each (two with the G-buffer). No moon shadow and no glow layer: its neon and lit glass are
 * bright in the kit's own emissive colours.
 */
export class AlchemiaView {
  private outside: Mesh | null = null;
  private inside: Mesh | null = null;
  private kitSeen: CityKit | null = null;
  private level = 0;
  /** Its car park's P-1 under T0, near it only, and the cars on its ramp (ADR-0074 stage 4): a part of its own. */
  readonly parking: ParkingView;

  constructor(private readonly deps: AlchemiaDeps) {
    this.parking = new ParkingView(deps);
  }

  /** The meshes drawn last frame and their triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly triangles: number; readonly insideTriangles: number } {
    const on = (m: Mesh | null) => (m?.isEnabled(false) ? 1 : 0);
    return { meshes: on(this.outside) + on(this.inside), triangles: this.outside ? this.outside.getTotalIndices() / 3 : 0, insideTriangles: this.inside ? this.inside.getTotalIndices() / 3 : 0 };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.show(false, false);
      return;
    }
    const e = this.deps.eye();
    const far = Math.min(Math.hypot(e.x - ALCHEMIA_CENTRE.x, e.z - ALCHEMIA_CENTRE.z), Math.hypot(e.x - ARKADY_CENTRE.x, e.z - ARKADY_CENTRE.z));
    const near = toHall(e);
    const out = far < ALCHEMIA_DRAW + (this.outside?.isEnabled(false) ? ALCHEMIA_HOLD : 0);
    const inn = near < INSIDE_DRAW + (this.inside?.isEnabled(false) ? INSIDE_HOLD : 0);
    if ((out || inn) && kit !== this.kitSeen) this.build(kit);
    this.show(out, inn, Math.max(0, Math.min(1, (INSIDE_DRAW - near) / LAMP_FADE)));
  }

  private build(kit: CityKit): void {
    this.kitSeen = kit;
    const { outside, inside } = alchemiaGeometry(kit.data);
    this.outside = this.fill(this.outside, "alchemia", outside, kit);
    this.inside = this.fill(this.inside, "alchemia-inside", inside, kit);
  }

  private fill(mesh: Mesh | null, name: string, sink: GeometrySink, kit: CityKit): Mesh {
    const m = mesh ?? new MeshClass(name, this.deps.scene);
    m.material = kit.material;
    m.isPickable = false;
    m.setVerticesData(VertexBuffer.PositionKind, sink.positions, false, 3);
    m.setVerticesData(VertexBuffer.NormalKind, sink.normals, false, 3);
    m.setVerticesData(VertexBuffer.UVKind, sink.uvs, false, 2);
    m.setVerticesData(VertexBuffer.ColorKind, sink.colors, false, 4);
    m.setIndices(sink.indices, sink.vertexCount);
    m.refreshBoundingInfo();
    m.freezeWorldMatrix();
    return m;
  }

  private show(out: boolean, inn: boolean, fade = 0): void {
    if (this.outside && this.outside.isEnabled(false) !== out) this.outside.setEnabled(out);
    if (this.inside && this.inside.isEnabled(false) !== inn) this.inside.setEnabled(inn);
    const level = inn && this.inside !== null ? fade : 0;
    if (level === this.level) return;
    this.level = level;
    if (level > 0) this.deps.materials.addLight(ALCHEMIA_LAMP_KEY, { ...LAMP, intensity: LAMP.intensity * level });
    else this.deps.materials.removeLight(ALCHEMIA_LAMP_KEY);
  }
}
