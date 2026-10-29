import type { EntityId, StreetPropItem, StreetPropKind, Vec3 } from "@seki/core";
import type { Mesh, Scene } from "../../babylon";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { cellBounds, cellKey } from "./map-index";
import { type WorldProp, bake, collectInstances, countByKind, planHalos, toWorld } from "./prop-batch";
import { PropHaloMaterial } from "./prop-halo";
import { farModel, propModel } from "./prop-models";
import { type BlockBand, type CellBand, PROP_BLOCK, PROP_LOD, type PropLod, blockBand, cellBand, detailBand } from "./prop-shapes";
import { type Box2, distanceToBox } from "./polygon";

/** A 128 m cell of the map city: its pieces and what of them is drawn in detail. */
interface PropCell {
  readonly key: string;
  readonly block: string;
  readonly bounds: Box2;
  readonly pieces: Map<EntityId, WorldProp[]>;
  band: CellBand;
}

/** A 256 m block: the baked far mesh and the halos of the cells in it. */
interface PropBlock {
  readonly key: string;
  readonly bounds: Box2;
  readonly cells: Set<string>;
  band: BlockBand;
  far: Mesh | null;
  halo: Mesh | null;
  dirty: boolean;
}

export interface StreetPropsDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly quality: RenderQuality;
}

export interface StreetPropsStats {
  /** Pieces held. */
  readonly pieces: number;
  readonly cells: number;
  /** Detailed pieces drawn now, per kind. */
  readonly drawn: Readonly<Record<string, number>>;
  /** Instanced meshes with at least one piece. */
  readonly groups: number;
  /** Blocks drawing their far mesh. */
  readonly far: number;
}

/** The kinds that light the street at night and get halos. */
const LIT = (kind: StreetPropKind): boolean => kind.startsWith("lamp-") || kind === "floodlight";

const distance = (eye: Vec3, b: Box2): number => Math.hypot(distanceToBox(eye.x, eye.z, b), Math.max(eye.y - 2, 0));

/**
 * Street furniture of the map city (ADR-0047) behind the `BabylonRenderer` facade. Pieces fall
 * into the map city's 128 m cells, the cells into 256 m blocks. A block close to the camera has
 * its cells draw their pieces in detail (small things only in the nearest cells); a block further
 * away draws one baked far mesh of simplified trees, lamps and monuments. The detailed pieces of
 * all near cells are thin instances, one mesh per kind and shape, so the draw calls follow the
 * kinds in view, not the number of cells. Lamps' halos are one additive mesh per block.
 */
export class StreetProps {
  private readonly entities = new Map<EntityId, Set<string>>();
  private readonly cells = new Map<string, PropCell>();
  private readonly blocks = new Map<string, PropBlock>();
  private readonly groups = new Map<string, Mesh>();
  private readonly halo: PropHaloMaterial;
  private readonly lod: PropLod;
  private instancesDirty = false;
  private drawn: Record<string, number> = {};
  private night = 1;
  private fog = -1;

  constructor(private readonly deps: StreetPropsDeps) {
    this.halo = new PropHaloMaterial(deps.scene);
    this.lod = PROP_LOD[deps.quality];
  }

  has(id: EntityId): boolean {
    return this.entities.has(id);
  }

  ids(): EntityId[] {
    return [...this.entities.keys()];
  }

  get size(): number {
    return this.entities.size;
  }

  spawn(id: EntityId, items: readonly StreetPropItem[], at: Vec3): void {
    this.despawn(id);
    const keys = new Set<string>();
    const byCell = new Map<string, WorldProp[]>();
    for (const p of toWorld(items, at)) {
      const k = cellKey(p.x, p.z);
      const list = byCell.get(k);
      if (list) list.push(p);
      else byCell.set(k, [p]);
    }
    for (const [k, list] of byCell) {
      const cell = this.cellOf(k, list[0]!);
      cell.pieces.set(id, list);
      this.blocks.get(cell.block)!.dirty = true;
      keys.add(k);
    }
    this.entities.set(id, keys);
  }

  despawn(id: EntityId): void {
    const keys = this.entities.get(id);
    if (!keys) return;
    this.entities.delete(id);
    for (const k of keys) {
      const cell = this.cells.get(k);
      if (!cell) continue;
      cell.pieces.delete(id);
      const block = this.blocks.get(cell.block);
      if (block) block.dirty = true;
    }
  }

  /** Rebuilds the far and halo meshes of changed blocks. */
  flush(): boolean {
    let changed = false;
    for (const [key, block] of this.blocks) {
      if (!block.dirty) continue;
      changed = true;
      block.dirty = false;
      this.instancesDirty = true;
      block.far?.dispose(false, false);
      block.halo?.dispose(false, false);
      block.far = block.halo = null;
      for (const k of [...block.cells]) {
        if (this.cells.get(k)?.pieces.size) continue;
        this.cells.delete(k);
        block.cells.delete(k);
      }
      if (block.cells.size === 0) this.blocks.delete(key);
      else this.buildBlock(block);
    }
    return changed;
  }

