import { type EntityId, type GroundSurface, type RoadMarkingKind, type TerrainGrid, type TerrainOpenSides, type Vec3, type ViewDescriptor, terrainHeightAt } from "@seki/core";
import type { BaseTexture, Mesh, Scene } from "../../babylon";
import type { LightingRig } from "../../npr/lighting";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { type FacadeFrame, type MapBuilding, facadeFrame } from "./facade-frame";
import { mapBuilding } from "./map-building";
import { SURFACE_LIFT, planBasin, planSurface, planTerrain, planWater } from "./ground-plan";
import { MapSignMaterial } from "./map-signs";
import { MapWaterMaterial } from "./map-water";
import { BinIndex, cellBounds, cellKey, cellsOf, grow } from "./map-index";
import { type Box2, type P2, boundsOf, centroid, cleanRing, distanceToBox, pointInRing } from "./polygon";
import { planCrossing } from "./crossing-plan";
import { type DeckAxis, Decks, planDeckEdges, planDeckUnderside } from "./deck-plan";
import { planMarking } from "./marking-plan";
import { type AcrossAt, SPAN_MAX, type Span, findSpans, planFarCanyon, planNearCanyon } from "./canyon-plan";
import { planCanyonSigns } from "./canyon-signs";
import { type PropSlot, bakeSlots } from "./facade-props";
import { planFarFrames, planNearFrames } from "./cell-plan";
import type { CityProps } from "../city-props";
import { planSteps } from "./steps-plan";
import { StreetProps, type StreetPropsStats } from "./street-props";
import { MapSkyline } from "./skyline";
import { type LandmarkPart, landmarkAt, withLandmark } from "./landmarks";

/** Views drawn by the map city (ADR-0042, ADR-0044). */
export type MapView = Extract<ViewDescriptor, { kind: "building" | "terrain" | "ground" | "street-props" | "road-marking" }>;

export const isMapView = (v: ViewDescriptor): v is MapView => v.kind === "building" || v.kind === "terrain" || v.kind === "ground" || v.kind === "street-props" || v.kind === "road-marking";

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
  readonly at: Vec3;
  readonly base: number;
  readonly bounds: Box2;
  readonly cell: string;
  /** Drawn from its recipe (ADR-0062) instead of the facade plan. */
  readonly landmark: LandmarkPart | null;
}

interface GroundEntry {
  readonly surface: GroundSurface;
  /** A line of road markings (ADR-0052): `ring` is its open line, `surface` the road it lies on. */
  readonly marking?: RoadMarkingKind;
  /** On a bridge (ADR-0053): the deck it is laid on. */
  readonly deck?: DeckAxis;
  readonly ring: readonly P2[];
  readonly y: number;
  readonly bounds: Box2;
  readonly cell: string;
}

interface TerrainEntry {
  readonly grid: TerrainGrid;
  /** Sides at the edge of the map data: an apron runs on from them (ADR-0044). */
  readonly open: TerrainOpenSides | undefined;
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
  /** Every surface but water, for the lift of the feet standing on one (ADR-0045). */
  private readonly surfaceIndex = new BinIndex();
  private readonly decks = new Decks();
  private readonly signs: MapSignMaterial;
  private readonly water: MapWaterMaterial;
  private readonly lod: MapLod;
  private rig: LightingRig | null = null;
  private daylight = 0;
  private terrainsDirty = false;
  /** Street furniture, made on the first `street-props` view (ADR-0047). */
  private streetProps: StreetProps | null = null;
  /** The megabuildings over the roofs (ADR-0051). */
  private readonly skyline: MapSkyline;
  /** Facade props baked into the near meshes (ADR-0058), once loaded. */
  private facadeProps: CityProps | null = null;

