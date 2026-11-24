/**
 * The fence of a building site (ADR-0087 step 2): along the site's outline 0.3 m in, only where
 * the ground is free (`SiteGround.free`: no carriageway, pavement, wall or map fence there), in
 * panels of up to `SITE_PANEL` m; the gate on the stretch nearest a street a vehicle takes, else
 * a wicket by the nearest street of any kind.
 */
import { type StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { SITE_BOARD, SITE_GATE, SITE_LEAF, SITE_LOOKS, SITE_PANEL, siteFenceVariant, siteGateVariant } from "../../../packages/core/src/world/sites.ts";
import { type SiteGround } from "./construction-ground.ts";
import { type Pt, ccw } from "./geometry.ts";

/** How far in from the outline the fence stands (m). */
export const FENCE_INSET = 0.3;
/** Step of the samples along the fence (m). */
const STEP = 0.25;
/** How far either side of the fence's line its samples look (m): the panel and a hand's breadth. */
const ACROSS = 0.15;
/** The shortest stretch of free ground a fence is laid on (m). */
const SHORTEST = 1;
/** A gate further than this from every street a vehicle takes is a wicket (m). */
export const GATE_REACH = 25;
/** Clear of the opening to the next panel (m): the gate's post (`SITE_GATE.post` each side of its middle) and 2 cm; the board's gap to the opening. */
const POST_GAP = 2 * SITE_GATE.post + 0.02;
const BOARD_GAP = 0.3;

/** One side of the fence's ring: from `a`, `len` long along `d`, `n` its outward normal. */
export interface FenceEdge {
  readonly a: Pt;
  readonly d: Pt;
  readonly n: Pt;
  readonly len: number;
}

/** A stretch of an edge over free ground, metres along it. */
export interface FenceRun {
  readonly edge: number;
  readonly from: number;
  readonly to: number;
}

/** Where the gate stands: on `edge`, centred `at` metres along it, its leaf parked on the side `leaf` along the edge, the board on the other. */
export interface GatePlace {
  readonly edge: number;
  readonly at: number;
  readonly width: number;
  readonly wicket: boolean;
  readonly leaf: 1 | -1;
}

export const along = (e: FenceEdge, s: number, out = 0): Pt => ({ x: e.a.x + e.d.x * s + e.n.x * out, z: e.a.z + e.d.z * s + e.n.z * out });

/** A ring moved `by` metres in on every side (mitred corners), counter-clockwise. */
export const insetRing = (ring: readonly Pt[], by: number): Pt[] => {
  const r = ccw(ring).filter((p, i, all) => Math.hypot(p.x - all[(i + 1) % all.length]!.x, p.z - all[(i + 1) % all.length]!.z) > 0.05);
  const lines = r.map((a, i) => {
    const b = r[(i + 1) % r.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const d = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    // The inward normal of a counter-clockwise ring is the left one.
    return { p: { x: a.x - d.z * by, z: a.z + d.x * by }, d };
  });
  return lines.map((l, i) => {
    const prev = lines[(i + r.length - 1) % r.length]!;
    const den = prev.d.x * l.d.z - prev.d.z * l.d.x;
    if (Math.abs(den) < 1e-6) return l.p;
    const t = ((l.p.x - prev.p.x) * l.d.z - (l.p.z - prev.p.z) * l.d.x) / den;
    return { x: prev.p.x + prev.d.x * t, z: prev.p.z + prev.d.z * t };
  });
};

/** The edges of a counter-clockwise ring. */
export const fenceEdges = (ring: readonly Pt[]): FenceEdge[] =>
  ring.flatMap((a, i) => {
    const b = ring[(i + 1) % ring.length]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) return [];
    const d = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    return [{ a, d, n: { x: d.z, z: -d.x }, len }];
  });

/** Free ground under the fence's line at a point of an edge: the line and either side of it. */
const fenceFree = (g: SiteGround, p: Pt): boolean => (g.fenceFree ?? g.free).call(g, p);
const freeAt = (g: SiteGround, e: FenceEdge, s: number): boolean => fenceFree(g, along(e, s)) && fenceFree(g, along(e, s, ACROSS)) && fenceFree(g, along(e, s, -ACROSS));

/** The stretches of the edges over free ground, `SHORTEST` m and longer. */
export const freeRuns = (edges: readonly FenceEdge[], g: SiteGround): FenceRun[] => {
  const out: FenceRun[] = [];
  edges.forEach((e, edge) => {
    const n = Math.max(1, Math.round(e.len / STEP));
    let from: number | null = null;
    let last = 0;
    for (let k = 0; k <= n; k++) {
      const s = (e.len * k) / n;
      if (freeAt(g, e, s)) {
        from ??= s;
        last = s;
        continue;
      }
      if (from !== null && last - from >= SHORTEST) out.push({ edge, from, to: last });
      from = null;
    }
    if (from !== null && last - from >= SHORTEST) out.push({ edge, from, to: last });
  });
  return out;
};

/** The room a gate of `width` asks of its run: the opening, the leaf parked on one side, the board on the other. */
const roomOf = (width: number): { readonly leaf: number; readonly board: number } => ({ leaf: width / 2 + width + SITE_LEAF.over + POST_GAP, board: width / 2 + BOARD_GAP + SITE_BOARD.width + POST_GAP });

/**
 * The gate: of the runs with room for it, the place nearest a street a vehicle takes (within
 * `GATE_REACH`), else the wicket's nearest a street of any kind, both with open ground outside and
 * free ground inside. Null when no run has room even for the wicket.
 */
export const pickGate = (edges: readonly FenceEdge[], runs: readonly FenceRun[], g: SiteGround): GatePlace | null => {
  const best = (width: number, dist: (p: Pt) => number, reach: number): GatePlace | null => {
    const room = roomOf(width);
    let pick: GatePlace | null = null;
    let pickD = reach;
    for (const r of runs) {
      const e = edges[r.edge]!;
      for (const leaf of [1, -1] as const) {
        const lo = r.from + (leaf === 1 ? room.board : room.leaf);
        const hi = r.to - (leaf === 1 ? room.leaf : room.board);
        for (let s = lo; s <= hi + 1e-9; s += 0.5) {
          const ends = [-width / 2, 0, width / 2].map((o) => s + o);
          if (!ends.every((t) => g.open(along(e, t, 1.2)) && g.free(along(e, t, -2)))) continue;
          const d = dist(along(e, s, 1));
          if (d < pickD - 1e-9) {
            pickD = d;
            pick = { edge: r.edge, at: s, width, wicket: width === SITE_GATE.wicket, leaf };
          }
        }
      }
    }
    return pick;
  };
  return best(SITE_GATE.gate, (p) => g.driveDistance(p), GATE_REACH) ?? best(SITE_GATE.wicket, (p) => g.walkDistance(p), Infinity);
};

/** A piece on an edge at `s`, `out` metres off its line, facing out of the site (local +z) or in. */
const pieceAt = (e: FenceEdge, s: number, out: number, faceOut: boolean): { x: number; z: number; yaw: number } => {
  const p = along(e, s, out);
  return { x: p.x, z: p.z, yaw: faceOut ? Math.atan2(e.n.x, e.n.z) : Math.atan2(-e.n.x, -e.n.z) };
};

const round = (v: number, k = 100): number => Math.round(v * k) / k + 0;

export interface FenceLook {
  /** Every how many panels one carries a hologram ad (3-5). */
  readonly every: number;
  readonly led: number;
  /** The ad's design for the k-th ad. */
  readonly ad: (k: number) => number;
  /** The board's design. */
  readonly board: number;
}

/** The panels over the runs, the gate's span left out, then the gate and the board on the fence's outer face. */
export const fencePieces = (edges: readonly FenceEdge[], runs: readonly FenceRun[], gate: GatePlace | null, g: SiteGround, look: FenceLook): StreetPropItem[] => {
  const out: StreetPropItem[] = [];
  let panels = 0;
  let ads = 0;
  const lay = (e: FenceEdge, from: number, to: number) => {
    const len = to - from;
    if (len < 0.4) return;
    const n = Math.ceil(len / SITE_PANEL - 1e-9);
    for (let k = 0; k < n; k++) {
      const s = from + (len * (k + 0.5)) / n;
      const l = len / n;
      const p = pieceAt(e, s, 0, true);
      // Local +x runs against the edge (`pieceAt`'s yaw): the rise is from the edge's later end to its earlier.
      const [h0, h1] = [g.heightAt(along(e, s + l / 2)), g.heightAt(along(e, s - l / 2))];
      const ad = panels % look.every === look.every - 1 ? look.ad(ads++) : null;
      panels++;
      out.push({ prop: "site-fence", x: round(p.x), y: round((h0 + h1) / 2), z: round(p.z), yaw: round(p.yaw, 1e4), variant: siteFenceVariant({ length: l, rise: h1 - h0, ad, led: look.led }) });
    }
  };
  for (const r of runs) {
    const e = edges[r.edge]!;
    if (gate && gate.edge === r.edge && gate.at > r.from && gate.at < r.to) {
      lay(e, r.from, gate.at - gate.width / 2 - POST_GAP);
      lay(e, gate.at + gate.width / 2 + POST_GAP, r.to);
    } else lay(e, r.from, r.to);
  }
  if (!gate) return out;
  const e = edges[gate.edge]!;
  const p = pieceAt(e, gate.at, 0, true);
  // The leaf is parked `gate.leaf` along the edge, which is local -x.
  out.push({ prop: "site-gate", x: round(p.x), y: round(g.heightAt(along(e, gate.at))), z: round(p.z), yaw: round(p.yaw, 1e4), variant: siteGateVariant(gate.wicket, look.led, gate.leaf === -1) });
  const b = gate.at - gate.leaf * (gate.width / 2 + BOARD_GAP + SITE_BOARD.width / 2);
  const q = pieceAt(e, b, 0.1, true);
  out.push({ prop: "site-board", x: round(q.x), y: round(g.heightAt(along(e, b))), z: round(q.z), yaw: round(q.yaw, 1e4), variant: look.board % SITE_LOOKS.boards });
  return out;
};
