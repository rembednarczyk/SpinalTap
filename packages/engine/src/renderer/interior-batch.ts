import type { EntityId, Vec3 } from "@seki/core";
import { type Mesh, MeshBuilder, MeshClass, type Scene } from "../babylon";
import type { ToonMaterials } from "../npr/toon-material";
import { CITY_BUCKET } from "./city-kit";
import { type Block, blockPreset } from "./props";

interface Member {
  readonly size: Vec3;
  readonly center: Vec3;
}

interface Group {
  readonly preset: ReturnType<typeof blockPreset>;
  /** The region it is drawn with (W-3's hall, shown only near it), or null: always. */
  readonly region: string | null;
  readonly members: Map<EntityId, Member>;
  mesh: Mesh | null;
  dirty: boolean;
}

/**
 * Plain blocks of the interiors (ADR-0038): walls, ceilings, counters, chairs. Dozens of small
 * boxes per room would cost a draw call each in every pass, so they are merged into one mesh
 * per toon preset and 64 m cell, rebuilt lazily when blocks stream in or out. They stand under a
 * roof: no moon shadow. The toon shader patterns surfaces in world space, so merging changes
 * nothing in the look. A region's blocks (W-3's hall, ADR-0082 §4) get groups of their own,
 * hidden together while the eye is away from it.
 */
export class InteriorBatches {
  private readonly groups = new Map<string, Group>();
  private readonly where = new Map<EntityId, string>();
  private readonly hidden = new Set<string>();

  constructor(
    private readonly scene: Scene,
    private readonly materials: ToonMaterials,
    /** A merged mesh replaces another (either may be null): the camera blockers follow. */
    private readonly onSwap: (old: Mesh | null, next: Mesh | null) => void,
  ) {}

  has(id: EntityId): boolean {
    return this.where.has(id);
  }

  ids(): EntityId[] {
    return [...this.where.keys()];
  }

  get size(): number {
    return this.where.size;
  }

  add(id: EntityId, view: Block, center: Vec3, region: string | null = null): void {
    const preset = blockPreset(view);
    const key = `${region === null ? "" : `${region}-`}${preset}:${Math.floor(center.x / CITY_BUCKET)}:${Math.floor(center.z / CITY_BUCKET)}`;
    let g = this.groups.get(key);
    if (!g) {
      g = { preset, region, members: new Map(), mesh: null, dirty: true };
      this.groups.set(key, g);
    }
    g.members.set(id, { size: view.size, center });
    g.dirty = true;
    this.where.set(id, key);
  }

  remove(id: EntityId): void {
    const key = this.where.get(id);
    if (key === undefined) return;
    this.where.delete(id);
    const g = this.groups.get(key);
    if (!g) return;
    g.members.delete(id);
    g.dirty = true;
  }

  /** Shows or hides a region's merged blocks. */
  setRegionEnabled(region: string, on: boolean): void {
    if (on) this.hidden.delete(region);
    else this.hidden.add(region);
    for (const g of this.groups.values()) if (g.region === region) g.mesh?.setEnabled(on);
  }

  /** Rebuilds the groups that changed. Call once per frame before rendering. */
  flush(): void {
    for (const [key, g] of this.groups) {
      if (!g.dirty) continue;
      g.dirty = false;
      const old = g.mesh;
      g.mesh = g.members.size > 0 ? this.build(key, g) : null;
      if (g.region !== null && this.hidden.has(g.region)) g.mesh?.setEnabled(false);
      this.onSwap(old, g.mesh);
      old?.dispose(false, false);
      if (!g.mesh) this.groups.delete(key);
    }
  }

  private build(key: string, g: Group): Mesh | null {
    const boxes: Mesh[] = [];
    for (const [id, m] of g.members) {
      const box = MeshBuilder.CreateBox(`interior-${id}`, { width: m.size.x, height: m.size.y, depth: m.size.z }, this.scene);
      box.position.set(m.center.x, m.center.y, m.center.z);
      boxes.push(box);
    }
    const merged = MeshClass.MergeMeshes(boxes, true, true);
    if (!merged) return null;
    merged.name = `interior-${key}`;
    merged.material = this.materials.get(g.preset);
    merged.isPickable = true;
    merged.freezeWorldMatrix();
    return merged;
  }
}
