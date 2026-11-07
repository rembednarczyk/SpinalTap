import { type TerrainGrid, terrainHeightAt } from "../../../packages/core/src";
import { type GroundRect, type Pad, type Ramp, shapeGrid } from "../../../packages/sim/src/content/lublin/shape";
import type { Line } from "../../osm-import/src/features.ts";
import type { Tags } from "../../osm-import/src/osm.ts";

/**
 * `pad-on-road` (T-209): a set piece's pad or ramp, with its blend, lifts or lowers the terrain by
 * more than `MOST` on the axis of an OSM road or footway it does not own. ADR-0042 keeps the NMT
 * wherever a set piece is not, and a street is not part of one: Świętoduska climbed 1.85 m onto
 * Alchemia's T1 terrace (ADR-0074). Each pad and ramp is applied alone to the map's own grid, as
 * the game shapes it, so a finding names the piece that moved the street, not its neighbours.
 */

type Finding = { readonly at: string; readonly what: string };
type Chunk = { readonly bounds: GroundRect; readonly terrain: TerrainGrid };

/** The most a pad may move the terrain on a street's axis (m): the curator's tolerance, under a kerb. */
export const MOST = 0.3;
/** Samples along a way (m). */
const STEP = 0.5;

/** The ways a set piece must leave on the NMT: streets and footways drawn as lines, not steps (their own ramps), bridges or tunnels. */
const STREETS: ReadonlySet<string> = new Set([
  "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified",
  "living_street", "pedestrian", "service", "footway", "cycleway", "path",
]);
/**
 * A street of the map, not an informal track trodden across a plot (`informal=yes`): a set
 * piece built on the plot replaces it with the plot.
 */
export const isStreet = (t: Tags): boolean =>
  !!t.highway && STREETS.has(t.highway) && t.informal !== "yes" && t.area !== "yes" && !t.bridge && !t.tunnel && Number(t.layer ?? 0) === 0;

/** What a piece may move: its rectangle, or its ramp's corridor's bounds, grown by its blend. */
export type Piece = { readonly name: string; readonly pads: readonly Pad[]; readonly ramps: readonly Ramp[] };

const grow = (r: GroundRect, d: number): GroundRect => ({ minX: r.minX - d, maxX: r.maxX + d, minZ: r.minZ - d, maxZ: r.maxZ + d });
const overlaps = (a: GroundRect, b: GroundRect): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;
const inside = (r: GroundRect, x: number, z: number): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

/** The area a piece can move, a grid's cell past its blend (the terrain between grid points is interpolated). */
const reach = (p: Piece, cell: number): GroundRect[] => [
  ...p.pads.map((q) => grow(q.rect, q.blend + cell)),
  ...p.ramps.map((r) =>
    grow({ minX: Math.min(r.a.x, r.b.x), maxX: Math.max(r.a.x, r.b.x), minZ: Math.min(r.a.z, r.b.z), maxZ: Math.max(r.a.z, r.b.z) }, r.width / 2 + r.blend + cell),
  ),
];

/**
 * One finding per piece and way it moves: the way's id, the worst change and the length of it
 * moved by more than `MOST`.
 */
export const padOnRoadFindings = (pieces: readonly Piece[], chunks: readonly Chunk[], ways: readonly Line[]): Finding[] => {
  const out: Finding[] = [];
  for (const p of pieces) {
    const cell = Math.max(...chunks.map((c) => c.terrain.cell));
    const zones = reach(p, cell);
    const near = chunks.filter((c) => zones.some((z) => overlaps(z, c.bounds)));
    const shaped = near.map((c) => ({ c, g: shapeGrid(c.terrain, p.pads, p.ramps) }));
    const moved = (x: number, z: number): number => {
      const s = shaped.find((q) => inside(q.c.bounds, x, z));
      return s ? terrainHeightAt(s.g, x, z) - terrainHeightAt(s.c.terrain, x, z) : 0;
    };
    for (const w of ways) {
      let worst = 0;
      let at = "";
      let length = 0;
      for (let i = 0; i + 1 < w.line.length; i++) {
        const a = w.line[i]!;
        const b = w.line[i + 1]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.max(1, Math.ceil(len / STEP));
        for (let k = 0; k <= n; k++) {
          const x = a.x + ((b.x - a.x) * k) / n;
          const z = a.z + ((b.z - a.z) * k) / n;
          if (!zones.some((r) => inside(r, x, z))) continue;
          const d = moved(x, z);
          if (Math.abs(d) > MOST && k < n) length += len / n;
          if (Math.abs(d) > Math.abs(worst)) {
            worst = d;
            at = `${x.toFixed(0)},${z.toFixed(0)}`;
          }
        }
      }
      if (Math.abs(worst) > MOST) out.push({ at, what: `${p.name} moves ${w.id} (${w.tags.highway}${w.tags.name ? ` ${w.tags.name}` : ""}) by ${worst.toFixed(2)} m over ${length.toFixed(0)} m` });
    }
  }
  return out;
};
