import type { EntityId } from "@seki/core";
import type { Mesh } from "../../babylon";
import type { Span } from "./canyon-plan";
import type { FacadeFrame } from "./facade-frame";
import type { BuildingEntry, MapEntries } from "./map-entries";
import { cellBounds, cellKey, cellsOf, grow } from "./map-index";
import { type Box2, type P2, centroid } from "./polygon";

export type CellLod = "near" | "far" | "off";

export interface Cell {
  readonly key: string;
  readonly bounds: Box2;
  readonly buildings: Set<EntityId>;
  readonly grounds: Set<EntityId>;
  dirty: boolean;
  frames: FacadeFrame[];
  /** What hangs over the streets from this cell's buildings (ADR-0051). */
  spans: Span[];
  near: Mesh | null;
  nearDirty: boolean;
  far: Mesh | null;
  signs: Mesh | null;
  ground: Mesh | null;
  water: Mesh | null;
  lod: CellLod;
}

/** The meshes a cell has built, in the order they are listed everywhere. */
export const cellMeshes = (c: Cell): (Mesh | null)[] => [c.near, c.far, c.signs, c.ground, c.water];

/** Disposes of a cell's meshes and plans: it builds again from its entities. */
export const releaseCell = (cell: Cell): void => {
  for (const m of cellMeshes(cell)) m?.dispose(false, false);
  cell.near = cell.far = cell.signs = cell.ground = cell.water = null;
  cell.nearDirty = true;
  cell.frames = [];
  cell.spans = [];
};

/**
 * The 128 m batching cells of the map city (ADR-0044) and which of them must build again when
 * an entity comes or goes. The meshes are built by `CellBuilder`.
 */
export class MapCells {
  readonly all = new Map<string, Cell>();

  constructor(private readonly entries: MapEntries) {}

  cellOf(key: string): Cell {
    let c = this.all.get(key);
    if (!c) {
      c = { key, bounds: cellBounds(key), buildings: new Set(), grounds: new Set(), dirty: true, frames: [], spans: [], near: null, nearDirty: true, far: null, signs: null, ground: null, water: null, lod: "off" };
      this.all.set(key, c);
    }
    return c;
  }

  /** Level of the cell around (x, z) (debug and tests). */
  lodAt(x: number, z: number): CellLod | null {
    return this.all.get(cellKey(x, z))?.lod ?? null;
  }

  /** The near meshes of the cells round a box are rebuilt (their facades' props depend on it). */
  touchNear(b: Box2): void {
    for (const k of cellsOf(grow(b, 4))) {
      const c = this.all.get(k);
      if (c) c.nearDirty = true;
    }
  }

  /** Marks the cells a box touches for a rebuild (only cells that exist). */
  touch(b: Box2): void {
    for (const k of cellsOf(b)) {
      const c = this.all.get(k);
      if (c) c.dirty = true;
    }
    // Large surfaces and buildings belong to the cell of their centre, which may lie further out.
    for (const c of this.all.values()) {
      if (c.dirty) continue;
      for (const id of c.grounds) {
        const g = this.entries.grounds.get(id);
        if (g && g.bounds.minX <= b.maxX && g.bounds.maxX >= b.minX && g.bounds.minZ <= b.maxZ && g.bounds.maxZ >= b.minZ) {
          c.dirty = true;
          break;
        }
      }
    }
  }

  /** A part lifted onto a building (G-049) takes its towers away (G-057): its cell builds again. */
  touchUnder(ring: readonly P2[], view: BuildingEntry["view"]): void {
    const c = view.soffit === undefined ? null : centroid(ring);
    const under = c ? [...this.entries.buildingIndex.at(c.x, c.z)].map((id) => this.all.get(this.entries.buildings.get(id)?.cell ?? "")) : [];
    for (const cell of under) if (cell) cell.dirty = true;
  }
}
