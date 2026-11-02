import type { StreetPropItem } from "../../../packages/core/src";
import type { Line } from "../../osm-import/src/features.ts";
import type { BoardSpan } from "../../osm-import/src/props-boards.ts";
import { type DrawnView, cityFrames } from "../../osm-import/src/venue-boards.ts";
import { wallOf } from "./door-pieces";

/**
 * The staircases' doors (ADR-0058 stage 9, rule 3 of `props-doors.ts`) checked against the map's
 * streets as OSM tags them, not as the chunks keep them (the chunks drop `tunnel` and `layer`): a
 * tenement's door with no entrance of the map and no venue's board by it stands on a wall that faces
 * a street only if a named street on the ground runs within 7 m of the point 7 m in front of the
 * wall's middle. One that faces only a way under ground (Trasa Podziemna, `tunnel=yes`, `layer=-1`)
 * looks onto a yard (G-197, T-110).
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** The rule's reach: a street's axis within 7 m of the point 7 m in front of the wall's middle. */
const HALF_REACH = 7;
/** How near an entrance of the map, and a board, a door of another rule stands (m). */
const ENTRANCE = 1.5;
const BOARD = 1;
/** The kinds of the named ways the chunks keep as streets (`chunkStreets`). */
const STREET_KINDS = new Set(["primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "pedestrian", "service", "footway", "steps", "path"]);
const TENEMENTS = new Set(["residential", "historic"]);

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};
const lineGap = (p: Pt, line: readonly Pt[]): number => Math.min(Infinity, ...line.slice(1).map((b, i) => segGap(p, line[i]!, b)));

/** Under ground or in a tunnel by its tags; a gateway's `building_passage` runs at street level. */
const below = (t: Readonly<Record<string, string>>): boolean => Number(t.layer ?? 0) < 0 || (t.tunnel !== undefined && t.tunnel !== "no" && t.tunnel !== "building_passage");

export const doorsFacingUnderground = (views: readonly DrawnView[], all: readonly StreetPropItem[], boards: readonly BoardSpan[], lines: readonly Line[], entrances: readonly Pt[]): Finding[] => {
  const frames = cityFrames(views)
    .filter((b) => !b.landmark && TENEMENTS.has(b.view.use))
    .map((b) => b.frame);
  const streets = lines.filter((l) => l.tags.name && STREET_KINDS.has(l.tags.highway ?? ""));
  const ground = streets.filter((l) => !below(l.tags));
  const under = streets.filter((l) => below(l.tags));
  return all.flatMap((i) => {
    if (i.prop !== "door") return [];
    const on = wallOf(frames, i);
    if (!on || entrances.some((e) => Math.hypot(e.x - i.x, e.z - i.z) <= ENTRANCE)) return [];
    const w = on.wall;
    if (boards.some((s) => s.nx * w.nx + s.nz * w.nz > 0.9 && segGap(i, s.a, s.b) < BOARD)) return [];
    const front = { x: (w.a.x + w.b.x) / 2 + w.nx * HALF_REACH, z: (w.a.z + w.b.z) / 2 + w.nz * HALF_REACH };
    if (ground.some((l) => lineGap(front, l.line) < HALF_REACH)) return [];
    const tunnel = under.find((l) => lineGap(front, l.line) < HALF_REACH);
    return tunnel ? [{ at: `${i.x.toFixed(0)},${i.z.toFixed(0)}`, what: `door of a staircase facing only ${tunnel.id} ${tunnel.tags.name} under ground` }] : [];
  });
};
