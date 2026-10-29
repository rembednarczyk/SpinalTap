import { type EntityId, type GroundSurface, type TerrainGrid, type Vec3, type ViewDescriptor, terrainHeightAt } from "@seki/core";
import type { BaseTexture, Mesh, Scene } from "../../babylon";
import type { LightingRig } from "../../npr/lighting";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { type FacadeFrame, type MapBuilding, facadeFrame } from "./facade-frame";
import { planFarBuilding, planNearBuilding } from "./facade-plan";
import { planSurface, planTerrain, planWater } from "./ground-plan";
import { MapSignMaterial } from "./map-signs";
import { MapWaterMaterial } from "./map-water";
import { BinIndex, cellBounds, cellKey, cellsOf, grow } from "./map-index";
import { type Box2, type P2, boundsOf, centroid, cleanRing, distanceToBox, pointInRing } from "./polygon";
import { planBuildingSigns } from "./sign-plan";
import { StreetProps, type StreetPropsStats } from "./street-props";

/** Views drawn by the map city (ADR-0042, ADR-0044). */
export type MapView = Extract<ViewDescriptor, { kind: "building" | "terrain" | "ground" | "street-props" }>;

export const isMapView = (v: ViewDescriptor): v is MapView => v.kind === "building" || v.kind === "terrain" || v.kind === "ground" || v.kind === "street-props";

/** Distances (m, from the camera to a cell) per quality: detail, any building, ground, signs. */
export interface MapLod {
  readonly near: number;
  readonly far: number;
  readonly ground: number;
  readonly signs: number;
}

export const MAP_LOD: Readonly<Record<RenderQuality, MapLod>> = {
  high: { near: 170, far: 1400, ground: 650, signs: 500 },
  medium: { near: 130, far: 900, ground: 480, signs: 380 },
  low: { near: 80, far: 550, ground: 320, signs: 240 },
};

/** Near meshes built per frame at most: streaming detail in never stalls a frame for long. */
const NEAR_BUILDS_PER_FRAME = 2;

interface BuildingEntry {
  readonly ring: readonly P2[];
  readonly view: Extract<MapView, { kind: "building" }>;
  readonly base: number;
  readonly bounds: Box2;
  readonly cell: string;
}

interface GroundEntry {
  readonly surface: GroundSurface;
  readonly ring: readonly P2[];
  readonly y: number;
  readonly bounds: Box2;
  readonly cell: string;
}

interface TerrainEntry {
  readonly grid: TerrainGrid;
  readonly bounds: Box2;
  mesh: Mesh | null;
}

export type CellLod = "near" | "far" | "off";

interface Cell {
  readonly key: string;
  readonly bounds: Box2;
  readonly buildings: Set<EntityId>;
  readonly grounds: Set<EntityId>;
  dirty: boolean;
  frames: FacadeFrame[];
  near: Mesh | null;
  nearDirty: boolean;
  far: Mesh | null;
  signs: Mesh | null;
  ground: Mesh | null;
  water: Mesh | null;
  lod: CellLod;
}

export interface MapCityDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow | null;
  readonly quality: RenderQuality;
  /** Replaces the drawn sign atlases (tests without a canvas). */
  readonly signAtlas?: BaseTexture;
}

export interface MapCityStats {
  readonly buildings: number;
  readonly grounds: number;
  readonly terrains: number;
  readonly cells: number;
  readonly near: number;
  readonly far: number;
  readonly vertices: number;
  /** Street furniture (ADR-0047), null before the first `street-props` view. */
  readonly props: StreetPropsStats | null;
}

const toRing = (outline: readonly { x: number; z: number }[], at: Vec3): P2[] => cleanRing(outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));

/**
 * The city from map data (ADR-0044) behind the `BabylonRenderer` facade: buildings, terrain and
 * ground surfaces batched per 128 m cell. Each cell has a far mesh (one block per building), a
 * near mesh with the full facades built on demand, one sign mesh and one ground mesh (plus
 * water); terrain is one mesh per chunk. `update` picks the level per cell from the camera.
 */
export class MapCity {
  private readonly buildings = new Map<EntityId, BuildingEntry>();
  private readonly grounds = new Map<EntityId, GroundEntry>();
  private readonly terrains = new Map<EntityId, TerrainEntry>();
  private readonly cells = new Map<string, Cell>();
  private readonly buildingIndex = new BinIndex();
  private readonly roadIndex = new BinIndex();
  private readonly signs: MapSignMaterial;
  private readonly water: MapWaterMaterial;
  private readonly lod: MapLod;
  private rig: LightingRig | null = null;
  private daylight = 0;
  private terrainsDirty = false;
  /** Street furniture, made on the first `street-props` view (ADR-0047). */
  private streetProps: StreetProps | null = null;

