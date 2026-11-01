import type { EntityId, Vec3, ViewDescriptor } from "@seki/core";
import type { BaseTexture, Mesh, Scene } from "../../babylon";
import type { LightingRig } from "../../npr/lighting";
import type { MoonShadow } from "../../npr/moon-shadow";
import type { RenderQuality } from "../../npr/quality";
import type { ToonMaterials } from "../../npr/toon-material";
import { sinkToMesh } from "../dressing";
import { MeshSink } from "../mesh-sink";
import { facadeFrame } from "./facade-frame";
import { SURFACE_LIFT, planBasin, planSurface, planTerrain, planWater } from "./ground-plan";
import { MapSignMaterial } from "./map-signs";
import { MapWaterMaterial } from "./map-water";
import { cellKey, grow } from "./map-index";
import { type P2, boundsOf, centroid, cleanRing, distanceToBox } from "./polygon";
import { planCrossing } from "./crossing-plan";
import { deckHeight, planDeckEdges, planDeckUnderside } from "./deck-plan";
import { planMarking } from "./marking-plan";
import { SPAN_MAX, findSpans, planFarCanyon, planNearCanyon } from "./canyon-plan";
import { planCanyonSigns } from "./canyon-signs";
import { type PropSlot, bakeSlots } from "./facade-props";
import { planFarFrames, planNearFrames } from "./cell-plan";
import type { CityProps } from "../city-props";
import { planSteps } from "./steps-plan";
import { StreetProps } from "./street-props";
import { MapSkyline, skylineLayoutFor } from "./skyline";
import { megaBodies } from "./skyline-bodies";
import { landmarkAt, withLandmark } from "./landmarks";
import { MapEntries } from "./map-entries";
import { type Cell, type CellLod, MapCells, releaseCell } from "./map-cells";
import { type MapCityStats, mapCityMeshes, mapCityStats } from "./map-city-stats";

export type { CellLod } from "./map-cells";
export type { MapCityStats } from "./map-city-stats";

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
 */
export class MapCity {
  private readonly entries = new MapEntries();
  private readonly grid = new MapCells(this.entries);
  private readonly cells = this.grid.all;
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
    this.signs = new MapSignMaterial(deps.scene, deps.signAtlas, deps.quality === "low" ? 512 : 1024);
    this.water = new MapWaterMaterial(deps.scene);
    this.skyline = new MapSkyline(deps.scene, deps.quality !== "low", skylineLayoutFor(deps.quality));
    this.lod = MAP_LOD[deps.quality];
    const terrain = deps.materials.get("mapTerrain");
    // Terrain gives way in depth to the surfaces laid on it, at any distance.
    terrain.zOffset = 2;
    terrain.zOffsetUnits = 4;
  }

  has(id: EntityId): boolean {
    const e = this.entries;
    return e.buildings.has(id) || e.grounds.has(id) || e.terrains.has(id) || (this.streetProps?.has(id) ?? false);
  }

  ids(): EntityId[] {
    const e = this.entries;
    return [...e.buildings.keys(), ...e.grounds.keys(), ...e.terrains.keys(), ...(this.streetProps?.ids() ?? [])];
  }

  get size(): number {
    const e = this.entries;
    return e.buildings.size + e.grounds.size + e.terrains.size + (this.streetProps?.size ?? 0);
  }

  spawn(id: EntityId, view: MapView, at: Vec3): void {
    this.despawn(id);
    if (view.kind === "street-props") {
      this.props().spawn(id, view.items, at);
      // The awnings keep clear of the furniture (ADR-0058): the facades by it are rebuilt.
      if (this.facadeProps && view.items.length > 0) this.grid.touchNear(boundsOf(view.items.map((p) => ({ x: p.x + at.x, z: p.z + at.z }))));
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
    if (this.streetProps?.has(id)) {
      this.streetProps.despawn(id);
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
    let changed = this.streetProps?.flush() ?? false;
    if (this.terrainsDirty) {
      this.terrainsDirty = false;
      changed = true;
      for (const [id, t] of this.entries.terrains) {
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
      releaseCell(cell);
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
    return this.waiting === 0;
  }

  /** Near cells and street props still to build after the last update (the loading bar, ADR-0057). */
  get waiting(): number {
    return this.waitingNear + (this.streetProps?.waiting ?? 0);
  }

  /** The facade props have loaded (ADR-0058): the near meshes are rebuilt with them. */
  setProps(props: CityProps): void {
    this.facadeProps = props;
    // The skyline's megatowers (ADR-0063); the phone keeps the procedural tiers.
    if (this.deps.quality !== "low") this.skyline.setBodies(megaBodies(props));
    for (const c of this.cells.values()) c.nearDirty = true;
    this.streetProps?.setProps(props);
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
    return this.grid.lodAt(x, z);
  }

  get stats(): MapCityStats {
    return mapCityStats(this.cells, this.entries, this.streetProps);
  }

  /** Every mesh the map city has built (debug and tests). */
  get meshes(): Mesh[] {
    return mapCityMeshes(this.cells, this.entries, this.streetProps);
  }

  private props(): StreetProps {
    if (!this.streetProps) {
      this.streetProps = new StreetProps({ scene: this.deps.scene, materials: this.deps.materials, quality: this.deps.quality });
      this.streetProps.setDaylight(this.daylight);
      if (this.facadeProps) this.streetProps.setProps(this.facadeProps);
    }
    return this.streetProps;
  }

  private buildCell(cell: Cell): void {
    const entries = this.entries;
    const ids = [...cell.buildings].sort((a, b) => a - b);
    cell.frames = ids.flatMap((id) => {
      const e = entries.buildings.get(id);
      return e ? [withLandmark(facadeFrame(entries.building(id, e), entries.neighbourAt), e.landmark)] : [];
    });
    cell.spans = cell.frames.flatMap((f) => findSpans(f, entries.acrossAt));
    const far = new MeshSink();
    const signs = new MeshSink();
    planFarFrames(far, signs, cell.frames, (name) => this.signs.slotFor(name), entries.drawnGround, this.deps.quality === "low");
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
      const g = entries.grounds.get(id);
      if (!g) continue;
      const terrain = (x: number, z: number) => entries.heightAt(x, z) ?? g.y;
      // Laid on a bridge's deck where there is one (ADR-0053); the river stays on the terrain, and
      // so does a way under the bridge where the deck has headroom over it (G-062). A piece of the
      // deck follows its own axis: on its outline the test for the ring may fall either way.
      const own = g.deck;
      const h = own ? (x: number, z: number) => deckHeight(own, x, z) : (x: number, z: number) => entries.decks.heightAt(x, z, g.marking ? undefined : terrain(x, z)) ?? terrain(x, z);
      if (g.deck && g.surface !== "water") {
        planDeckEdges(ground, g.ring, h, SURFACE_LIFT[g.surface], (x, z) => entries.decks.heightAt(x, z) !== null, terrain);
        planDeckUnderside(ground, g.ring, h, SURFACE_LIFT[g.surface], terrain);
      }
      if (g.marking) planMarking(ground, g.marking, g.ring, h);
      else if (g.surface === "water") planWater(water, g.ring, terrain);
      else if (g.surface === "basin") planBasin(water, ground, g.ring, h);
      else if (g.surface === "steps") planSteps(ground, g.ring, h);
      else if (g.surface === "crossing") planCrossing(ground, g.ring, h);
      else planSurface(ground, g.surface, g.ring, h, g.surface === "sidewalk" ? entries.roadAt : null);
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
