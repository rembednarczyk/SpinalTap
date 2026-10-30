/**
 * Rows of bollards (G-032): the posts of the plan strung into rows of near, nearly collinear
 * neighbours, each post turned along its row with its chain hung on the next post, or on the
 * shaft of a lamp standing in the row and on from it to the post after. The chains go into the
 * posts' `variant` (`bollardChains` of the simulation reads them). No post and no chain stands
 * in the mouth of a zebra crossing.
 */
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { type CrossingBand, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands.ts";
import { BOLLARD, POLE_SHAFT, alongSegment, chainThrough, chainVariant, distanceToPiece, furnitureRadius, turnLocal } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { Pt } from "./geometry.ts";
import { towardsStreet } from "./props-place.ts";
import type { Site } from "./props-site.ts";

/** Farthest two posts of one row stand apart (m): the plan's rows keep 1.7 to 3.1 m. */
export const ROW_GAP = 3.5;

/** Sharpest turn a row takes at a post: rows follow a kerb's curve, a corner starts a new row. */
const ROW_TURN = (35 * Math.PI) / 180;

/**
 * The posts strung into rows, each row in order from its end nearer -x (then -z), the rows
 * ordered the same way; a post with no neighbour is a row of its own. Shortest gaps link first,
 * a post takes two links at most, and only where the row turns less than `ROW_TURN` and
 * nothing is `blocked` between the two (a bench in the row, a zebra's mouth).
 */
export const postRows = (posts: readonly Pt[], blocked: (a: number, b: number) => boolean = () => false): number[][] => {
  const edges: [number, number, number][] = [];
  for (let a = 0; a < posts.length; a++)
    for (let b = a + 1; b < posts.length; b++) {
      const d = Math.hypot(posts[b]!.x - posts[a]!.x, posts[b]!.z - posts[a]!.z);
      if (d <= ROW_GAP && d > 0) edges.push([d, a, b]);
    }
  edges.sort((p, q) => p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
  const links: number[][] = posts.map(() => []);
  const root = posts.map((_, k) => k);
  const find = (k: number): number => (root[k] === k ? k : (root[k] = find(root[k]!)));
  // At a post that already has a link, the new one has to run on nearly opposite it.
  const straight = (at: number, to: number): boolean =>
    links[at]!.every((o) => {
      const u = { x: posts[o]!.x - posts[at]!.x, z: posts[o]!.z - posts[at]!.z };
      const v = { x: posts[to]!.x - posts[at]!.x, z: posts[to]!.z - posts[at]!.z };
      return (u.x * v.x + u.z * v.z) / (Math.hypot(u.x, u.z) * Math.hypot(v.x, v.z)) <= -Math.cos(ROW_TURN);
    });
  for (const [, a, b] of edges) {
    if (links[a]!.length >= 2 || links[b]!.length >= 2 || find(a) === find(b) || !straight(a, b) || !straight(b, a) || blocked(a, b)) continue;
    links[a]!.push(b);
    links[b]!.push(a);
    root[find(a)] = find(b);
  }
  const before = (a: number, b: number) => posts[a]!.x - posts[b]!.x || posts[a]!.z - posts[b]!.z || a - b;
  const seen = new Set<number>();
  const rows: number[][] = [];
  for (let k = 0; k < posts.length; k++) {
    if (seen.has(k) || links[k]!.length > 1) continue;
    const row = [k];
    for (let prev = -1, at = k; ; ) {
      const next = links[at]!.find((o) => o !== prev);
      if (next === undefined) break;
      row.push(next);
      prev = at;
      at = next;
    }
    for (const p of row) seen.add(p);
    rows.push(before(row[0]!, row[row.length - 1]!) <= 0 ? row : row.reverse());
  }
  return rows.sort((a, b) => before(a[0]!, b[0]!));
};

const r2 = (v: number): number => Math.round(v * 100) / 100 + 0;

/** The yaw that turns a post's +x (the renderer's frame: +z towards +x) to run along `d`. */
const alongYaw = (d: Pt): number => Math.atan2(-d.z, d.x);

const isPole = (i: StreetPropItem): boolean => i.prop !== "bollard" && POLE_SHAFT[i.prop] !== undefined;

/** How far from its centre a chain meets a piece: a post's face, a pole's shaft. */
const reach = (i: StreetPropItem): number => (isPole(i) ? POLE_SHAFT[i.prop]! : BOLLARD.side / 2);

/** The two ends of a chain from piece a to piece b, face to face. */
export const chainBetween = (a: StreetPropItem, b: StreetPropItem): { from: Pt; to: Pt } => {
  const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  const u = { x: (b.x - a.x) / l, z: (b.z - a.z) / l };
  return { from: { x: a.x + u.x * reach(a), z: a.z + u.z * reach(a) }, to: { x: b.x - u.x * reach(b), z: b.z - u.z * reach(b) } };
};

/**
 * The posts turned along their rows: each looks to the next post of its row and holds the
 * chain to it, the last one looks on from the one before it. Where a pole (a lamp) stands on
 * the chain between two posts (`poleBetween`), the chain hangs on its shaft: the post before
 * holds it up to the pole, the post after holds it back from the pole. A post on its own stands
 * along the street `along` gives (the kerb's direction), with no chain. No chain runs where
 * `blocked` (poles aside: they are links of the row, not in its way).
 */
export const stringRows = (
  posts: readonly StreetPropItem[],
  along: (p: Pt) => Pt | null,
  blocked: (a: StreetPropItem, b: StreetPropItem) => boolean = () => false,
  poleBetween: (a: StreetPropItem, b: StreetPropItem) => StreetPropItem | undefined = () => undefined,
): StreetPropItem[] => {
  const out = [...posts];
  for (const row of postRows(posts, (a, b) => blocked(posts[a]!, posts[b]!))) {
    if (row.length === 1) {
      const p = posts[row[0]!]!;
      const d = along(p);
      out[row[0]!] = { ...p, yaw: d ? r2(alongYaw(d)) : p.yaw, variant: 0 };
      continue;
    }
    row.forEach((k, n) => {
      const p = posts[k]!;
      const nextPost = n + 1 < row.length ? posts[row[n + 1]!]! : undefined;
      const prevPost = n > 0 ? posts[row[n - 1]!]! : undefined;
      const next = nextPost && (poleBetween(p, nextPost) ?? nextPost);
      const prev = prevPost && (poleBetween(prevPost, p) ?? prevPost);
      const d = next ? { x: next.x - p.x, z: next.z - p.z } : { x: p.x - prev!.x, z: p.z - prev!.z };
      const yaw = r2(alongYaw(d));
      const fwd = next ? Math.hypot(next.x - p.x, next.z - p.z) - reach(next) : 0;
      let back = 0;
      let turn = 0;
      if (prev && isPole(prev)) {
        back = Math.hypot(prev.x - p.x, prev.z - p.z) - reach(prev);
        // The pole in the post's own frame, off its -x.
        const l = turnLocal(-yaw, prev.x - p.x, prev.z - p.z);
        turn = Math.atan2(l.z, -l.x);
      }
      out[k] = { ...p, yaw, variant: chainVariant(fwd, back, turn) };
    });
  }
  return out;
};

/** Slides along a row, nearest first (m). */
const SLIDES = Array.from({ length: 30 }, (_, k) => ((k >> 1) + 1) * 0.1 * (k % 2 ? -1 : 1));

/** Least distance from a moved post to the others (m): a little under the plan's tightest rows. */
const POST_ROOM = 1.2;

/**
 * The posts out of the zebras' mouths: a post in one slides along its row (or its street, on
 * its own) to the nearest spot out of every mouth that `fits`, clear of the other posts; with
 * none within 3 m it goes (null).
 */
export const clearMouths = (posts: readonly StreetPropItem[], bands: readonly CrossingBand[], along: (p: Pt) => Pt | null, fits: (p: StreetPropItem, q: Pt) => boolean): (StreetPropItem | null)[] => {
  const out: (StreetPropItem | null)[] = [...posts];
  const inMouth = (q: Pt) => bands.some((b) => inCrossingBand(b, q, BOLLARD.side / 2));
  const rowOf = new Map<number, number[]>();
  for (const row of postRows(posts)) for (const k of row) rowOf.set(k, row);
  posts.forEach((p, k) => {
    if (!inMouth(p)) return;
    const row = rowOf.get(k) ?? [k];
    const n = row.indexOf(k);
    const o = posts[row[n + 1] ?? row[n - 1] ?? k]!;
    const l = Math.hypot(o.x - p.x, o.z - p.z);
    const dir = l > 0 ? { x: (o.x - p.x) / l, z: (o.z - p.z) / l } : along(p);
    out[k] = null;
    if (!dir) return;
    for (const s of SLIDES) {
      const q = { x: Math.round((p.x + dir.x * s) * 10) / 10 + 0, z: Math.round((p.z + dir.z * s) * 10) / 10 + 0 };
      if (inMouth(q) || !fits(p, q) || out.some((r) => r && Math.hypot(r.x - q.x, r.z - q.z) < POST_ROOM)) continue;
      out[k] = { ...p, x: q.x, z: q.z };
      return;
    }
  });
  return out;
};

/** Where the plan's bollards are in a generator's table. */
export interface BollardRef {
  readonly chunk: string;
  readonly index: number;
}

/**
 * The plan's bollards strung into rows in the table (G-032), out of the zebras' mouths, their
 * chains on the lamps of the rows and clear of every other piece. Returns the refs of the posts
 * that had to go, their places in the table left empty (undefined) for the caller to drop.
 */
export const stringBollards = <R extends BollardRef>(site: Site, byChunk: Map<string, (StreetPropItem | undefined)[]>, refs: readonly R[], bands: readonly CrossingBand[]): R[] => {
  const posts = refs.map((b) => byChunk.get(b.chunk)![b.index]!);
  const others = [...byChunk.values()].flat().filter((i): i is StreetPropItem => i !== undefined && i.prop !== "bollard" && furnitureRadius(i) > 0);
  const close = (o: StreetPropItem, p: Pt, r: number) => Math.abs(o.x - p.x) < r && Math.abs(o.z - p.z) < r;
  const along = (p: Pt) => {
    const t = towardsStreet(site, p);
    return t && { x: -t.z, z: t.x };
  };
  const fits = (p: StreetPropItem, q: Pt) =>
    site.chunkAt(q) === site.chunkAt(p) && site.surfaceAt(q) === site.surfaceAt(p) && !others.some((o) => close(o, q, 3) && distanceToPiece(o, q.x, q.z) < BOLLARD.side);
  const kept = clearMouths(posts, bands, along, fits);
  const live = kept.flatMap((p, k) => (p ? [{ p, k }] : []));
  const inWay = (a: StreetPropItem, b: StreetPropItem) => {
    const { from, to } = chainBetween(a, b);
    return others.filter((o) => close(o, a, ROW_GAP + 2) && chainThrough(from, to, o));
  };
  // A chain stops short of a bench or a bin in the row, a third post, a wall and a zebra's mouth; it hangs on one lamp at most.
  const blocked = (a: StreetPropItem, b: StreetPropItem) => {
    const { from, to } = chainBetween(a, b);
    if (alongSegment(from, to, 0.1).some((q) => site.surfaceAt(q) === "building" || bands.some((bd) => inCrossingBand(bd, q)))) return true;
    if (live.some(({ p }) => p !== a && p !== b && close(p, a, ROW_GAP + 1) && chainThrough(from, to, p))) return true;
    const way = inWay(a, b);
    return way.some((o) => !isPole(o)) || way.length > 1;
  };
  const strung = stringRows(
    live.map(({ p }) => p),
    along,
    blocked,
    (a, b) => inWay(a, b)[0],
  );
  live.forEach(({ k }, n) => (byChunk.get(refs[k]!.chunk)![refs[k]!.index] = { ...strung[n]!, y: Math.round(site.heightAt(strung[n]!) * 100) / 100 + 0 }));
  return refs.filter((r, k) => {
    if (kept[k]) return false;
    byChunk.get(r.chunk)![r.index] = undefined;
    return true;
  });
};
