import type { EffectDescriptor, Vec3 } from "@seki/core";

import { INTERIORS } from "@seki/sim";
import { type AbstractMesh, type Mesh, MeshClass, type Scene, VertexBuffer } from "../../babylon";
import type { ToonMaterials } from "../../npr/toon-material";
import type { GeometrySink } from "../city-kit-data";
import type { CityKit } from "../city-kit";
import { w3Dress } from "./w3-dress";
import { W3Fx, W3_FX_RANGE } from "./w3-fx";
import { w3InsideGeometry } from "./w3-inside-geometry";
import { W3_INTERIOR_RANGE, w3InteriorDistance } from "./w3-interior-cull";
import { type W3Lamp, W3_LAMP_PREFIX, W3_LAMPS_ON, W3_LAMPS_OUT, w3LampsFor } from "./w3-lights";
import { LINE_IDLE, type LineMission, linePose } from "./w3-line-anim";
import { lineGeometry } from "./w3-line-geometry";

/** The outer pieces (shut leaves in the facades, the culvert's mouth) are drawn within this of the hall (m). */
export const W3_OUTER_DRAW = 400;
/** Past the inside's range by this much it stays on: no flicker on its edge. */
const HOLD = 4;
/** Over these metres up to the inside's range the lamps fade out, as Alchemia's (ADR-0074). */
const LAMP_FADE = 8;
/** The line moves at most this often (s): a third of the frames at 60 Hz, smooth enough for arms. */
const LINE_STEP = 1 / 30;

/**
 * What of the city stays drawn in the interior mode (ADR-0082 §3.8): the yards round the hall seen
 * through its open doors and the river's bank by the culvert, in the two map cells over them.
 */
export const W3_KEEP = { minX: 2478, maxX: 2590, minZ: 388, maxZ: 456 } as const;

const ROOMS = INTERIORS.filter((i) => i.id === "w3-hall" || i.id === "w3-basement").flatMap((i) => i.rooms);

/** Is the eye in a room of W-3's hall or basement (the interior mode, ADR-0082 §3.8)? */
export const eyeInW3 = (e: Vec3): boolean => ROOMS.some((r) => e.x > r.minX && e.x < r.maxX && e.z > r.minZ && e.z < r.maxZ && e.y > r.bottom && e.y < r.top);

export interface W3ViewDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  /** The city kit once it has loaded: its material and palette (ADR-0022). */
  readonly kit: () => CityKit | null;
  /** False without Lublin's map city. */
  readonly city: () => boolean;
  readonly eye: () => Vec3;
  /** The arms stand still (low quality, ADR-0082 §4). */
  readonly still: boolean;
  /** Steam and welding sparks as particles (High only, ADR-0082 stage 4); none without. */
  readonly particles?: boolean;
}

/**
 * W-3's hall from the inside (ADR-0082 stage 2b), behind the `BabylonRenderer` facade: its rooms,
 * line and furniture baked from the simulation's blocks in one mesh drawn near it, the shut leaves
 * in its facades and the culvert's mouth in a second one drawn from afar, the line's moving parts
 * in a third (still on low quality), and its two nearest lamps. No moon shadow (ADR-0082 §4).
 * Tessen's 2077 layer (stage 4, `w3-dress.ts`) is baked into the first two; its steam, sparks and
 * floodlights are `W3Fx`'s.
 * `interior` says the eye is in its rooms: the renderer's interior mode.
 */
export class W3View {
  private inside: Mesh | null = null;
  private outer: Mesh | null = null;
  private line: Mesh | null = null;
  private kitSeen: CityKit | null = null;
  private lamps: readonly W3Lamp[] = [];
  private lampLevel = 0;
  private time = 0;
  private lineAge = Infinity;
  /** The job's state on the line (ADR-0082 stage 3) and whether the line still has to show it. */
  private mission: LineMission = LINE_IDLE;
  private missionShown = true;
  /** The eye is in the hall's or the basement's rooms. */
  interior = false;
  /** Steam, sparks and floodlights (ADR-0082 stage 4). */
  readonly fx: W3Fx;

  /** The lights that take a slot (`ToonMaterials.setLightFocus`): the hall's lamps alone in its rooms, every light outside. */
  get lightScope(): string | null {
    return this.interior ? W3_LAMP_PREFIX : null;
  }

  constructor(private readonly deps: W3ViewDeps) {
    this.fx = new W3Fx(deps.scene, deps.materials, deps.particles ?? false);
  }

  /** The meshes on and their triangles (debug, tests). */
  get stats(): { readonly meshes: number; readonly insideTriangles: number; readonly lineTriangles: number } {
    const on = (m: Mesh | null) => (m?.isEnabled(false) ? 1 : 0);
    const tris = (m: Mesh | null) => (m ? m.getTotalIndices() / 3 : 0);
    return { meshes: on(this.inside) + on(this.outer) + on(this.line), insideTriangles: tris(this.inside), lineTriangles: tris(this.line) };
  }

  /** The lamps on now (tests). */
  get lampsOn(): readonly W3Lamp[] {
    return this.lampLevel > 0 ? this.lamps : [];
  }

  /** Walls the camera keeps in front of (the baked inside and outer pieces). */
  isBlocker(m: AbstractMesh): boolean {
    return m === this.inside || m === this.outer;
  }