  constructor(private readonly deps: MapCityDeps) {
    this.signs = new MapSignMaterial(deps.scene, deps.signAtlas);
    this.water = new MapWaterMaterial(deps.scene);
    this.skyline = new MapSkyline(deps.scene, deps.quality !== "low");
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
      // The awnings keep clear of the furniture (ADR-0058): the facades by it are rebuilt.
      if (this.facadeProps && view.items.length > 0) this.touchNear(boundsOf(view.items.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))));
      return;
    }
    if (view.kind === "terrain") {
      const g = view.grid;
      const bounds = { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell };
      this.terrains.set(id, { grid: g, open: view.open, bounds, mesh: null });
      this.terrainsDirty = true;
      this.touch(bounds);
      return;
    }
    if (view.kind === "road-marking") {
      const line = view.line.map((p) => ({ x: p.x + at.x, z: p.z + at.z }));
      if (line.length < 2) return;
      const bounds = boundsOf(line);
      const cell = cellKey((bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2);
      this.grounds.set(id, { surface: "road", marking: view.marking, ring: line, y: at.y, bounds, cell });
      this.cellOf(cell).grounds.add(id);
      this.touch(bounds);
      return;
    }
    const ring = toRing(view.outline, at);
    if (ring.length < 3) return;
    const bounds = boundsOf(ring);
    const c = centroid(ring);
    const cell = cellKey(c.x, c.z);
    if (view.kind === "building") {
      this.buildings.set(id, { ring, view, at: { x: at.x, y: at.y, z: at.z }, base: at.y, bounds, cell, landmark: landmarkAt(at.x, at.z, view.outline.length) });
      this.buildingIndex.add(id, bounds);
      this.cellOf(cell).buildings.add(id);
      this.touchUnder(ring, view);
    } else {
      this.grounds.set(id, { surface: view.surface, ring, y: at.y, bounds, cell, ...(view.deck ? { deck: view.deck } : {}) });
      if (view.deck) this.decks.add(id, ring, view.deck);
      if (view.surface === "road") this.roadIndex.add(id, bounds);
      if (view.surface !== "water" && view.surface !== "basin") this.surfaceIndex.add(id, bounds);
      this.cellOf(cell).grounds.add(id);
    }
    // Neighbours' firewalls and kerbs depend on this one, and the spans across the street (ADR-0051).
    this.touch(grow(bounds, view.kind === "building" ? SPAN_MAX : 1));
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
    if (b) this.touchUnder(b.ring, b.view);
    this.buildings.delete(id);
    this.grounds.delete(id);
    this.decks.remove(id);
    this.buildingIndex.remove(id);
    this.roadIndex.remove(id);
    this.surfaceIndex.remove(id);
    const cell = this.cells.get(e.cell);
    cell?.buildings.delete(id);
    cell?.grounds.delete(id);
    this.touch(grow(e.bounds, 1));
  }

  clear(): void {
    for (const id of this.ids()) this.despawn(id);
    this.flush();
  }

  /** Whether a map building's roof is above (x, y, z): a gate's passage, the footbridge, a room under the floors. */
  roofOver(x: number, y: number, z: number): boolean {
    for (const id of this.buildingIndex.at(x, z)) {
      const b = this.buildings.get(id);
      if (b && y < b.base + b.view.height && pointInRing({ x, z }, b.ring)) return true;
    }
    return false;
  }

  /** Ground height at (x, z) from the terrain of the chunk there, or null outside every terrain. */
  heightAt(x: number, z: number): number | null {
    for (const t of this.terrains.values()) {
      const b = t.bounds;
      if (x >= b.minX - 0.01 && x <= b.maxX + 0.01 && z >= b.minZ - 0.01 && z <= b.maxZ + 0.01) return terrainHeightAt(t.grid, x, z);
    }
    return null;
  }

  /** The drawn ground at (x, z): the terrain and the pavement on it; null outside every terrain. */
  private readonly drawnGround = (x: number, z: number): number | null => {
    const h = this.heightAt(x, z);
    return h === null ? null : h + this.surfaceLift(x, h, z);
  };

  /**
   * How far the picture lifts feet at (x, y, z) above the terrain (ADR-0045): a character the
   * simulation keeps on the terrain stands on the surface drawn there (a sidewalk 16 cm up, a
   * square 8 cm), a bridge's deck included (ADR-0053). Feet off the ground (stairs, decks,
   * floors) are left alone.
   */
  surfaceLift(x: number, y: number, z: number): number {
    const ground = this.decks.heightAt(x, z) ?? this.heightAt(x, z);
    if (ground === null || Math.abs(y - ground) > 0.3) return 0;
    let lift = 0;
    for (const id of this.surfaceIndex.at(x, z)) {
      const g = this.grounds.get(id);
      if (g && SURFACE_LIFT[g.surface] > lift && pointInRing({ x, z }, g.ring)) lift = SURFACE_LIFT[g.surface];
    }
    return lift;
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
        planTerrain(sink, t.grid, t.open);
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
  /** Cells near the eye still waiting for their detailed buildings after the last update. */
  private waitingNear = 0;

  update(dt: number, eye: Vec3, frozen: boolean): void {
    const rig = this.deps.materials.currentRig;
    if (rig !== this.rig) {
      this.rig = rig;
      this.water.setLook(rig, this.daylight);
      this.signs.setDaylight(this.daylight, rig.fogDensity);
      this.skyline.setLook(rig, this.daylight);
    }
    if (!frozen) {
      this.water.update(dt);
      this.signs.update(dt);
    }
    let builds = 0;
    let waiting = 0;
    for (const cell of this.cells.values()) {
      const d = Math.hypot(distanceToBox(eye.x, eye.z, cell.bounds), Math.max(eye.y - 2, 0));
      const wantNear = d < this.lod.near + (cell.lod === "near" ? 15 : 0);
      if (wantNear && (cell.nearDirty || !cell.near) && cell.frames.length > 0) {
        if (builds < NEAR_BUILDS_PER_FRAME) {
          this.buildNear(cell);
          builds++;
        } else waiting++;
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
    this.waitingNear = waiting;
    this.streetProps?.update(eye);
    this.skyline.update(dt, eye, this.deps.scene.activeCamera?.maxZ ?? 320, frozen);
  }

  /** Every cell near the eye has its detailed buildings (they are built a few per frame). */
  get settled(): boolean {
    return this.waitingNear === 0 && (this.streetProps?.waiting ?? 0) === 0;
  }

  /** The facade props have loaded (ADR-0058): the near meshes are rebuilt with them. */
  setProps(props: CityProps): void {
    this.facadeProps = props;
    for (const c of this.cells.values()) c.nearDirty = true;
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
    this.skyline.setReduceFlashes(on);
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
      c = { key, bounds: cellBounds(key), buildings: new Set(), grounds: new Set(), dirty: true, frames: [], spans: [], near: null, nearDirty: true, far: null, signs: null, ground: null, water: null, lod: "off" };
      this.cells.set(key, c);
    }
    return c;
  }

  /** The near meshes of the cells round a box are rebuilt (their facades' props depend on it). */
  private touchNear(b: Box2): void {
    for (const k of cellsOf(grow(b, 4))) {
      const c = this.cells.get(k);
      if (c) c.nearDirty = true;
    }
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
    cell.spans = [];
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

  /** The building across the street at (x, z), for the spans over it (ADR-0051). */
  private acrossAt: AcrossAt = (x, z, self) => {
    for (const id of this.buildingIndex.at(x, z)) {
      const b = this.buildings.get(id);
      if (id !== self && b && pointInRing({ x, z }, b.ring)) return { id, top: b.base + b.view.height, clutter: b.view.vertical?.clutter ?? 0 };
    }
    return null;
  };

  private roadAt = (x: number, z: number): boolean => {
    for (const id of this.roadIndex.at(x, z)) {
      const g = this.grounds.get(id);
      if (g && pointInRing({ x, z }, g.ring)) return true;
    }
    return false;
  };

  /** The measured building of an entry (ADR-0044, ADR-0048), with the parts lifted onto it (G-057). */
  private building(id: EntityId, e: BuildingEntry): MapBuilding {
    return mapBuilding(id, e, (x, z) => this.heightAt(x, z), [...this.buildingIndex.within(e.bounds)].flatMap((o) => this.buildings.get(o) ?? []));
  }

  /** A part lifted onto a building (G-049) takes its towers away (G-057): its cell builds again. */
  private touchUnder(ring: readonly P2[], view: BuildingEntry["view"]): void {
    const c = view.soffit === undefined ? null : centroid(ring);
    const under = c ? [...this.buildingIndex.at(c.x, c.z)].map((id) => this.cells.get(this.buildings.get(id)?.cell ?? "")) : [];
    for (const cell of under) if (cell) cell.dirty = true;
  }

  private buildCell(cell: Cell): void {
    const ids = [...cell.buildings].sort((a, b) => a - b);
    cell.frames = ids.flatMap((id) => {
      const e = this.buildings.get(id);
      return e ? [withLandmark(facadeFrame(this.building(id, e), this.neighbourAt), e.landmark)] : [];
    });
    cell.spans = cell.frames.flatMap((f) => findSpans(f, this.acrossAt));
    const far = new MeshSink();
    const signs = new MeshSink();
    planFarFrames(far, signs, cell.frames, (name) => this.signs.slotFor(name), this.drawnGround);
    planFarCanyon(far, cell.spans);
    planCanyonSigns(signs, cell.frames, cell.spans, this.deps.quality === "low");
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
      const terrain = (x: number, z: number) => this.heightAt(x, z) ?? g.y;
      // Laid on a bridge's deck where there is one (ADR-0053); the river stays on the terrain.
      const h = (x: number, z: number) => this.decks.heightAt(x, z) ?? terrain(x, z);
      if (g.deck && g.surface !== "water") {
        planDeckEdges(ground, g.ring, h, SURFACE_LIFT[g.surface], (x, z) => this.decks.heightAt(x, z) !== null);
        planDeckUnderside(ground, g.ring, h, SURFACE_LIFT[g.surface]);
      }
      if (g.marking) planMarking(ground, g.marking, g.ring, h);
      else if (g.surface === "water") planWater(water, g.ring, terrain);
      else if (g.surface === "basin") planBasin(water, ground, g.ring, h);
      else if (g.surface === "steps") planSteps(ground, g.ring, h);
      else if (g.surface === "crossing") planCrossing(ground, g.ring, h);
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
    const lite = this.deps.quality === "low";
    const slots: PropSlot[] = [];
    const place = this.facadeProps ? (s: PropSlot) => slots.push(s) > 0 : undefined;
    planNearFrames(sink, cell.frames, lite, place, (x, z, r) => this.streetProps?.obstacles(x, z, r) ?? []);
    if (this.facadeProps) bakeSlots(sink, this.facadeProps, slots, lite);
    planNearCanyon(sink, cell.spans, lite);
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