  constructor(private readonly deps: MapCityDeps) {
    this.signs = new MapSignMaterial(deps.scene, deps.signAtlas);
    this.water = new MapWaterMaterial(deps.scene);
    this.lod = MAP_LOD[deps.quality];
    const terrain = deps.materials.get("mapTerrain");
    // Terrain gives way in depth to the surfaces laid on it, at any distance.
    terrain.zOffset = 2;
    terrain.zOffsetUnits = 4;
  }

  has(id: EntityId): boolean {
    return this.buildings.has(id) || this.grounds.has(id) || this.terrains.has(id) || (this.streetProps?.has(id) ?? false);
  }

  ids(): EntityId[] {
    return [...this.buildings.keys(), ...this.grounds.keys(), ...this.terrains.keys(), ...(this.streetProps?.ids() ?? [])];
  }

  get size(): number {
    return this.buildings.size + this.grounds.size + this.terrains.size + (this.streetProps?.size ?? 0);
  }

  spawn(id: EntityId, view: MapView, at: Vec3): void {
    this.despawn(id);
    if (view.kind === "street-props") {
      this.props().spawn(id, view.items, at);
      return;
    }
    if (view.kind === "terrain") {
      const g = view.grid;
      const bounds = { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell };
      this.terrains.set(id, { grid: g, bounds, mesh: null });
      this.terrainsDirty = true;
      this.touch(bounds);
      return;
    }
    const ring = toRing(view.outline, at);
    if (ring.length < 3) return;
    const bounds = boundsOf(ring);
    const c = centroid(ring);
    const cell = cellKey(c.x, c.z);
    if (view.kind === "building") {
      this.buildings.set(id, { ring, view, base: at.y, bounds, cell });
      this.buildingIndex.add(id, bounds);
      this.cellOf(cell).buildings.add(id);
    } else {
      this.grounds.set(id, { surface: view.surface, ring, y: at.y, bounds, cell });
      if (view.surface === "road") this.roadIndex.add(id, bounds);
      this.cellOf(cell).grounds.add(id);
    }
    // Neighbours' firewalls and kerbs depend on this one.
    this.touch(grow(bounds, 1));
  }

  despawn(id: EntityId): void {
    if (this.streetProps?.has(id)) {
      this.streetProps.despawn(id);
      return;
    }
    const t = this.terrains.get(id);
    if (t) {
      this.terrains.delete(id);
      t.mesh?.dispose(false, false);
      this.touch(t.bounds);
      return;
    }
    const b = this.buildings.get(id);
    const g = this.grounds.get(id);
    const e = b ?? g;
    if (!e) return;
    this.buildings.delete(id);
    this.grounds.delete(id);
    this.buildingIndex.remove(id);
    this.roadIndex.remove(id);
    const cell = this.cells.get(e.cell);
    cell?.buildings.delete(id);
    cell?.grounds.delete(id);
    this.touch(grow(e.bounds, 1));
  }

  clear(): void {
    for (const id of this.ids()) this.despawn(id);
    this.flush();
  }

  /** Ground height at (x, z) from the terrain of the chunk there, or null outside every terrain. */
  heightAt(x: number, z: number): number | null {
    for (const t of this.terrains.values()) {
      const b = t.bounds;
      if (x >= b.minX - 0.01 && x <= b.maxX + 0.01 && z >= b.minZ - 0.01 && z <= b.maxZ + 0.01) return terrainHeightAt(t.grid, x, z);
    }
    return null;
  }

  /** Rebuilds what changed: terrain meshes and the cells' far, sign and ground meshes. */
  flush(): boolean {
    let changed = this.streetProps?.flush() ?? false;
    if (this.terrainsDirty) {
      this.terrainsDirty = false;
      changed = true;
      for (const [id, t] of this.terrains) {
        if (t.mesh) continue;
        const sink = new MeshSink();
        planTerrain(sink, t.grid);
        t.mesh = sink.empty ? null : this.mesh(`map-terrain-${id}`, sink, "mapTerrain");
      }
    }
    for (const [key, cell] of this.cells) {
      if (!cell.dirty) continue;
      changed = true;
      cell.dirty = false;
      this.release(cell);
      if (cell.buildings.size === 0 && cell.grounds.size === 0) {
        this.cells.delete(key);
        continue;
      }
      this.buildCell(cell);
    }
    return changed;
  }

