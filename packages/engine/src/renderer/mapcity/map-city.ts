import type { EntityId, Vec3, ViewDescriptor } from "@seki/core";
import type { BaseTexture, Mesh, Scene } from "../../babylon";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import type { CityProps } from "../city-props";
import { SPAN_MAX } from "./canyon-plan";
import { CellBuilder } from "./cell-builder";
import { type MapLod, streamCells } from "./cell-stream";
import { landmarkAt } from "./landmarks";
import { type CellLod, MapCells, releaseCell } from "./map-cells";
import { type MapCityStats, mapCityMeshes, mapCityStats } from "./map-city-stats";
import { MapEntries } from "./map-entries";
import { MapFurniture } from "./map-furniture";
import { cellKey, grow } from "./map-index";
import { MapLook } from "./map-look";
import { type P2, boundsOf, centroid, cleanRing } from "./polygon";

export type { CellLod } from "./map-cells";
export type { MapLod } from "./cell-stream";
export type { MapCityStats } from "./map-city-stats";

/** Views drawn by the map city (ADR-0042, ADR-0044). */
export type MapView = Extract<ViewDescriptor, { kind: "building" | "terrain" | "ground" | "street-props" | "road-marking" }>;

export const isMapView = (v: ViewDescriptor): v is MapView => v.kind === "building" || v.kind === "terrain" || v.kind === "ground" || v.kind === "street-props" || v.kind === "road-marking";

export const MAP_LOD: Readonly<Record<RenderQuality, MapLod>> = {
  high: { near: 170, far: 1400, ground: 650, signs: 500 },
  medium: { near: 130, far: 900, ground: 480, signs: 380 },
  low: { near: 80, far: 550, ground: 320, signs: 240 },
};

export interface MapCityDeps {
  readonly scene: Scene;
  readonly materials: ToonMaterials;
  readonly shadow: MoonShadow | null;
  readonly quality: RenderQuality;
  /** Replaces the drawn sign atlases (tests without a canvas). */
  readonly signAtlas?: BaseTexture;
}

const toRing = (outline: readonly { x: number; z: number }[], at: Vec3): P2[] => cleanRing(outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));

/**
 * The city from map data (ADR-0044) behind the `BabylonRenderer` facade: buildings, terrain and
 * ground surfaces batched per 128 m cell. Each cell has a far mesh (one block per building), a
 * near mesh with the full facades built on demand, one sign mesh and one ground mesh (plus
 * water); terrain is one mesh per chunk. `update` picks the level per cell from the camera.
 *
 * A facade over its parts: `MapEntries` (the data and the queries on it), `MapCells` (the cells
 * and their rebuild marks), `CellBuilder` (the meshes), `streamCells` (levels of detail),
 * `MapLook` (signs, water, skyline, daylight) and `MapFurniture` (street and facade props).
 */
export class MapCity {
  private readonly entries = new MapEntries();
  private readonly grid = new MapCells(this.entries);
  private readonly cells = this.grid.all;
  private readonly look: MapLook;
  private readonly builder: CellBuilder;
  private readonly furniture: MapFurniture;
  private readonly lod: MapLod;
  private terrainsDirty = false;
  /** Cells near the eye still waiting for their detailed buildings after the last update. */
  private waitingNear = 0;

  constructor(private readonly deps: MapCityDeps) {
    this.look = new MapLook(deps);
    this.builder = new CellBuilder({ ...deps, lite: deps.quality === "low", entries: this.entries, signs: this.look.signs, water: this.look.water });
    this.furniture = new MapFurniture({ scene: deps.scene, materials: deps.materials, quality: deps.quality });
    this.lod = MAP_LOD[deps.quality];
    const terrain = deps.materials.get("mapTerrain");
    // Terrain gives way in depth to the surfaces laid on it, at any distance.
    terrain.zOffset = 2;
    terrain.zOffsetUnits = 4;
  }

  has(id: EntityId): boolean {
    const e = this.entries;
    return e.buildings.has(id) || e.grounds.has(id) || e.terrains.has(id) || (this.furniture.current?.has(id) ?? false);
  }

  ids(): EntityId[] {
    const e = this.entries;
    return [...e.buildings.keys(), ...e.grounds.keys(), ...e.terrains.keys(), ...(this.furniture.current?.ids() ?? [])];
  }

  get size(): number {
    const e = this.entries;
    return e.buildings.size + e.grounds.size + e.terrains.size + (this.furniture.current?.size ?? 0);
  }

