import type { EntityId, GroundSurface } from "@seki/core";
import type { MeshSink } from "../mesh-sink";
import { planCrossing } from "./crossing-plan";
import { planDeckEdges, planDeckUnderside } from "./deck-plan";
import type { GroundCover } from "./ground-cut";
import { type DrapeCells, SURFACE_LIFT, cellsMeeting, drapedTriangles, planBasin, planSurface, planWater } from "./ground-plan";
import type { GroundEntry, MapEntries } from "./map-entries";
import { planMarking } from "./marking-plan";
import { signedArea } from "./polygon";
import { planSteps } from "./steps-plan";

/** The surfaces laid as a plain drape (`planSurface`), the ones that may overlap in one plane. */
const PLAIN: ReadonlySet<GroundSurface> = new Set(["road", "sidewalk", "square", "cobble", "footway", "grass", "rail"]);

/**
 * Which of two surfaces of one lift is drawn where they overlap: a cobbled way keeps its setts
 * across a plain square (its carriageway, the cars drive on it); the rest rank alike.
 */
const RANK: Readonly<Partial<Record<GroundSurface, number>>> = { cobble: 1 };

/**
 * Whether `a` is drawn over `b` where they overlap in one plane (G-320): the higher `RANK`, then
 * the smaller piece (one inside a larger of its kind is a detail of its own), then the one further
 * south-west and the lower id, so that of any two exactly one is, wherever they were built from.
 */
const drawnOver = (a: GroundEntry, ia: EntityId, b: GroundEntry, ib: EntityId): boolean => {
  const rank = (RANK[a.surface] ?? 0) - (RANK[b.surface] ?? 0);
  if (rank !== 0) return rank > 0;
  const area = Math.abs(signedArea(a.ring)) - Math.abs(signedArea(b.ring));
  if (Math.abs(area) > 1e-6) return area < 0;
  if (a.bounds.minX !== b.bounds.minX) return a.bounds.minX < b.bounds.minX;
  if (a.bounds.minZ !== b.bounds.minZ) return a.bounds.minZ < b.bounds.minZ;
  return ia < ib;
};

/**
 * The triangles of the plain surfaces of `g`'s lift drawn over it: where one lies in `g`'s plane
 * the two lay the same depth, and the depth buffer would take either pixel by pixel and anew with
 * every move of the camera (G-320). By a bridge's deck a piece of the deck and one lifted onto it
 * are in one plane too; a way under the deck is not.
 */
const drawnAbove = (entries: MapEntries, id: EntityId, g: GroundEntry, within: DrapeCells): GroundCover[] => {
  const out: GroundCover[] = [];
  for (const o of [...entries.surfacesWithin(g.bounds)].sort((a, b) => a - b)) {
    const other = entries.grounds.get(o);
    if (o === id || !other || !PLAIN.has(other.surface) || SURFACE_LIFT[other.surface] !== SURFACE_LIFT[g.surface]) continue;
    if (!drawnOver(other, o, g, id)) continue;
    // As the other's cell lays it (`planSurface`): the plane it is drawn in, not the ground's.
    out.push(...drapedTriangles(other.ring, entries.groundHeight(other), SURFACE_LIFT[other.surface], within));
  }
  return out;
};

/**
 * Lays one ground entry of the map city (ADR-0044) into a cell's ground and water; its surface only
 * in the drape's cells `within` takes where it is given (the glitch scan's overlaps, G-320).
 */
export const planGround = (ground: MeshSink, water: MeshSink, entries: MapEntries, id: EntityId, within?: DrapeCells): void => {
  const g = entries.grounds.get(id);
  if (!g) return;
  const terrain = entries.terrainOf(g);
  // On a bridge's deck where there is one (`groundHeight`); the river stays on the terrain.
  const h = entries.groundHeight(g, terrain);
  if (g.deck && g.surface !== "water") {
    planDeckEdges(ground, g.ring, h, SURFACE_LIFT[g.surface], (x, z) => entries.decks.heightAt(x, z) !== null, terrain);
    planDeckUnderside(ground, g.ring, h, SURFACE_LIFT[g.surface], terrain);
  }
  if (g.marking) planMarking(ground, g.marking, g.ring, h);
  else if (g.surface === "water") planWater(water, g.ring, terrain, undefined, within);
  else if (g.surface === "basin") planBasin(water, ground, g.ring, h);
  else if (g.surface === "steps") planSteps(ground, g.ring, h);
  else if (g.surface === "crossing") planCrossing(ground, g.ring, h);
  else planSurface(ground, g.surface, g.ring, h, g.surface === "sidewalk" ? entries.roadAt : null, drawnAbove(entries, id, g, within ?? cellsMeeting(g.bounds)), within);
};
