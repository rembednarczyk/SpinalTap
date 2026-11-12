import { SURFACE_LIFT, type Vec3, type ViewDescriptor } from "../../../packages/core/src";
import { planCrossing } from "../../../packages/engine/src/renderer/mapcity/crossing-plan";
import { type GroundEntry, MapEntries } from "../../../packages/engine/src/renderer/mapcity/map-entries";
import { planMarking } from "../../../packages/engine/src/renderer/mapcity/marking-plan";
import { type Box2, boundsOf, cleanRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { planSteps } from "../../../packages/engine/src/renderer/mapcity/steps-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";

/**
 * `paint-under-deck`: road markings, zebras and level steps laid on a bridge's deck (ADR-0053) and
 * drawn under its carriageway, where nobody sees them, or hanging under the bridge. The drape reads
 * the ground at the corners of its grid round each point (G-301); for a line by the deck's edge
 * those lay on the terrain under the bridge, and the line's triangles were pulled down to it.
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** How far under the top of the deck's carriageway a point of paint may lie (m). */
const SUNK = 0.01;

/** The map city's entries of `items` as `MapCity` adds them: terrains, ground and its markings, and the decks. */
export const mapGround = (items: readonly Item[]): MapEntries => {
  const entries = new MapEntries();
  items.forEach(({ view, at }, i) => {
    const id = 1_000_000 + i;
    if (view.kind === "terrain") {
      const g = view.grid;
      entries.terrains.set(id, { grid: g, open: view.open, bounds: { minX: g.originX, maxX: g.originX + (g.cols - 1) * g.cell, minZ: g.originZ, maxZ: g.originZ + (g.rows - 1) * g.cell }, mesh: null });
    } else if (view.kind === "road-marking") {
      const line = view.line.map((p) => ({ x: p.x + at.x, z: p.z + at.z }));
      if (line.length >= 2) entries.addGround(id, { surface: "road", marking: view.marking, ring: line, y: at.y, bounds: boundsOf(line), cell: "" });
    } else if (view.kind === "ground") {
      const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
      if (ring.length >= 3) entries.addGround(id, { surface: view.surface, ring, y: at.y, bounds: boundsOf(ring), cell: "", ...(view.deck ? { deck: view.deck } : {}) });
    }
  });
  return entries;
};

/** How near a deck paint is checked (m): within a cell of the drape's grid, whose corners round it may lie on the deck. */
const NEAR = 5;
/** Whether two boxes come within `m` of each other. */
const meets = (a: Box2, b: Box2, m: number): boolean => a.minX <= b.maxX + m && a.maxX >= b.minX - m && a.minZ <= b.maxZ + m && a.maxZ >= b.minZ - m;

/** The paint of an entry as the cell builder lays it, null for one of no paint (or a piece on its own deck). */
const paintOf = (entries: MapEntries, g: GroundEntry): MeshSink | null => {
  if (g.deck) return null;
  const sink = new MeshSink();
  const h = entries.groundHeight(g);
  if (g.marking) planMarking(sink, g.marking, g.ring, h);
  else if (g.surface === "crossing") planCrossing(sink, g.ring, h);
  else if (g.surface === "steps") planSteps(sink, g.ring, h, (x, z) => entries.heightAt(x, z) !== null);
  else return null;
  return sink;
};

/** How far over the terrain beside a deck a point of paint may lie (m): the terrain bends a few centimetres under the drape. */
const LIFTED = 0.3;

/**
 * Paint by and on the decks against the surface it lies on: `paint-under-deck` (one per marking,
 * zebra or flight, at its deepest point under the deck's carriageway) and `paint-lifted-by-deck`
 * (its highest over the terrain beside the deck, pulled up to it). A triangle across a deck's
 * outline counts for the first by its points on the deck (G-330: a line's end past the outline
 * pulled down the step to the terrain, a flight's band on the deck laid on the terrain under it),
 * not for the second: past the outline it may run on at the deck's height, a line cut at the
 * bridge's end and rounded past it. A way's paint under a deck with headroom over it (G-062) is
 * off the deck (`top`): a way under a bridge does not count.
 */
export const deckPaint = (entries: MapEntries): { under: Finding[]; lifted: Finding[] } => {
  const decks = [...entries.grounds.values()].filter((g) => g.deck).map((g) => g.bounds);
  const under: Finding[] = [];
  const lifted: Finding[] = [];
  for (const g of entries.grounds.values()) {
    if (!decks.some((b) => meets(b, g.bounds, NEAR))) continue;
    const sink = paintOf(entries, g);
    if (!sink) continue;
    const terrain = entries.terrainOf(g);
    // The carriageway the paint lies on: a marking on the highest deck, a way's paint within its headroom (`groundHeight`).
    const top = (x: number, z: number) => entries.decks.heightAt(x, z, g.marking ? undefined : terrain(x, z));
    const lift = g.surface === "steps" ? 0 : SURFACE_LIFT.road;
    const p = sink.positions;
    const worst = { sunk: { by: SUNK, x: 0, z: 0 }, lifted: { by: LIFTED, x: 0, z: 0 } };
    for (let t = 0; t + 2 < sink.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((k) => sink.indices[t + k]! * 3).map((i) => ({ x: p[i]!, y: p[i + 1]!, z: p[i + 2]! })) as [Vec3, Vec3, Vec3];
      const off = [a, b, c].every((q) => top(q.x, q.z) === null);
      for (const [u, v] of [[1 / 3, 1 / 3], [0.5, 0], [0, 0.5], [0.5, 0.5]] as const) {
        const x = a.x + (b.x - a.x) * u + (c.x - a.x) * v;
        const z = a.z + (b.z - a.z) * u + (c.z - a.z) * v;
        const y = a.y + (b.y - a.y) * u + (c.y - a.y) * v;
        const deck = top(x, z);
        if (deck !== null && deck + lift - y > worst.sunk.by) worst.sunk = { by: deck + lift - y, x, z };
        // A flight's treads stand level over the slope by design (`planSteps`).
        if (off && deck === null && g.surface !== "steps" && y - terrain(x, z) - lift > worst.lifted.by) worst.lifted = { by: y - terrain(x, z) - lift, x, z };
      }
    }
    const at = (w: { x: number; z: number }) => `${g.marking ?? g.surface} at ${w.x.toFixed(1)},${w.z.toFixed(1)}`;
    if (worst.sunk.by > SUNK) under.push({ at: at(worst.sunk), what: `${(worst.sunk.by * 100).toFixed(0)} cm under the deck's carriageway` });
    if (worst.lifted.by > LIFTED) lifted.push({ at: at(worst.lifted), what: `${(worst.lifted.by * 100).toFixed(0)} cm over the terrain by the deck` });
  }
  return { under, lifted };
};
