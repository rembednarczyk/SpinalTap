/**
 * A pavement reaches the kerb (G-522): the map's footways and pavement areas lie where they were
 * drawn, and a carriageway is as wide as its lanes or its type say, so along most streets with
 * separately mapped sidewalks the two missed each other by 1–3 m and left a strip of bare terrain
 * between the asphalt and the paving, a wedge where the footway wanders off the street's axis. The
 * strip is laid as a sidewalk from the carriageway's edge to the paving, so the renderer draws its
 * kerb at the asphalt and the drain grates keep to it (`props-decals-street.ts`), when nothing
 * else lies in it: a building, a lawn, water, steps, rails or another carriageway keep their
 * place, and a gap wider than `KERB_REACH` is a verge of its own.
 */
import { type Pt, type Rect, ccw, lineLength, offsetLine, pointAlong, pointInRing, ringBounds, selfIntersects, simplifyRing } from "./geometry.ts";
import { type Band } from "./ground.ts";

/** The widest gap between a carriageway's edge and its paving paved over (m), as the glitch scan's `kerb-gap-bare` counts. */
export const KERB_REACH = 3;
/** The step along a carriageway's edge (m). */
const ALONG = 0.5;
/** Steps of the edge a fill spans at most: a fill reads the map no further than this along the edge, wherever its run goes on. */
const WINDOW = 20;
/**
 * How far past a chunk the bands and buildings a fill in it reads may lie (m): a window of the
 * edge from the chunk on, and the march out from it. Built with them, a district alone gets the
 * fills it gets in the whole city (`generate`).
 */
export const FILL_MARGIN = WINDOW * ALONG + KERB_REACH + 2;
/** The step out from the edge toward the paving (m). */
const ACROSS = 0.2;
/** How far a fill reaches into the paving it leads to (m), past the rounding to 0.1 m: no seam between them. */
const INTO = 0.1;
/** Halvings of the last step, to the paving's edge within 1.25 cm: the fill's outer edge follows it. */
const REFINE = 4;
/** How far the fill's outline may stray from its samples when simplified (m): finer than a chunk's 0.3, or a seam opens at the paving or the asphalt. */
const SIMPLIFY = 0.05;

/** The surfaces a fill leads to. */
const PAVING = new Set(["sidewalk", "footway", "square", "cobble"]);

type Boxed = Band & { readonly box: Rect };
type Block = { readonly box: Rect; readonly ring: readonly Pt[] };
type Hit = { readonly edge: Pt; readonly out: Pt };

/** Rings by the 10 m cells their boxes reach. */
class Bins<T extends { readonly box: Rect }> {
  private readonly cells = new Map<string, T[]>();
  constructor(items: readonly T[]) {
    for (const it of items)
      for (let i = Math.floor(it.box.minX / 10); i <= Math.floor(it.box.maxX / 10); i++)
        for (let k = Math.floor(it.box.minZ / 10); k <= Math.floor(it.box.maxZ / 10); k++) {
          const key = `${i},${k}`;
          const list = this.cells.get(key);
          if (list) list.push(it);
          else this.cells.set(key, [it]);
        }
  }
  at(p: Pt): readonly T[] {
    return this.cells.get(`${Math.floor(p.x / 10)},${Math.floor(p.z / 10)}`) ?? [];
  }
}

const inBox = (p: Pt, b: Rect) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ;
const isPaving = (b: Band) => PAVING.has(b.surface) && !b.carriageway && !b.bridge;

/**
 * The paving reached marching out from `edge` along `dir` over bare ground only, within
 * `KERB_REACH`; null where something else comes first, or where the paving starts at the edge.
 */
