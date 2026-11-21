/**
 * The cones and barriers of a building site's street side (ADR-0096 rule 2, ADR-0087's sites): the
 * models of `extra-props.glb` as pieces of kind `clutter` among the site's own. Road works' practice
 * (the temporary traffic management of the German RSA and the British Chapter 8: a line of cones
 * along the works, solid barriers at its ends, crowd barriers funnelling the way in), cut down to
 * what a site's fence on a pavement needs:
 *
 * - a cone every `CONE_STEP` m along the fence where its outside faces a street a vehicle takes
 *   (`STREET_SIDE` m or nearer, and nearer out from the fence), on its verge;
 * - a concrete barrier (now and then the red water-filled one) at each corner of that stretch, along it;
 * - at the gate, a crowd barrier each side of the opening, the board's side past the board, now and
 *   then bent (at most one in four, by the hash).
 *
 * Every piece stands within its side of the fence, on the verge (`SiteGround.verge`: pavement, grass or bare ground, never the
 * carriageway) over its whole footprint and leaves `WALK_LEFT` m of open ground past it, so the
 * way along the fence stays a way through. No randomness: the
 * choices are hashes of the site's id and the piece's place in the list, never the site's stream,
 * so the site's own looks stay as they were.
 */
import { type StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { CLUTTER, CLUTTER_SHAPES } from "../../../packages/core/src/world/clutter.ts";
import { SITE_BOARD, SITE_FENCE } from "../../../packages/core/src/world/sites.ts";
import { type SiteGround } from "./construction-ground.ts";
import { type FenceEdge, type FenceRun, type GatePlace, along } from "./construction-fence.ts";

/** A fence's outside this near a street a vehicle takes (m, from a point 1 m out) is its street side. */
export const STREET_SIDE = 7;
/** The cones' spacing along the fence (m). */
export const CONE_STEP = 1.5;
/**
 * The models' half depths across the fence (m, `extra-props.glb`: a crowd barrier's splayed feet
 * reach further than its solid). A piece's centre stands its half depth, the fence's half thickness
 * and a hand's breadth out from the fence's line, so no foot goes into a panel.
 */
const DEPTH: Readonly<Record<number, number>> = { 9: 0.22, 10: 0.4, 11: 0.33, 12: 0.36, 13: 0.33, 14: 0.82, 15: 0.74 };
const outOf = (shape: number): number => (DEPTH[shape] ?? half(shape).d) + SITE_FENCE.thick / 2 + 0.05;
/** A run's end this near its edge's end is at a corner (m). */
const CORNER = 0.6;
/** The open ground a piece leaves past it, out from the fence (m). */
export const WALK_LEFT = 1.2;
/** The gaps between the pieces and to the gate's posts and the board (m). */
const GAP = 0.3;

type Shape = number;

/** A shape's half length along the fence and half depth across it. */
const half = (shape: Shape): { readonly l: number; readonly d: number } => {
  const s = CLUTTER_SHAPES[shape]!.solid!;
  return { l: s.hx, d: s.hz };
};

/** FNV-1a over a key. */
const hash = (key: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

const round = (v: number, k = 100): number => Math.round(v * k) / k + 0;

/** The ground a piece asks for: its footprint's corners and sides on the verge, and `WALK_LEFT` past it open. */
const fits = (g: SiteGround, e: FenceEdge, s: number, out: number, shape: Shape): boolean => {
  const h = half(shape);
  if (s - h.l < 0 || s + h.l > e.len) return false;
  const verge = g.verge ?? (() => false);
  for (const a of [-h.l, 0, h.l]) {
    const d = DEPTH[shape] ?? h.d;
    for (const b of [-d, d]) if (!verge(along(e, s + a, out + b))) return false;
    if (!g.open(along(e, s + a, out + d + WALK_LEFT))) return false;
  }
  return true;
};

/** Is the edge's outside at s its street side: a street within reach, and nearer out from the fence (not a side running up to it)? */
const streetSide = (g: SiteGround, e: FenceEdge, s: number): boolean => {
  const d = g.driveDistance(along(e, s, 1));
  return d <= STREET_SIDE && d < g.driveDistance(along(e, s, 0)) - 0.5;
};

interface Lay {
  readonly e: FenceEdge;
  readonly s: number;
  readonly out: number;
  readonly shape: Shape;
}

/** A piece along the fence, local +x against the edge and +z out (the fence's frame, `pieceAt`). */
const piece = (g: SiteGround, l: Lay): StreetPropItem => {
  const p = along(l.e, l.s, l.out);
  return { prop: "clutter", x: round(p.x), y: round(g.heightAt(p)), z: round(p.z), yaw: round(Math.atan2(l.e.n.x, l.e.n.z), 1e4), variant: l.shape };
};

/** The metres along the gate's edge the gate, its board and its crowd barriers take, the gaps in. */
const gateSpan = (gate: GatePlace): readonly [number, number] => {
  const near = gate.width / 2 + GAP + 2 * half(CLUTTER.railings[1][0]).l + GAP;
  const far = gate.width / 2 + GAP + SITE_BOARD.width + GAP + 2 * half(CLUTTER.railings[1][0]).l + GAP;
  const [lo, hi] = gate.leaf === 1 ? [far, near] : [near, far];
  return [gate.at - lo, gate.at + hi];
};

/** The crowd barriers by a gate (not a wicket): one each side, the board's side past the board, the long one where it fits. */
const gateRailings = (g: SiteGround, id: string, edges: readonly FenceEdge[], gate: GatePlace | null): Lay[] => {
  if (!gate || gate.wicket || !streetSide(g, edges[gate.edge]!, gate.at)) return [];
  const e = edges[gate.edge]!;
  const out: Lay[] = [];
  for (const side of [1, -1] as const) {
    // The board stands on the side away from the parked leaf (`fencePieces`).
    const board = side === -gate.leaf ? SITE_BOARD.width + GAP : 0;
    const bent = hash(`${id}:railing:${side}`) % 4 === 0 ? 1 : 0;
    for (const kind of [CLUTTER.railings[1], CLUTTER.railings[0]]) {
      const shape = kind[bent]!;
      const [s, off] = [gate.at + side * (gate.width / 2 + GAP + board + half(shape).l), outOf(shape)];
      if (fits(g, e, s, off, shape)) {
        out.push({ e, s, out: off, shape });
        break;
      }
    }
  }
  return out;
};

/** The site's street-side pieces: the corners' barriers, the gate's crowd barriers, then the cones between them. */
export const siteBarriers = (id: string, edges: readonly FenceEdge[], runs: readonly FenceRun[], gate: GatePlace | null, g: SiteGround): StreetPropItem[] => {
  if (!g.verge) return [];
  const laid: Lay[] = [];
  const taken: { edge: FenceEdge; from: number; to: number }[] = [];
  const take = (l: Lay) => {
    laid.push(l);
    taken.push({ edge: l.e, from: l.s - half(l.shape).l - GAP, to: l.s + half(l.shape).l + GAP });
  };
  const free = (e: FenceEdge, s: number, r: number) => !taken.some((t) => t.edge === e && s + r > t.from && s - r < t.to);
  if (gate) {
    const [from, to] = gateSpan(gate);
    taken.push({ edge: edges[gate.edge]!, from, to });
  }
  for (const l of gateRailings(g, id, edges, gate)) take(l);
  runs.forEach((r, k) => {
    const e = edges[r.edge]!;
    for (const [end, at, dir] of [
      [r.from, 0, 1],
      [r.to, e.len, -1],
    ] as const) {
      if (Math.abs(end - at) > CORNER || !streetSide(g, e, end + dir)) continue;
      const shape = CLUTTER.barriers[hash(`${id}:corner:${k}:${dir}`) % 3 === 0 ? 1 : 0]!;
      const s = end + dir * (half(shape).l + 0.1);
      const out = outOf(shape);
      if (free(e, s, half(shape).l) && fits(g, e, s, out, shape)) take({ e, s, out, shape });
    }
  });
  for (const r of runs) {
    const e = edges[r.edge]!;
    const len = r.to - r.from;
    const n = Math.floor(len / CONE_STEP);
    for (let i = 0; i <= n; i++) {
      const s = r.from + (len - n * CONE_STEP) / 2 + i * CONE_STEP;
      const c = CLUTTER.cone;
      if (streetSide(g, e, s) && free(e, s, half(c).l) && fits(g, e, s, outOf(c), c)) laid.push({ e, s, out: outOf(c), shape: c });
    }
  }
  return laid.map((l) => piece(g, l));
};
