/**
 * Rows of bollards OSM maps as lines (G-818, T-301): a way `barrier=bollard` with no tagged node
 * (`data/osm/points/bollard-lines.json`, `furniture.ts`) gives a post every `LINE_SPACING` metres or
 * so along it, its ends included, evenly over its length. The plan of 29.10 held each such way as
 * one point of its group (its id in the group's `osm`): that point becomes the line's posts, in the
 * same group; a way no group holds goes to a group of its own, `osm.bollard-lines`. A post of the
 * line within `NODE_ROOM` of a bollard mapped as a node gives way to it (the node anchors the row),
 * and none stands where the line crosses a way cars take (a drive into a yard, a street): the row
 * breaks there for the way's width and `DRIVE_ROOM` on either side. `stringBollards` then strings
 * the posts into rows with their chains (G-032), out of the zebras' mouths (no rule for zebras
 * here), on the lamps of the rows.
 *
 * OSM draws a row along a kerb a few decimetres off it, often over the carriageway the map measured
 * on the orthophoto (Plac Łokietka's east row 0.3-0.4 m in it): a post of a line on the carriageway
 * steps onto the pavement within `KERB_REACH` (`onKerb`); with none so near it stays, as a bollard
 * from a node does.
 */
import type { BollardLine } from "./furniture.ts";
import type { Pt } from "./geometry.ts";
import type { PlanItem, PropsPlan } from "./props-gen.ts";
import { offRoad } from "./props-place.ts";
import type { Site } from "./props-site.ts";

/** Spacing of a line's posts (m): Plac Łokietka and Plac Wolności keep 1.5 to 1.8 m (orthophoto 2025-04, GSV 2025). */
export const LINE_SPACING = 1.8;

/** A post of a line this near a bollard mapped as a node gives way to it (m). */
export const NODE_ROOM = 1;

/** Room beside a way cars take where it crosses a line (m). */
export const DRIVE_ROOM = 0.5;

/** A way cars take across lines of bollards: its axis and width (m). */
export interface DriveWay {
  readonly pts: readonly Pt[];
  readonly width: number;
}

/** How far a line's post on the carriageway looks for the pavement, and how far onto it it steps (m). */
export const KERB_REACH = 1.5;
export const KERB_INSET = 0.15;

/** Is `key` a post of a line (`w<id>#<n>`)? */
export const isLinePost = (key: string): boolean => /^w\d+#\d+$/.test(key);

/** Where a post stands: a line's on the carriageway on the pavement beside it, if any is near; the rest where they are. */
export const onKerb = (site: Site, p: Pt, key: string): Pt => (isLinePost(key) ? (offRoad(site, p, KERB_REACH, KERB_INSET) ?? p) : p);

/** The group of the lines no group of the plan holds. */
export const LINE_GROUP = "osm.bollard-lines";

const r1 = (v: number): number => Math.round(v * 10) / 10 + 0;

/** A line's posts: its ends and the points between, evenly about `spacing` apart along it. */
export const linePosts = (pts: readonly Pt[], spacing = LINE_SPACING): Pt[] => {
  const lens = pts.slice(1).map((b, k) => Math.hypot(b.x - pts[k]!.x, b.z - pts[k]!.z));
  const total = lens.reduce((s, l) => s + l, 0);
  if (total === 0) return pts.length ? [{ ...pts[0]! }] : [];
  const n = Math.max(1, Math.round(total / spacing));
  const out: Pt[] = [];
  for (let k = 0, seg = 0, from = 0; k <= n; k++) {
    const at = (total * k) / n;
    while (seg < lens.length - 1 && from + lens[seg]! < at) from += lens[seg++]!;
    const t = lens[seg]! > 0 ? Math.min(1, (at - from) / lens[seg]!) : 0;
    const a = pts[seg]!;
    const b = pts[seg + 1]!;
    out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
  }
  return out;
};

/** Where segment a-b crosses segment c-d, or null. */
const crossing = (a: Pt, b: Pt, c: Pt, d: Pt): Pt | null => {
  const r = { x: b.x - a.x, z: b.z - a.z };
  const s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + r.x * t, z: a.z + r.z * t } : null;
};

/** Where a line crosses the ways cars take, with the room each keeps clear (m from the crossing). */
export const driveGaps = (pts: readonly Pt[], drives: readonly DriveWay[]): { at: Pt; room: number }[] =>
  drives.flatMap((w) =>
    pts.slice(1).flatMap((b, i) =>
      w.pts.slice(1).flatMap((d, j) => {
        const at = crossing(pts[i]!, b, w.pts[j]!, d);
        return at ? [{ at, room: w.width / 2 + DRIVE_ROOM }] : [];
      }),
    ),
  );

/** The groups of bollards, read for the posts mapped as nodes (every id but a way's). */
const nodePosts = (items: readonly PlanItem[]): Pt[] =>
  items.flatMap((i) => (i.kind !== "bollard" || !i.points ? [] : i.points.flatMap((q, k) => (Array.isArray(i.osm) && String(i.osm[k] ?? "").startsWith("w") ? [] : [{ x: q[0], z: q[1] }]))));

/** The plan with its lines of bollards (those with a point `inMap`) laid out as posts, broken where `drives` cross them. */
export const withBollardLines = (plan: PropsPlan, lines: readonly BollardLine[], drives: readonly DriveWay[], inMap: (p: Pt) => boolean): PropsPlan => {
  const nodes = nodePosts(plan.items);
  // A post keeps its index along the line in its key, whatever gave way before it.
  const postsOf = (l: BollardLine): { p: [number, number]; id: string }[] => {
    const gaps = driveGaps(l.pts, drives);
    return linePosts(l.pts).flatMap((p, n) =>
      gaps.some((g) => Math.hypot(g.at.x - p.x, g.at.z - p.z) < g.room) || nodes.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < NODE_ROOM) ? [] : [{ p: [r1(p.x), r1(p.z)] as [number, number], id: `${l.id}#${n}` }],
    );
  };
  const byId = new Map(lines.filter((l) => l.pts.some(inMap)).map((l) => [l.id, l]));
  const held = new Set<string>();
  const items = plan.items.map((item) => {
    if (item.kind !== "bollard" || !item.points || !Array.isArray(item.osm) || !item.osm.some((id) => byId.has(id))) return item;
    const points: [number, number][] = [];
    const osm: string[] = [];
    item.points.forEach((q, k) => {
      const id = item.osm![k] as string | undefined;
      const line = id === undefined ? undefined : byId.get(id);
      if (!line) {
        points.push([q[0], q[1]]);
        osm.push(id ?? `${item.id}#${k}`);
        return;
      }
      held.add(line.id);
      for (const { p, id: key } of postsOf(line)) {
        points.push(p);
        osm.push(key);
      }
    });
    return { ...item, points, osm, count: points.length };
  });
  const rest = [...byId.values()].filter((l) => !held.has(l.id));
  const own = rest.flatMap(postsOf);
  const group: PlanItem[] = own.length
    ? [{ id: LINE_GROUP, kind: "bollard", inOsm: true, points: own.map((o) => o.p), osm: own.map((o) => o.id), count: own.length, note: "From data/osm/points/bollard-lines.json (pnpm osm:fetch): rows OSM maps as ways no group of the plan holds (G-818)." }]
    : [];
  return { ...plan, items: [...items, ...group] };
};
