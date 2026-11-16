import type { StreetPropItem } from "../../../packages/core/src";
import { SpatialHash } from "../../../packages/core/src/math/spatial-hash.ts";
import type { CrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands";
import { BOLLARD, alongSegment, chainSegments } from "../../../packages/sim/src/content/lublin/furniture";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import type { Pt } from "../../osm-import/src/geometry.ts";
import { type KerbRuleContext, groundLines, lineGaps, ruleWorld } from "../../osm-import/src/props-kerb-bollards.ts";
import type { Site } from "../../osm-import/src/props-site.ts";

/**
 * The rows of bollards along the kerbs of the centre (G-820, T-303): Lublin's posts stand along
 * every bigger street of Krakowskie and of the Old Town's district outside the walls, and the row
 * breaks only where people or cars cross the kerb (the rule's reasons, `props-kerb-bollards.ts`).
 */

type Finding = { readonly at: string; readonly what: string };

const near = (p: Pt): string => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

/** A post this near a kerb's sample covers it (m): half the widest spacing of a row and its slack. */
export const COVER = 1.2;
/** The longest stretch of a kerb with no post and no reason to break (m): over three spacings. */
export const GAP_MAX = 6;

const postsOf = (items: readonly StreetPropItem[]): SpatialHash<Pt> => {
  const h = new SpatialHash<Pt>(4);
  for (const i of items) if (i.prop === "bollard") h.insertPoint({ x: i.x, z: i.z }, i.x, i.z);
  return h;
};

/**
 * `kerb-bollard-gap`: a stretch of a kerb of the rule (a car street's, `KERB_SET` out on the
 * pavement) longer than `GAP_MAX` with no bollard within `COVER` and no reason of the rule to break
 * the row there (a zebra, a mouth, a junction, a stop, a car park along the kerb, the lawn, a tree),
 * every metre of it; a sample the game keeps clear for its own pieces (`gameOwns`) is no gap.
 * Sampled: keyed by its 10 m squares.
 */
export const kerbBollardGap = (
  site: Site,
  chunks: readonly LublinChunkData[],
  items: readonly StreetPropItem[],
  bands: readonly CrossingBand[],
  rule: KerbRuleContext,
  gameOwns: (p: Pt) => boolean = () => false,
): Finding[] => {
  const posts = postsOf(items);
  const lines = groundLines(site, chunks);
  const gaps = lineGaps(ruleWorld(site, chunks, items, bands, rule), lines);
  const covered = (p: Pt) => posts.queryRadius(p.x, p.z, COVER).some((q) => Math.hypot(q.x - p.x, q.z - p.z) <= COVER);
  const out: Finding[] = [];
  lines.forEach((line, k) => {
    const { samples } = line;
    let from = -1;
    const flush = (to: number) => {
      const len = samples[to]!.arc - samples[from]!.arc;
      if (len <= GAP_MAX) return;
      for (let i = from, next = samples[from]!.arc; i <= to; i++) {
        if (samples[i]!.arc < next) continue;
        out.push({ at: near(samples[i]!.p), what: `${line.name} (${line.side === 1 ? "left" : "right"}): ${len.toFixed(0)} m of kerb without a post` });
        next += 1;
      }
    };
    samples.forEach((s, i) => {
      const bare = gaps[k]![i] === null && !covered(s.p) && !gameOwns(s.p);
      if (bare && from < 0) from = i;
      if (!bare && from >= 0) {
        flush(i - 1);
        from = -1;
      }
    });
    if (from >= 0) flush(samples.length - 1);
  });
  return out;
};

/** How near an OSM node or line a post is OSM's (m): a line's post steps off the carriageway up to 0.55 m. */
export const OSM_REACH = 0.8;
/** A rule's post this far from a post of OSM's row, off that row's line by `ASIDE` or more, stands in a second row beside it (m). */
export const DOUBLE_NEAR = 1;
export const DOUBLE_FAR = 2.5;
export const ASIDE = 0.6;

/**
 * `kerb-bollard-double-row` (G-820 P1): a bollard of the kerb rule (in its area, not within
 * `OSM_REACH` of an OSM bollard node or line) `DOUBLE_NEAR`–`DOUBLE_FAR` from a post of OSM's row,
 * beside that row: `ASIDE` or more off the line through the OSM post and its nearest OSM neighbour.
 * The rule laid its own row along the kerb next to the row OSM maps 1–2 m off it.
 */
export const kerbBollardDoubleRow = (items: readonly StreetPropItem[], nodes: readonly Pt[], lines: readonly (readonly Pt[])[], inArea: (p: Pt) => boolean): Finding[] => {
  const posts = items.filter((i) => i.prop === "bollard");
  const onLine = (p: Pt) => lines.some((l) => l.slice(1).some((b, k) => toSegment(p, l[k]!, b) <= OSM_REACH));
  const isOsm = (p: Pt) => nodes.some((n) => Math.abs(n.x - p.x) <= OSM_REACH && Math.abs(n.z - p.z) <= OSM_REACH && Math.hypot(n.x - p.x, n.z - p.z) <= OSM_REACH) || onLine(p);
  const osm = new SpatialHash<Pt>(4);
  const rule: Pt[] = [];
  for (const i of posts) {
    const p = { x: i.x, z: i.z };
    if (isOsm(p)) osm.insertPoint(p, p.x, p.z);
    else if (inArea(p)) rule.push(p);
  }
  return rule.flatMap((p) => {
    const hit = osm.queryRadius(p.x, p.z, DOUBLE_FAR).find((q) => {
      const d = Math.hypot(q.x - p.x, q.z - p.z);
      if (d < DOUBLE_NEAR || d > DOUBLE_FAR) return false;
      const mate = osm
        .queryRadius(q.x, q.z, 3.5)
        .filter((o) => o !== q)
        .sort((a, b) => Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z))[0];
      if (!mate) return false;
      const l = Math.hypot(mate.x - q.x, mate.z - q.z) || 1;
      return Math.abs(((mate.x - q.x) * (p.z - q.z) - (mate.z - q.z) * (p.x - q.x)) / l) >= ASIDE;
    });
    return hit ? [{ at: near(p), what: `rule post ${Math.hypot(hit.x - p.x, hit.z - p.z).toFixed(1)} m beside OSM's row at ${near(hit)}` }] : [];
  });
};

