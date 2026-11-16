/**
 * Where the trunk of a tree of the crowns (G-797, `crown-trees.ts`) may stand: open ground of a
 * chunk (green or bare, a pavement or a square), not a building, a road, a footpath, steps, water,
 * rails or a bridge's deck, clear of the passages, the car parks (their cars keep their room from a
 * piece at the kerb, and the bays by it stay empty), the barriers of the map (the game cuts a
 * wall or a fence where a piece stands on its line) and the bridges' decks (the surface model
 * reads a deck's height over the ground under it as a crown: G-815) and the porticoes' columns
 * (solids of the game in front of a wall, under a balcony the surface model reads as a crown).
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { PORTICOES } from "../../../packages/sim/src/content/lublin/porticoes.ts";
import { type Pt, type Rect, pointInRing, ringBounds } from "./geometry.ts";
import type { Site } from "./props-site.ts";

/** How far a passage's axis keeps the trunks (m). */
const PASSAGE_REACH = 2.5;
/** How far a car park's outline keeps the trunks (m): past the room its cars keep from a piece at the kerb. */
export const PARK_OFF = 2;
/** How far a barrier's line keeps the trunks (m). */
export const BARRIER_OFF = 1;
/** How far a bridge's deck keeps the trunks (m). */
export const DECK_OFF = 2;
/** How far a portico's row of columns keeps the trunks (m): its balcony's overhang and a body's way round the shafts. */
export const PORTICO_OFF = 2;
/** The bins of the keep-outs (m). */
const BIN = 16;

const flat = (v: readonly number[]): Pt[] => Array.from({ length: v.length / 2 }, (_, k) => ({ x: v[2 * k]!, z: v[2 * k + 1]! }));

/** A keep-out: a car park's outline (closed, its inside too) or a barrier's line, and how far off it. */
interface Shape {
  readonly pts: readonly Pt[];
  readonly closed: boolean;
  readonly off: number;
  readonly box: Rect;
}

/** The distance from p to a shape's edges. */
const edgeGap = (s: Shape, p: Pt): number => {
  let d = Infinity;
  const n = s.closed ? s.pts.length : s.pts.length - 1;
  for (let i = 0; i < n; i++) {
    const [a, b] = [s.pts[i]!, s.pts[(i + 1) % s.pts.length]!];
    d = Math.min(d, segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z));
  }
  return d;
};

/** The car parks, the barrier lines, the bridges' decks of the chunks and the porticoes, by bins, for the trunks to keep off. */
export class KeepOut {
  private readonly bins = new Map<string, Shape[]>();

  constructor(site: Site) {
    const parks = new Map<string, Pt[]>();
    for (const c of site.chunks) for (const k of c.carParks ?? []) parks.set(k.id, flat(k.outline));
    for (const pts of parks.values()) this.add({ pts, closed: true, off: PARK_OFF, box: ringBounds(pts) });
    for (const c of site.chunks) for (const b of c.barriers ?? []) this.add({ pts: flat(b.line), closed: false, off: BARRIER_OFF, box: ringBounds(flat(b.line)) });
    for (const c of site.chunks) for (const g of c.ground) if (g.bridge) this.add({ pts: flat(g.outline), closed: true, off: DECK_OFF, box: ringBounds(flat(g.outline)) });
    for (const p of PORTICOES) this.add({ pts: p.columns, closed: false, off: PORTICO_OFF, box: ringBounds(p.columns) });
  }

  private add(s: Shape): void {
    if (s.pts.length < 2) return;
    for (let i = Math.floor((s.box.minX - s.off) / BIN); i <= Math.floor((s.box.maxX + s.off) / BIN); i++)
      for (let j = Math.floor((s.box.minZ - s.off) / BIN); j <= Math.floor((s.box.maxZ + s.off) / BIN); j++) {
        const k = `${i},${j}`;
        const list = this.bins.get(k);
        if (list) list.push(s);
        else this.bins.set(k, [s]);
      }
  }

  /** Whether p lies in a car park or on a deck, or nearer one's outline, a barrier's line or a portico's columns than it keeps. */
  near(p: Pt): boolean {
    for (const s of this.bins.get(`${Math.floor(p.x / BIN)},${Math.floor(p.z / BIN)}`) ?? []) {
      if (p.x < s.box.minX - s.off || p.x > s.box.maxX + s.off || p.z < s.box.minZ - s.off || p.z > s.box.maxZ + s.off) continue;
      if ((s.closed && pointInRing(p, s.pts)) || edgeGap(s, p) < s.off) return true;
    }
    return false;
  }
}

/** Whether a trunk may stand at p (see the module's comment). */
export const trunkGround = (site: Site, keep: KeepOut, p: Pt): boolean => {
  const s = site.surfaceAt(p);
  if (s !== null && s !== "green" && s !== "walk") return false;
  return site.chunkAt(p) !== null && !site.onPath(p) && !site.onSteps(p) && site.deckAt(p) === null && !site.nearPassage(p, PASSAGE_REACH) && !keep.near(p);
};