  /** Levels of detail from the camera, the water's ripples and the signs' hum. */
  update(dt: number, eye: Vec3, frozen: boolean): void {
    const rig = this.deps.materials.currentRig;
    if (rig !== this.rig) {
      this.rig = rig;
      this.water.setLook(rig, this.daylight);
      this.signs.setDaylight(this.daylight, rig.fogDensity);
    }
    if (!frozen) {
      this.water.update(dt);
      this.signs.update(dt);
    }
    let builds = 0;
    for (const cell of this.cells.values()) {
      const d = Math.hypot(distanceToBox(eye.x, eye.z, cell.bounds), Math.max(eye.y - 2, 0));
      const wantNear = d < this.lod.near + (cell.lod === "near" ? 15 : 0);
      if (wantNear && (cell.nearDirty || !cell.near) && cell.frames.length > 0 && builds < NEAR_BUILDS_PER_FRAME) {
        this.buildNear(cell);
        builds++;
      }
      if (!wantNear && cell.near && d > this.lod.near * 2) {
        cell.near.dispose(false, false);
        cell.near = null;
      }
      const near = wantNear && cell.near !== null && !cell.nearDirty;
      cell.lod = near ? "near" : d < this.lod.far ? "far" : "off";
      cell.near?.setEnabled(near);
      cell.far?.setEnabled(cell.lod === "far");
      cell.signs?.setEnabled(d < this.lod.signs);
      cell.ground?.setEnabled(d < this.lod.ground);
      cell.water?.setEnabled(d < this.lod.ground);
    }
    this.streetProps?.update(eye);
  }

  /** Night 0 .. day 1 (ADR-0017): lit windows and shop fronts follow, the neon dims. */
  setDaylight(daylight: number): void {
    this.daylight = daylight;
    const self = 1 - 0.5 * Math.max(0, Math.min(1, daylight));
    this.deps.materials.get("facade").setFloat("selfLit", self);
    this.deps.materials.get("mapGround").setFloat("selfLit", self);
    this.deps.materials.get("mapTerrain").setFloat("selfLit", self);
    this.streetProps?.setDaylight(daylight);
    this.rig = null;
  }

  setReduceFlashes(on: boolean): void {
    this.signs.setReduceFlashes(on);
  }

  /** Level of the cell around (x, z) (debug and tests). */
  lodAt(x: number, z: number): CellLod | null {
    return this.cells.get(cellKey(x, z))?.lod ?? null;
  }

  get stats(): MapCityStats {
    let near = 0;
    let far = 0;
    let vertices = 0;
    for (const c of this.cells.values()) {
      if (c.lod === "near") near++;
      else if (c.lod === "far") far++;
      for (const m of [c.near, c.far, c.signs, c.ground, c.water]) if (m) vertices += m.getTotalVertices();
    }
    for (const t of this.terrains.values()) vertices += t.mesh?.getTotalVertices() ?? 0;
    return { buildings: this.buildings.size, grounds: this.grounds.size, terrains: this.terrains.size, cells: this.cells.size, near, far, vertices, props: this.streetProps?.stats ?? null };
  }

  /** Every mesh the map city has built (debug and tests). */
  get meshes(): Mesh[] {
    const out: Mesh[] = [];
    for (const c of this.cells.values()) for (const m of [c.near, c.far, c.signs, c.ground, c.water]) if (m) out.push(m);
    for (const t of this.terrains.values()) if (t.mesh) out.push(t.mesh);
    out.push(...(this.streetProps?.meshes ?? []));
    return out;
  }

  private props(): StreetProps {
    if (!this.streetProps) {
      this.streetProps = new StreetProps({ scene: this.deps.scene, materials: this.deps.materials, quality: this.deps.quality });
      this.streetProps.setDaylight(this.daylight);
    }
    return this.streetProps;
  }

  private cellOf(key: string): Cell {
    let c = this.cells.get(key);
    if (!c) {
      c = { key, bounds: cellBounds(key), buildings: new Set(), grounds: new Set(), dirty: true, frames: [], near: null, nearDirty: true, far: null, signs: null, ground: null, water: null, lod: "off" };
      this.cells.set(key, c);
    }
    return c;
  }

  /** Marks the cells a box touches for a rebuild (only cells that exist). */
  private touch(b: Box2): void {
    for (const k of cellsOf(b)) {
      const c = this.cells.get(k);
      if (c) c.dirty = true;
    }
    // Large surfaces and buildings belong to the cell of their centre, which may lie further out.
    for (const c of this.cells.values()) {
      if (c.dirty) continue;
      for (const id of c.grounds) {
        const g = this.grounds.get(id);
        if (g && g.bounds.minX <= b.maxX && g.bounds.maxX >= b.minX && g.bounds.minZ <= b.maxZ && g.bounds.maxZ >= b.minZ) {
          c.dirty = true;
          break;
        }
      }
    }
  }