/** A mouth the bollards keep out of: a band `half` either side of an axis a-b (a drive's, a passage's, a gate's). */
interface Mouth {
  readonly a: Pt;
  readonly b: Pt;
  readonly half: number;
  readonly what: string;
}

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

const toSegment = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

const stretched = (a: Pt, b: Pt, by: number): [Pt, Pt] => {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  return [
    { x: a.x - u.x * by, z: a.z - u.z * by },
    { x: b.x + u.x * by, z: b.z + u.z * by },
  ];
};

/** The mouths of the chunks: their drives (service ways, by their width), passages (2 m past the facades) and gates (2 m before and behind). */
export const mouthsOf = (chunks: readonly LublinChunkData[]): Mouth[] =>
  chunks.flatMap((c) => [
    ...(c.serviceWays ?? []).flatMap((w) => {
      const pts = flat(w.line);
      return pts.slice(1).map((b, k) => ({ a: pts[k]!, b, half: w.width / 2, what: "drive" }));
    }),
    ...(c.passages ?? []).map((p) => {
      const [a, b] = stretched(p.from, p.to, 2);
      return { a, b, half: p.width / 2, what: "passage" };
    }),
    ...(c.barriers ?? [])
      .filter((g) => g.kind === "gate" || g.kind === "lift-gate")
      .flatMap((g) => {
        const [a, b] = [flat(g.line)[0]!, flat(g.line).at(-1)!];
        const l = Math.hypot(b.x - a.x, b.z - a.z);
        if (l < 0.5) return [];
        const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const n = { x: -(b.z - a.z) / l, z: (b.x - a.x) / l };
        return [{ a: { x: m.x - n.x * 2, z: m.z - n.z * 2 }, b: { x: m.x + n.x * 2, z: m.z + n.z * 2 }, half: l / 2, what: "gate" }];
      }),
  ]);

/** How far along the kerb a bus stop's vehicles' doors open either way of its post, and how near the carriageway (m). */
export const STOP_DOORS = 6;
export const STOP_KERB = 1.5;
/** A door's mouth on the pavement: either way along its facade and out from it (m). */
const DOOR_ALONG = 0.6;
const DOOR_OUT = 0.8;

const AROUND = Array.from({ length: 8 }, (_, k) => ({ x: Math.cos((k * Math.PI) / 4), z: Math.sin((k * Math.PI) / 4) }));

/**
 * `bollard-blocks-mouth` (G-820): a bollard, or its chain, in the mouth of a drive, a passage or a
 * gate (its band across the kerb), in front of a door of the facades, or where a bus stop's
 * vehicles open their doors (`STOP_DOORS` either way of its post, `STOP_KERB` from the carriageway).
 * A zebra's mouth is `bollard-blocks-crossing`'s.
 */
export const bollardBlocksMouth = (site: Site, chunks: readonly LublinChunkData[], items: readonly StreetPropItem[]): Finding[] => {
  const mouths = new SpatialHash<Mouth>(8);
  for (const m of mouthsOf(chunks)) mouths.insert(m, Math.min(m.a.x, m.b.x) - m.half, Math.min(m.a.z, m.b.z) - m.half, Math.max(m.a.x, m.b.x) + m.half, Math.max(m.a.z, m.b.z) + m.half);
  const doors = items.filter((i) => i.prop === "door");
  const stops = [...new Map(chunks.flatMap((c) => flat(c.busStops ?? [])).map((p) => [`${p.x},${p.z}`, p])).values()];
  const byKerb = (p: Pt) => AROUND.some((d) => site.surfaceAt({ x: p.x + d.x * STOP_KERB, z: p.z + d.z * STOP_KERB }) === "road");
  const blocks = (p: Pt, r: number): string | null => {
    const m = mouths.at(p.x, p.z).find((o) => toSegment(p, o.a, o.b) < o.half + r);
    if (m) return m.what;
    for (const d of doors) {
      if (Math.abs(d.x - p.x) > 2 || Math.abs(d.z - p.z) > 2) continue;
      const front = { x: Math.sin(d.yaw), z: Math.cos(d.yaw) };
      const [dx, dz] = [p.x - d.x, p.z - d.z];
      if (Math.abs(dx * front.x + dz * front.z) < DOOR_OUT + r && Math.abs(dx * front.z - dz * front.x) < DOOR_ALONG + r) return "door";
    }
    if (stops.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < STOP_DOORS) && byKerb(p)) return "bus stop";
    return null;
  };
  return items
    .filter((i) => i.prop === "bollard")
    .flatMap((i) => {
      const post = blocks(i, BOLLARD.radius);
      const chain = post ? null : chainSegments(i).flatMap((s) => alongSegment(s.from, s.to, 0.1)).map((p) => blocks(p, 0)).find((w) => w !== null);
      const what = post ?? chain;
      return what ? [{ at: near(i), what: `${post ? "bollard" : "chain"} in the mouth of a ${what}` }] : [];
    });
};
