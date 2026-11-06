import { METRO_PLATFORMS } from "@seki/sim";
import type { Mesh, Scene, ShaderMaterial } from "../../babylon";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { type PlatformEntrance, planPlatform } from "./platform-plan";
import { planPlatformSigns } from "./platform-signs";

/**
 * How near the eye a platform is drawn: metres off the box round its pavilion and its rooms
 * under the street, and the margin it goes off beyond that. Near enough that the street scenes
 * of `npr-perf` never draw one, far enough that the doorway at the hall's end never shows the
 * earth's nothing from the opening.
 */
export const PLATFORM_DRAW = 22;
const PLATFORM_HOLD = 4;

/**
 * The platform's lamps: cool, under the ceiling, only inside its rooms' walls and only with the
 * eye under the street (the toon lights have no occlusion, G-263: from the street they would
 * light the square over the platform). The passage's lamp is the last, smaller one.
 */
const LAMP = { color: "#dceaff", range: 13, intensity: 1.05 } as const;
const PASSAGE_LAMP = { color: "#dceaff", range: 7, intensity: 0.9 } as const;
/** The eye this far under the street at the opening counts as under it. */
const UNDER = 1;

export interface PlatformViewsDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow;
  /** The map city's sign material once the city is there: the platforms' letters go on it. */
  readonly signs: () => ShaderMaterial | null;
  readonly eye: () => { readonly x: number; readonly y: number; readonly z: number };
}

interface Slot {
  readonly e: PlatformEntrance;
  readonly box: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
  mesh: Mesh | null;
  letters: Mesh | null;
  on: boolean;
  lit: boolean;
}

const boxOf = (e: PlatformEntrance): Slot["box"] => {
  const rects = [e.outline, ...e.platform.vaults.map((v) => v.bounds)];
  return {
    minX: Math.min(...rects.map((r) => r.minX)),
    maxX: Math.max(...rects.map((r) => r.maxX)),
    minZ: Math.min(...rects.map((r) => r.minZ)),
    maxZ: Math.max(...rects.map((r) => r.maxZ)),
  };
};

/**
 * The metro's platforms (ADR-0071 stage 4) behind the `BabylonRenderer` facade: each one a single
 * mesh on the dressing material (its shell, its stairs and the train of the ride's cars) and its
 * letters on the map's sign material, built the first time the eye comes near and on only near
 * it, so no street scene draws them. The ceiling keeps the moon out (a caster, as the ride's car);
 * two lamps light it, clipped to its walls.
 */
export class PlatformViews {
  private readonly slots: Slot[];

  constructor(
    private readonly deps: PlatformViewsDeps,
    entrances: readonly PlatformEntrance[] = METRO_PLATFORMS,
  ) {
    this.slots = entrances.map((e) => ({ e, box: boxOf(e), mesh: null, letters: null, on: false, lit: false }));
  }

  /** The meshes drawn last frame and the triangles of the built ones (debug, tests). */
  get stats(): { readonly meshes: number; readonly triangles: number } {
    let meshes = 0;
    let triangles = 0;
    for (const s of this.slots) {
      for (const m of [s.mesh, s.letters]) {
        if (!m) continue;
        if (m.isEnabled(false)) meshes++;
        triangles += m.getTotalIndices() / 3;
      }
    }
    return { meshes, triangles };
  }

  /** Call once per frame before rendering. */
  update(): void {
    const eye = this.deps.eye();
    this.slots.forEach((s, i) => {
      const b = s.box;
      const d = Math.hypot(Math.max(b.minX - eye.x, 0, eye.x - b.maxX), Math.max(b.minZ - eye.z, 0, eye.z - b.maxZ));
      const want = d < PLATFORM_DRAW + (s.on ? PLATFORM_HOLD : 0) && eye.y < s.e.street + 12;
      const lit = want && eye.y < s.e.street - UNDER;
      if (lit !== s.lit) {
        s.lit = lit;
        this.lamps(s, i, lit);
      }
      if (want === s.on) return;
      if (want && !s.mesh) this.build(s);
      s.on = want;
      s.mesh?.setEnabled(want);
      s.letters?.setEnabled(want);
    });
  }

  private build(s: Slot): void {
    const { scene, materials, shadow } = this.deps;
    const sink = new MeshSink();
    planPlatform(sink, s.e);
    const mesh = sinkToMesh(scene, `metro-platform-${s.e.station}`, sink);
    mesh.material = materials.get("dressing");
    shadow.addCaster(mesh);
    s.mesh = mesh;
    const signs = this.deps.signs();
    if (!signs) return;
    const glyphs = new MeshSink();
    planPlatformSigns(glyphs, s.e);
    const letters = sinkToMesh(scene, `metro-platform-signs-${s.e.station}`, glyphs, true);
    letters.material = signs;
    s.letters = letters;
  }

  private lamps(s: Slot, i: number, on: boolean): void {
    const { rooms, lamps } = s.e.platform;
    lamps.forEach((position, k) => {
      const key = `metro-platform-${i}-${k}`;
      const room = rooms.find((r) => position.x >= r.minX && position.x <= r.maxX && position.z >= r.minZ && position.z <= r.maxZ);
      if (!on || !room) {
        this.deps.materials.removeLight(key);
        return;
      }
      const look = k === lamps.length - 1 ? PASSAGE_LAMP : LAMP;
      this.deps.materials.addLight(key, { ...look, position, clip: { minX: room.minX - 0.05, maxX: room.maxX + 0.05, minZ: room.minZ - 0.05, maxZ: room.maxZ + 0.05 } });
    });
  }
}

/** Whether a platform's ceiling is over (x, y, z): its rooms under the street, where no rain falls (as G-331). */
export const platformRoofOver = (x: number, y: number, z: number, entrances: readonly PlatformEntrance[] = METRO_PLATFORMS): boolean =>
  entrances.some((e) => y < e.street - 0.2 && e.platform.vaults.some((v) => x >= v.bounds.minX && x <= v.bounds.maxX && z >= v.bounds.minZ && z <= v.bounds.maxZ));
