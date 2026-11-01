import { type EntityId, type GroundSurface, type RoadMarkingKind, type TerrainGrid, type TerrainOpenSides, type Vec3, type ViewDescriptor, terrainHeightAt } from "@seki/core";
import type { Mesh } from "../../babylon";
import type { AcrossAt } from "./canyon-plan";
import { type DeckAxis, Decks } from "./deck-plan";
import type { MapBuilding } from "./facade-frame";
import type { LandmarkPart } from "./landmarks";
import { mapBuilding } from "./map-building";
import { BinIndex } from "./map-index";
import { type Box2, type P2, pointInRing } from "./polygon";
import { surfaceLiftAt } from "./surface-lift";

export interface BuildingEntry {
  readonly ring: readonly P2[];
  readonly view: Extract<ViewDescriptor, { kind: "building" }>;
  readonly at: Vec3;
  readonly base: number;
  readonly bounds: Box2;
  readonly cell: string;
  /** Drawn from its recipe (ADR-0062) instead of the facade plan. */
  readonly landmark: LandmarkPart | null;
}

export interface GroundEntry {
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

export interface TerrainEntry {
  readonly grid: TerrainGrid;
  /** Sides at the edge of the map data: an apron runs on from them (ADR-0044). */
  readonly open: TerrainOpenSides | undefined;
  readonly bounds: Box2;
  mesh: Mesh | null;
}

/**
 * The map city's entities as measured data (ADR-0044) with their spatial indexes, and the
 * queries on them: heights, roofs, neighbours and roads. Draws nothing.
 */
export class MapEntries {
  readonly buildings = new Map<EntityId, BuildingEntry>();
  readonly grounds = new Map<EntityId, GroundEntry>();
  readonly terrains = new Map<EntityId, TerrainEntry>();
  readonly buildingIndex = new BinIndex();
  private readonly roadIndex = new BinIndex();
  /** Every surface but water, for the lift of the feet standing on one (ADR-0045). */
  private readonly surfaceIndex = new BinIndex();
  readonly decks = new Decks();

  addBuilding(id: EntityId, e: BuildingEntry): void {
    this.buildings.set(id, e);
    this.buildingIndex.add(id, e.bounds);
  }

  addGround(id: EntityId, g: GroundEntry): void {
    this.grounds.set(id, g);
    if (g.marking) return;
    if (g.deck) this.decks.add(id, g.ring, g.deck);
    if (g.surface === "road") this.roadIndex.add(id, g.bounds);
    if (g.surface !== "water" && g.surface !== "basin") this.surfaceIndex.add(id, g.bounds);
  }

  /** Forgets a building or a ground surface (not a terrain). */
  remove(id: EntityId): void {
    this.buildings.delete(id);
    this.grounds.delete(id);
    this.decks.remove(id);
    this.buildingIndex.remove(id);
    this.roadIndex.remove(id);
    this.surfaceIndex.remove(id);
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

  /** How far the picture lifts feet at (x, y, z) above the terrain: `surfaceLiftAt`. */
  surfaceLift(x: number, y: number, z: number): number {
    return surfaceLiftAt(x, y, z, this.decks.heightAt(x, z), () => this.heightAt(x, z), [...this.surfaceIndex.at(x, z)].map((id) => this.grounds.get(id)));
  }

  /** The drawn ground at (x, z): the terrain and the pavement on it; null outside every terrain. */
  readonly drawnGround = (x: number, z: number): number | null => {
    const h = this.heightAt(x, z);
    return h === null ? null : h + this.surfaceLift(x, h, z);
  };

  /** The highest other building at (x, z), for the firewalls against it. */
  readonly neighbourAt = (x: number, z: number, self: number): number | null => {
    let top: number | null = null;
    for (const id of this.buildingIndex.at(x, z)) {
      if (id === self) continue;
      const b = this.buildings.get(id);
      if (b && pointInRing({ x, z }, b.ring)) top = Math.max(top ?? -Infinity, b.base + b.view.height);
    }
    return top;
  };

  /** The building across the street at (x, z), for the spans over it (ADR-0051). */
  readonly acrossAt: AcrossAt = (x, z, self) => {
    for (const id of this.buildingIndex.at(x, z)) {
      const b = this.buildings.get(id);
      if (id !== self && b && pointInRing({ x, z }, b.ring)) return { id, top: b.base + b.view.height, clutter: b.view.vertical?.clutter ?? 0 };
    }
    return null;
  };

  readonly roadAt = (x: number, z: number): boolean => {
    for (const id of this.roadIndex.at(x, z)) {
      const g = this.grounds.get(id);
      if (g && pointInRing({ x, z }, g.ring)) return true;
    }
    return false;
  };

  /** The measured building of an entry (ADR-0044, ADR-0048), with the parts lifted onto it (G-057). */
  building(id: EntityId, e: BuildingEntry): MapBuilding {
    return mapBuilding(id, e, (x, z) => this.heightAt(x, z), [...this.buildingIndex.within(e.bounds)].flatMap((o) => this.buildings.get(o) ?? []));
  }
}