  /** Call once per frame before rendering; `frozen` holds the line (the reference still). */
  update(dt: number, frozen: boolean): void {
    const kit = this.deps.kit();
    if (!kit || !this.deps.city()) {
      this.interior = false;
      this.show(false, false, 0);
      this.fx.update(dt, { inRange: false, near: false, interior: false, moving: false, wrecks: this.mission.wrecks });
      return;
    }
    const eye = this.deps.eye();
    const d = w3InteriorDistance(eye);
    const near = d < W3_INTERIOR_RANGE + (this.inside?.isEnabled(false) ? HOLD : 0);
    const out = d < W3_OUTER_DRAW;
    if ((near || out) && kit !== this.kitSeen) this.build(kit);
    this.interior = near && eyeInW3(eye);
    if (near) this.updateLamps(eye);
    this.show(out, near, Math.max(0, Math.min(1, (W3_INTERIOR_RANGE - d) / LAMP_FADE)));
    if (!frozen) this.time += dt;
    this.lineAge += frozen ? 0 : dt;
    if (near && (!this.missionShown || (!this.deps.still && this.lineAge >= LINE_STEP))) this.moveLine(kit);
    this.fx.update(frozen ? 0 : dt, { inRange: d < W3_FX_RANGE, near, interior: this.interior, moving: !this.deps.still && !frozen, wrecks: this.mission.wrecks });
  }

  /**
   * The job's state from the app (ADR-0082 stage 3): `alarm-light` turns the beacons red,
   * `line-screens` sets the screens, `line-wrecks` the stations blown for good (3c). Shown on the
   * line's next pose, on low quality too.
   */
  setMission(effect: Extract<EffectDescriptor, { kind: "alarm-light" | "line-screens" | "line-wrecks" }>): void {
    const m = this.mission;
    const next: LineMission =
      effect.kind === "alarm-light" ? { ...m, alarm: effect.active } : effect.kind === "line-screens" ? { ...m, screens: effect.state } : { ...m, wrecks: [...effect.stations] };
    const sameWrecks = next.wrecks.length === m.wrecks.length && next.wrecks.every((s) => m.wrecks.includes(s));
    if (next.alarm === m.alarm && next.screens === m.screens && sameWrecks) return;
    this.mission = next;
    this.missionShown = false;
  }

  private build(kit: CityKit): void {
    this.kitSeen = kit;
    const { inside, outer } = w3InsideGeometry(kit.data);
    w3Dress(kit.data, { inside, outer });
    this.inside = this.fill(this.inside, "w3-inside", inside, kit, false);
    this.outer = this.fill(this.outer, "w3-outer", outer, kit, false);
    // Updatable on low quality too: the job's beacons and screens change it there.
    this.line = this.fill(this.line, "w3-line", lineGeometry(kit.data, linePose(this.time, undefined, this.deps.still, this.mission)), kit, true);
    this.lineAge = 0;
    this.missionShown = true;
  }

  private fill(mesh: Mesh | null, name: string, sink: GeometrySink, kit: CityKit, moving: boolean): Mesh {
    mesh?.dispose(false, false);
    const m = new MeshClass(name, this.deps.scene);
    m.material = kit.material;
    m.isPickable = false;
    m.setVerticesData(VertexBuffer.PositionKind, sink.positions, moving, 3);
    m.setVerticesData(VertexBuffer.NormalKind, sink.normals, moving, 3);
    m.setVerticesData(VertexBuffer.UVKind, sink.uvs, moving, 2);
    m.setVerticesData(VertexBuffer.ColorKind, sink.colors, false, 4);
    m.setIndices(sink.indices, sink.vertexCount);
    m.refreshBoundingInfo();
    m.freezeWorldMatrix();
    return m;
  }

  /**
   * The line's next pose: the same boxes moved, the beacons' swatches swapped; a station blown or
   * the wrecks gone (a load) change its boxes, so the mesh is filled anew then, once.
   */
  private moveLine(kit: CityKit): void {
    const m = this.line;
    if (!m) return;
    this.lineAge = 0;
    this.missionShown = true;
    const s = lineGeometry(kit.data, linePose(this.time, undefined, this.deps.still, this.mission));
    if (s.vertexCount !== m.getTotalVertices()) {
      this.line = this.fill(m, "w3-line", s, kit, true);
      return;
    }
    m.updateVerticesData(VertexBuffer.PositionKind, s.positions);
    m.updateVerticesData(VertexBuffer.NormalKind, s.normals);
    m.updateVerticesData(VertexBuffer.UVKind, s.uvs);
  }

  /**
   * The lamps nearest the eye on, the others off; all of them only while the inside is drawn. Out on
   * the yard only two take the shader's slots, so the yard's floodlights and the street lamps keep theirs.
   */
  private updateLamps(eye: Vec3): void {
    const next = w3LampsFor(eye, this.interior ? W3_LAMPS_ON : W3_LAMPS_OUT);
    if (next.every((l, i) => l === this.lamps[i]) && next.length === this.lamps.length) return;
    for (const l of this.lamps) if (!next.includes(l)) this.deps.materials.removeLight(l.key);
    this.lamps = next;
    this.lampLevel = -1;
  }

  private show(out: boolean, near: boolean, fade: number): void {
    if (this.outer && this.outer.isEnabled(false) !== out) this.outer.setEnabled(out);
    for (const m of [this.inside, this.line]) if (m && m.isEnabled(false) !== near) m.setEnabled(near);
    const level = near && this.inside ? fade : 0;
    if (level === this.lampLevel) return;
    this.lampLevel = level;
    for (const l of this.lamps) {
      if (level > 0) this.deps.materials.addLight(l.key, { ...l.light, intensity: l.light.intensity * level });
      else this.deps.materials.removeLight(l.key);
    }
  }
}