  private release(cell: Cell): void {
    for (const m of [cell.near, cell.far, cell.signs, cell.ground, cell.water]) m?.dispose(false, false);
    cell.near = cell.far = cell.signs = cell.ground = cell.water = null;
    cell.nearDirty = true;
    cell.frames = [];
  }

  private neighbourAt = (x: number, z: number, self: number): number | null => {
    let top: number | null = null;
    for (const id of this.buildingIndex.at(x, z)) {
      if (id === self) continue;
      const b = this.buildings.get(id);
      if (b && pointInRing({ x, z }, b.ring)) top = Math.max(top ?? -Infinity, b.base + b.view.height);
    }
    return top;
  };

  private roadAt = (x: number, z: number): boolean => {
    for (const id of this.roadIndex.at(x, z)) {
      const g = this.grounds.get(id);
      if (g && pointInRing({ x, z }, g.ring)) return true;
    }
    return false;
  };

  /**
   * The entity stands at the foot of its outline; on a slope the bottom `plinth` metres are a
   * plinth, so the ground floor (and the window grid) starts above it.
   */
  private building(id: EntityId, e: BuildingEntry): MapBuilding {
    const v = e.view;
    const plinth = Math.min(Math.max(v.plinth ?? 0, 0), v.height - 2);
    let foot = e.base;
    for (const p of e.ring) foot = Math.min(foot, this.heightAt(p.x, p.z) ?? e.base);
    return {
      id,
      ring: e.ring,
      base: e.base + Math.max(plinth, 0),
      foot,
      height: v.height - Math.max(plinth, 0),
      levels: v.levels,
      use: v.use,
      look: v.look,
      ...(v.roof !== undefined ? { roof: v.roof } : {}),
      ...(v.name ? { name: v.name } : {}),
      shopfront: v.shopfront === true,
    };
  }

  private buildCell(cell: Cell): void {
    const ids = [...cell.buildings].sort((a, b) => a - b);
    cell.frames = ids.flatMap((id) => {
      const e = this.buildings.get(id);
      return e ? [facadeFrame(this.building(id, e), this.neighbourAt)] : [];
    });
    const far = new MeshSink();
    const signs = new MeshSink();
    for (const f of cell.frames) {
      planFarBuilding(far, f);
      planBuildingSigns(signs, f, (name) => this.signs.slotFor(name));
    }
    cell.far = far.empty ? null : this.mesh(`map-far-${cell.key}`, far, "facade");
    if (!signs.empty) {
      const m = sinkToMesh(this.deps.scene, `map-signs-${cell.key}`, signs, true);
      m.material = this.signs.material;
      cell.signs = m;
    }
    const ground = new MeshSink();
    const water = new MeshSink();
    for (const id of [...cell.grounds].sort((a, b) => a - b)) {
      const g = this.grounds.get(id);
      if (!g) continue;
      const h = (x: number, z: number) => this.heightAt(x, z) ?? g.y;
      if (g.surface === "water") planWater(water, g.ring, h);
      else planSurface(ground, g.surface, g.ring, h, g.surface === "sidewalk" ? this.roadAt : null);
    }
    cell.ground = ground.empty ? null : this.mesh(`map-ground-${cell.key}`, ground, "mapGround");
    if (!water.empty) {
      const m = sinkToMesh(this.deps.scene, `map-water-${cell.key}`, water, false);
      m.material = this.water.material;
      cell.water = m;
    }
    cell.lod = "off";
    for (const m of [cell.far, cell.signs, cell.ground, cell.water]) m?.setEnabled(false);
  }

  private buildNear(cell: Cell): void {
    cell.near?.dispose(false, false);
    cell.near = null;
    cell.nearDirty = false;
    const sink = new MeshSink();
    for (const f of cell.frames) planNearBuilding(sink, f);
    if (sink.empty) return;
    const m = this.mesh(`map-near-${cell.key}`, sink, "facade");
    m.setEnabled(false);
    cell.near = m;
    // Only the detailed buildings near the camera cast the moon shadow.
    this.deps.shadow?.addCaster(m);
  }

  private mesh(name: string, sink: MeshSink, preset: "facade" | "mapGround" | "mapTerrain"): Mesh {
    const m = sinkToMesh(this.deps.scene, name, sink, true);
    m.material = this.deps.materials.get(preset);
    return m;
  }
}