const pavingOut = (edge: Pt, dir: Pt, bands: Bins<Boxed>, blocks: Bins<Block>): Hit | null => {
  const at = (t: number) => ({ x: edge.x + dir.x * t, z: edge.z + dir.z * t });
  const what = (q: Pt): "bare" | "paving" | "other" => {
    if (blocks.at(q).some((b) => inBox(q, b.box) && pointInRing(q, b.ring))) return "other";
    const on = bands.at(q).filter((b) => inBox(q, b.box) && pointInRing(q, b.ring));
    return on.length === 0 ? "bare" : on.every(isPaving) ? "paving" : "other";
  };
  for (let t = ACROSS / 2; t <= KERB_REACH; t += ACROSS) {
    const got = what(at(t));
    if (got === "bare") continue;
    if (got === "other" || t < ACROSS) return null;
    let [lo, hi] = [t - ACROSS, t];
    for (let k = 0; k < REFINE; k++) {
      const mid = (lo + hi) / 2;
      if (what(at(mid)) === "bare") lo = mid;
      else hi = mid;
    }
    return { edge, out: at(hi + INTO) };
  }
  return null;
};

/** The ring of a run of hits, from the edge out to the paving; split in two where it would cross itself (a bend's inner side). */
const runRings = (run: readonly Hit[]): Pt[][] => {
  if (run.length < 2) return [];
  const ring = ccw([...run.map((h) => h.edge), ...run.map((h) => h.out).reverse()]);
  if (!selfIntersects(ring)) return [simplifyRing(ring, SIMPLIFY)];
  if (run.length < 4) return [];
  const mid = Math.floor(run.length / 2);
  return [...runRings(run.slice(0, mid + 1)), ...runRings(run.slice(mid))];
};

/**
 * The hits along one edge of a carriageway, `side` 1 its left (`offsetLine`'s positive offset), -1
 * its right, with the step each is at (the edge's last point none).
 */
const edgeHits = (line: readonly Pt[], offset: number, side: number, bands: Bins<Boxed>, blocks: Bins<Block>): { k: number | null; hit: Hit | null }[] => {
  const edge = offsetLine(line, offset);
  const out: { k: number | null; hit: Hit | null }[] = [];
  let s0 = 0;
  for (let i = 0; i + 1 < edge.length; i++) {
    const [a, b] = [edge[i]!, edge[i + 1]!];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) continue;
    const dir = { x: (-(b.z - a.z) / len) * side, z: ((b.x - a.x) / len) * side };
    // Samples at the steps of the whole edge's length, so a short segment gets its share.
    for (let k = Math.ceil(s0 / ALONG); k * ALONG < s0 + len; k++) out.push({ k, hit: pavingOut(pointAlong(edge, k * ALONG), dir, bands, blocks) });
    s0 += len;
  }
  const [a, b] = [edge[edge.length - 2]!, edge[edge.length - 1]!];
  const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  out.push({ k: null, hit: pavingOut(b, { x: (-(b.z - a.z) / len) * side, z: ((b.x - a.x) / len) * side }, bands, blocks) });
  return out;
};

/**
 * The sidewalks filling the gaps between the carriageways among `bands` (their `kerb` axis) and
 * the paving beside them, `buildings` standing in the way: one per run of hits along an edge, cut
 * every `WINDOW` steps, the two pieces sharing the step between them.
 */
export const kerbFills = (bands: readonly Boxed[], buildings: readonly (readonly Pt[])[]): Band[] => {
  const ground = new Bins(bands.filter((b) => !b.bridge));
  const blocks = new Bins(buildings.map((ring) => ({ ring, box: ringBounds(ring) })));
  const out: Band[] = [];
  for (const road of bands) {
    if (!road.kerb || road.bridge || lineLength(road.kerb.line) < ALONG) continue;
    for (const side of [1, -1]) {
      const hits = edgeHits(road.kerb.line, side * road.kerb.half, side, ground, blocks);
      let run: Hit[] = [];
      const flush = () => {
        for (const ring of runRings(run)) out.push({ surface: "sidewalk", ring, bridge: false, source: road.source, holed: true });
        run = [];
      };
      for (const { k, hit } of hits) {
        if (!hit) {
          flush();
          continue;
        }
        run.push(hit);
        if (k !== null && k % WINDOW === 0 && run.length > 1) {
          flush();
          run.push(hit);
        }
      }
      flush();
    }
  }
  return out;
};