  spawn(id: EntityId, view: MapView, at: Vec3): void {
    this.despawn(id);
    if (view.kind === "street-props") {
      this.furniture.get().spawn(id, view.items, at);
      // The awnings keep clear of the furniture (ADR-0058): the facades by it are rebuilt.
      if (this.furniture.facadeProps && view.items.length > 0) this.grid.touchNear(boundsOf(view.items.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))));
      return;
    }
    if (view.kind === "terrain") {
      const g = view.grid;
      const bounds = { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell };
      this.entries.terrains.set(id, { grid: g, open: view.open, bounds, mesh: null });
      this.terrainsDirty = true;
      this.grid.touch(bounds);
      return;
    }
    if (view.kind === "road-marking") {
      const line = view.line.map((p) => ({ x: p.x + at.x, z: p.z + at.z }));
      if (line.length < 2) return;
      const bounds = boundsOf(line);
      const cell = cellKey((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2);
      this.entries.addGround(id, { surface: "road", marking: view.marking, ring: line, y: at.y, bounds, cell });
      this.grid.cellOf(cell).grounds.add(id);
      this.grid.touch(bounds);
      return;
    }
    const ring = toRing(view.outline, at);
    if (ring.length < 3) return;
    const bounds = boundsOf(ring);
    const c = centroid(ring);
    const cell = cellKey(c.x, c.z);
    if (view.kind === "building") {
      this.entries.addBuilding(id, { ring, view, at: { x: at.x, y: at.y, z: at.z }, base: at.y, bounds, cell, landmark: landmarkAt(at.x, at.z, view.outline.length) });
      this.grid.cellOf(cell).buildings.add(id);
      this.grid.touchUnder(ring, view);
    } else {
      this.entries.addGround(id, { surface: view.surface, ring, y: at.y, bounds, cell, ...(view.deck ? { deck: view.deck } : {}) });
      this.grid.cellOf(cell).grounds.add(id);
    }
    // Neighbours' firewalls and kerbs depend on this one, and the spans across the street (ADR-0051).
    this.grid.touch(grow(bounds, view.kind === "building" ? SPAN_MAX : 1));
  }

  despawn(id: EntityId): void {
    const street = this.furniture.current;
    if (street?.has(id)) {
      street.despawn(id);
      return;
    }
    const t = this.entries.terrains.get(id);
    if (t) {
      this.entries.terrains.delete(id);
      t.mesh?.dispose(false, false);
      this.grid.touch(t.bounds);
      return;
    }
    const b = this.entries.buildings.get(id);
    const e = b ?? this.entries.grounds.get(id);
    if (!e) return;
    if (b) this.grid.touchUnder(b.ring, b.view);
    this.entries.remove(id);
    const cell = this.cells.get(e.cell);
    cell?.buildings.delete(id);
    cell?.grounds.delete(id);
    this.grid.touch(grow(e.bounds, 1));
  }

  clear(): void {
    for (const id of this.ids()) this.despawn(id);
    this.flush();
  }

  /** Whether a map building's roof is above (x, y, z): a gate's passage, the footbridge, a room under the floors. */
  roofOver(x: number, y: number, z: number): boolean {
    return this.entries.roofOver(x, y, z);
  }

  /** Ground height at (x, z) from the terrain of the chunk there, or null outside every terrain. */
  heightAt(x: number, z: number): number | null {
    return this.entries.heightAt(x, z);
  }

  /** How far the picture lifts feet at (x, y, z) above the terrain: `surfaceLiftAt`. */
  surfaceLift(x: number, y: number, z: number): number {
    return this.entries.surfaceLift(x, y, z);
  }

  /** Rebuilds what changed: terrain meshes and the cells' far, sign and ground meshes. */
  flush(): boolean {
    let changed = this.furniture.current?.flush() ?? false;
    if (this.terrainsDirty) {
      this.terrainsDirty = false;
      changed = true;
      for (const [id, t] of this.entries.terrains) if (!t.mesh) t.mesh = this.builder.terrain(id, t);
    }
    for (const [key, cell] of this.cells) {
      if (!cell.dirty) continue;
      changed = true;
      cell.dirty = false;
      releaseCell(cell);
      if (cell.buildings.size === 0 && cell.grounds.size === 0) {
        this.cells.delete(key);
        continue;
      }
      this.builder.cell(cell);
    }
    return changed;
  }

  /** Levels of detail from the camera, the water's ripples and the signs' hum. */
  update(dt: number, eye: Vec3, frozen: boolean): void {
    this.look.update(dt, frozen);
    this.waitingNear = streamCells(this.cells.values(), eye, this.lod, (cell) => this.builder.near(cell, this.furniture.facadeProps, (x, z, r) => this.furniture.current?.obstacles(x, z, r) ?? []));
    this.furniture.current?.update(eye);
    this.look.updateSkyline(dt, eye, frozen);
  }

  /** Every cell near the eye has its detailed buildings (they are built a few per frame). */
  get settled(): boolean {
    return this.waiting === 0;
  }

  /** Near cells and street props still to build after the last update (the loading bar, ADR-0057). */
  get waiting(): number {
    return this.waitingNear + (this.furniture.current?.waiting ?? 0);
  }

  /** The facade props have loaded (ADR-0058): the near meshes are rebuilt with them. */
  setProps(props: CityProps): void {
    this.look.setProps(props);
    for (const c of this.cells.values()) c.nearDirty = true;
    this.furniture.setProps(props);
  }

  /** Night 0 .. day 1 (ADR-0017): lit windows and shop fronts follow, the neon dims. */
  setDaylight(daylight: number): void {
    this.look.setDaylight(daylight);
    this.furniture.setDaylight(daylight);
  }

  setReduceFlashes(on: boolean): void {
    this.look.setReduceFlashes(on);
  }

  /** Level of the cell around (x, z) (debug and tests). */
  lodAt(x: number, z: number): CellLod | null {
    return this.grid.lodAt(x, z);
  }

  get stats(): MapCityStats {
    return mapCityStats(this.cells, this.entries, this.furniture.current);
  }

  /** Every mesh the map city has built (debug and tests). */
  get meshes(): Mesh[] {
    return mapCityMeshes(this.cells, this.entries, this.furniture.current);
  }
}
