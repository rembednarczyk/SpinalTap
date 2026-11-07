import type { EntityId, GroundSurface, RoadMarkingKind, Vec3, ViewDescriptor } from "@seki/core";
import type { AcrossAt } from "./canyon-plan";
import { type DeckAxis, Decks, deckHeight } from "./deck-plan";
import type { MapBuilding } from "./facade-frame";
import type { HeightAt } from "./ground-plan";
import type { LandmarkPart } from "./landmarks";
import { mapBuilding } from "./map-building";
import { BinIndex } from "./map-index";
import { type Box2, type P2, pointInRing } from "./polygon";
import { surfaceLiftAt } from "./surface-lift";
import { TerrainEntries } from "./terrain-index";

export type { TerrainEntry } from "./terrain-index";

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

/** The point halfway along a line. */
const middleOf = (line: readonly P2[]): P2 => {
  let rest = line.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - line[i]!.x, p.z - line[i]!.z), 0) / 2;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len >= rest && len > 0) return { x: a.x + ((b.x - a.x) * rest) / len, z: a.z + ((b.z - a.z) * rest) / len };
    rest -= len;
  }
  return line[line.length - 1] ?? { x: 0, z: 0 };
};

/**
 * The map city's entities as measured data (ADR-0044) with their spatial indexes, and the
 * queries on them: heights, roofs, neighbours and roads. Draws nothing.
 */
export class MapEntries {
  readonly buildings = new Map<EntityId, BuildingEntry>();
  readonly grounds = new Map<EntityId, GroundEntry>();
  readonly terrains = new TerrainEntries();
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
    return this.terrains.heightAt(x, z);
  }

  /** The terrain under a ground entry: the chunk's, or the entry's own height outside every terrain. */
  terrainOf(g: GroundEntry): HeightAt {
    return (x, z) => this.heightAt(x, z) ?? g.y;
  }

  /**
   * The height a ground entry is laid at: on a bridge's deck where there is one (ADR-0053); a way
   * under the bridge stays on the terrain where the deck has headroom over it (G-062); a marking
   * lies wholly on the highest deck under its middle, or on the terrain. A piece of the deck follows its own axis: on its outline the test for the ring may
   * fall either way. Where it jumps between the terrain and a deck, `surfaceAt` keeps the drape
   * of a point on the one under it (G-301).
   */
  groundHeight(g: GroundEntry, terrain: HeightAt = this.terrainOf(g)): HeightAt {
    const own = g.deck;
    if (own) return (x, z) => deckHeight(own, x, z);
    if (g.marking) {
      // The import cuts a road's lines at the bridge's ends, rounded to 0.1 m like the deck's
      // outline: an end a centimetre past it would run down to the terrain over the last cut of
      // the line (G-330). A line lies on the surface under its middle.
      const mid = middleOf(g.ring);
      const surface = this.decks.surfaceAt(mid.x, mid.z) ?? terrain;
      return Object.assign((x: number, z: number) => surface(x, z), { surfaceAt: () => surface });
    }
    // The drape reads millions of points: the terrain under each once, and only for a deck there (G-444).
    return Object.assign(
      (x: number, z: number) => {
        const under = terrain(x, z);
        return this.decks.heightAt(x, z, under) ?? under;
      },
      { surfaceAt: (x: number, z: number) => (this.decks.near(x, z) ? this.decks.surfaceAt(x, z, terrain(x, z)) : null) ?? terrain },
    );
  }

  /** The surfaces (not water, fountains or markings) whose boxes meet `box`. */
  surfacesWithin(box: Box2): Set<EntityId> {
    return this.surfaceIndex.within(box);
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

  /** The bounds of the other buildings that meet the box: `neighbourAt` finds none outside them. */
  readonly neighboursNear = (box: Box2, self: number): Box2[] => {
    const out: Box2[] = [];
    for (const id of this.buildingIndex.within(box)) {
      const b = this.buildings.get(id);
      if (id !== self && b) out.push(b.bounds);
    }
    return out;
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