  /** Bands of the blocks and cells from the camera, the instance buffers when a band changed, the halos' look. */
  update(eye: Vec3): void {
    const rig = this.deps.materials.currentRig;
    if (rig.fogDensity !== this.fog) {
      this.fog = rig.fogDensity;
      this.halo.setLook(1 - this.night, this.fog);
    }
    for (const block of this.blocks.values()) {
      block.band = blockBand(distance(eye, block.bounds), this.lod, block.band);
      block.far?.setEnabled(block.band === "far");
      block.halo?.setEnabled(block.band !== "off" && this.night > 0.02);
    }
    for (const cell of this.cells.values()) {
      const band = detailBand(cellBand(distance(eye, cell.bounds), this.lod, cell.band), this.blocks.get(cell.block)?.band ?? "off");
      if (band !== cell.band) {
        cell.band = band;
        this.instancesDirty = true;
      }
    }
    if (this.instancesDirty) this.rebuildInstances();
  }

  /** Night 0 .. day 1 (ADR-0017): lamps' glass and the neon dim by day, the halos go out. */
  setDaylight(daylight: number): void {
    const day = Math.max(0, Math.min(1, daylight));
    this.night = 1 - day;
    this.deps.materials.get("streetProp").setFloat("selfLit", 1 - 0.4 * day);
    this.halo.setLook(day, Math.max(this.fog, 0));
  }

  get stats(): StreetPropsStats {
    let pieces = 0;
    for (const c of this.cells.values()) for (const l of c.pieces.values()) pieces += l.length;
    const far = [...this.blocks.values()].filter((b) => b.band === "far" && b.far).length;
    return { pieces, cells: this.cells.size, drawn: { ...this.drawn }, groups: [...this.groups.values()].filter((m) => m.isEnabled()).length, far };
  }

  /** Every mesh built (debug and tests). */
  get meshes(): Mesh[] {
    const out = [...this.groups.values()];
    for (const b of this.blocks.values()) for (const m of [b.far, b.halo]) if (m) out.push(m);
    return out;
  }

  private cellOf(key: string, at: WorldProp): PropCell {
    let c = this.cells.get(key);
    if (!c) {
      const block = cellKey(at.x, at.z, PROP_BLOCK);
      c = { key, block, bounds: cellBounds(key), pieces: new Map(), band: "off" };
      this.cells.set(key, c);
      let b = this.blocks.get(block);
      if (!b) {
        b = { key: block, bounds: cellBounds(block, PROP_BLOCK), cells: new Set(), band: "off", far: null, halo: null, dirty: true };
        this.blocks.set(block, b);
      }
      b.cells.add(key);
    }
    return c;
  }

  private buildBlock(block: PropBlock): void {
    const far = new MeshSink();
    const halo = new MeshSink();
    for (const k of [...block.cells].sort()) {
      const cell = this.cells.get(k)!;
      for (const id of [...cell.pieces.keys()].sort((a, b) => a - b)) {
        for (const p of cell.pieces.get(id)!) {
          const f = farModel(p.prop, p.shape);
          if (f) bake(far, f, p);
          if (LIT(p.prop)) planHalos(halo, p, propModel(p.prop, p.shape).lights);
        }
      }
    }
    if (!far.empty) {
      block.far = sinkToMesh(this.deps.scene, `props-far-${block.key}`, far);
      block.far.material = this.deps.materials.get("streetProp");
      block.far.setEnabled(false);
    }
    if (!halo.empty) {
      block.halo = sinkToMesh(this.deps.scene, `props-halo-${block.key}`, halo, true);
      block.halo.material = this.halo.material;
      block.halo.setEnabled(false);
    }
    block.band = "off";
  }

  private group(key: string): Mesh {
    let m = this.groups.get(key);
    if (!m) {
      const cut = key.lastIndexOf(":");
      m = sinkToMesh(this.deps.scene, `props-${key}`, propModel(key.slice(0, cut) as StreetPropKind, Number(key.slice(cut + 1))).sink);
      m.material = this.deps.materials.get("streetProp");
      this.groups.set(key, m);
    }
    return m;
  }

  private rebuildInstances(): void {
    this.instancesDirty = false;
    const sets = collectInstances([...this.cells.values()].map((c) => ({ band: c.band, pieces: [...c.pieces.values()].flat() })));
    for (const [key, m] of this.groups) {
      if (sets.has(key)) continue;
      m.thinInstanceCount = 0;
      m.setEnabled(false);
    }
    for (const [key, matrices] of sets) {
      const m = this.group(key);
      m.thinInstanceSetBuffer("matrix", matrices, 16, false);
      m.setEnabled(true);
    }
    this.drawn = countByKind(sets);
  }
}
