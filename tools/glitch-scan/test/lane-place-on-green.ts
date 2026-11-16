import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";
import { ORTHO_OFFSETS } from "../../osm-import/src/corrections-kerb.ts";
import { type Line } from "../../osm-import/src/features.ts";
import { offsetLine } from "../../osm-import/src/geometry.ts";
import { lanePlaces } from "../../osm-import/src/lane-place.ts";
import { ROAD_WIDTH, roadWidth } from "../../osm-import/src/street-section.ts";

/**
 * `lane-place-on-green` (G-825, the curator's review of its first round): a 0.5 m sample of the
 * orthophoto's green under a carriageway or a pavement by a node where a one-way street splits into
 * its lanes' ways or they join it (`lanePlaces`), past every carriageway's band as the map's line
 * and width give it: a lane the import laid off the line onto a lawn (Ruska's link at Lwowska,
 * Andersa's at Mełgiewska, Al. Solidarności's through lanes on the lawn's tip), within `PAST` of
 * a way placed there. One finding a sample. The bands are read off the map alone, a measured
 * way's moved by its offset (`ORTHO_OFFSETS`), with a margin: asphalt the map explains is none.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };
/** The chunks' ground as the tables keep it. */
export interface GreenChunk {
  readonly ground: readonly { readonly surface: string; readonly outline: readonly number[] }[];
}

/** How far round a node the samples are taken (m): past the longest lane laid beside another, 20 m. */
export const NODE_NEAR = 25;
/** The samples' step (m), the cover's. */
const STEP = 0.5;
/** How far past a band's edge a sample is still the band's (m): the outlines' rounding and the cover's cell. */
const MARGIN = 0.5;
/**
 * How far past its band a placed way's lane reaches (m): its place by the node (half a lane of 3.5
 * m and more past the kerb) and the pavement filled from its new kerb on (`KERB_REACH`, 3 m).
 */
const PAST = 6;
/** The surfaces a lane laid onto a lawn shows: its asphalt and the pavement filled to its new kerb. */
const LAID = new Set(["road", "sidewalk"]);

const distanceTo = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const l2 = dx * dx + dz * dz;
    const k = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z));
  }
  return best;
};

// The even-odd rule on the flat outline `[x0, z0, …]` as the chunk keeps it.
const inRing = (x: number, z: number, o: readonly number[]): boolean => {
  let r = false;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    const [ax, az, bx, bz] = [o[i]!, o[i + 1]!, o[j]!, o[j + 1]!];
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) r = !r;
  }
  return r;
};

/** The nodes of the splits and joins `lanePlaces` reads among the map's carriageways `lines`, each with the ways placed there. */
export const laneNodes = (lines: readonly Line[]): { node: Pt; ways: Line[] }[] => {
  const ways = lines.filter((l) => l.tags.highway);
  const byId = new Map(ways.map((l) => [l.id, l]));
  const nodes = new Map<string, { node: Pt; ways: Line[] }>();
  for (const [id, place] of lanePlaces(ways, () => 0)) {
    const l = byId.get(id)!;
    for (const p of [place.start ? l.line[0] : undefined, place.end ? l.line[l.line.length - 1] : undefined]) {
      if (!p) continue;
      const at = nodes.get(`${p.x},${p.z}`) ?? { node: p, ways: [] };
      at.ways.push(l);
      nodes.set(`${p.x},${p.z}`, at);
    }
  }
  return [...nodes.values()];
};

/** The samples of green under a carriageway or a pavement past the map's bands by the nodes of `lines`' splits and joins. */
export const lanePlaceOnGreen = (lines: readonly Line[], chunks: readonly GreenChunk[], covers: readonly Cover[]): Finding[] => {
  const bands = lines
    .filter((l) => ROAD_WIDTH[l.tags.highway ?? ""] !== undefined && l.tags.area !== "yes")
    .map((l) => ({ line: offsetLine(l.line, ORTHO_OFFSETS.get(l.id) ?? 0), reach: roadWidth(l.tags) / 2 + MARGIN }));
  const pieces = chunks.flatMap((c) =>
    c.ground
      .filter((g) => LAID.has(g.surface))
      .map((g) => {
        const xs = g.outline.filter((_, i) => i % 2 === 0);
        const zs = g.outline.filter((_, i) => i % 2 === 1);
        return { surface: g.surface, outline: g.outline, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
      }),
  );
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const { node, ways } of laneNodes(lines)) {
    const near = bands.filter((b) => distanceTo(node, b.line) < NODE_NEAR + b.reach);
    const placed = ways.map((l) => ({ line: l.line, reach: roadWidth(l.tags) / 2 + PAST }));
    const here = pieces.filter((g) => g.maxX >= node.x - NODE_NEAR && g.minX <= node.x + NODE_NEAR && g.maxZ >= node.z - NODE_NEAR && g.minZ <= node.z + NODE_NEAR);
    // The samples on the cover's grid of 0.5 m, so two nodes near each other find a sample once.
    const [x0, z0] = [Math.floor((node.x - NODE_NEAR) / STEP) * STEP + STEP / 2, Math.floor((node.z - NODE_NEAR) / STEP) * STEP + STEP / 2];
    for (let x = x0; x <= node.x + NODE_NEAR; x += STEP)
      for (let z = z0; z <= node.z + NODE_NEAR; z += STEP) {
        const p = { x, z };
        const key = `${x.toFixed(2)},${z.toFixed(2)}`;
        if (seen.has(key) || Math.hypot(x - node.x, z - node.z) > NODE_NEAR) continue;
        const cover = coverFor(covers, p);
        if (!cover || coverAt(cover, x, z) !== COVER.green) continue;
        const laid = here.find((g) => x >= g.minX && x <= g.maxX && z >= g.minZ && z <= g.maxZ && inRing(x, z, g.outline));
        if (!laid || near.some((b) => distanceTo(p, b.line) <= b.reach) || !placed.some((b) => distanceTo(p, b.line) <= b.reach)) continue;
        seen.add(key);
        out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${laid.surface} on green ${key} by the lanes' node ${node.x.toFixed(1)},${node.z.toFixed(1)}` });
      }
  }
  return out;
};
