import type { P2 } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { GroundIndex } from "./ground-index";
import type { GroundChunk } from "./ground-strips";

/**
 * Jagged kerbs (`kerb-jag`, the user's question of 15.11, G-803 fixed one by hand without a check):
 * the kerb the game draws is the edge of a sidewalk piece that faces a carriageway (the renderer's
 * `kerbs`: an edge of 0.3 m and more whose point 0.5 m out on its normal lies on a `road` or
 * `crossing` piece). Those edges, joined along the pieces' ends (within 0.3 m) into polylines,
 * are walked for a zigzag: within `WINDOW` of arc, vertices turning both ways (turns of 2 degrees
 * and more) whose farthest strays more than `AMPLITUDE` from the chord of the window. A bend (all
 * turns one way) is none: a corner's arc may turn as it likes, only a zigzag or a step is found.
 * Left out: a place near a zigzag of the map's own street axis (`streets`, within `STREET_NEAR`),
 * where the jag follows the data and is not the import's. Findings are the vertex that strays
 * farthest, keyed on 10 m squares (`SAMPLED_KINDS`).
 */

type Finding = { readonly at: string; readonly what: string };
type Pt = readonly [number, number];

/** The zigzag's least amplitude (m) and the longest arc it may span (m). */
export const AMPLITUDE = 0.1;
export const WINDOW = 3;
/** Turns smaller than this are straight (degrees). */
const TURN_MIN = 2;
/** The ends of two pieces' kerbs that join (m), and a kerb edge's least length (m, the renderer's). */
const JOIN = 0.3;
const EDGE_MIN = 0.3;
/** How near a zigzag of the street's own axis excuses one of the kerb's (m). */
export const STREET_NEAR = 6;

export interface Zigzag {
  /** The vertex of the polyline that strays farthest. */
  readonly k: number;
  readonly dev: number;
  readonly span: number;
}

const turnOf = (p: readonly Pt[], i: number): number => {
  const ax = p[i]![0] - p[i - 1]![0];
  const az = p[i]![1] - p[i - 1]![1];
  const bx = p[i + 1]![0] - p[i]![0];
  const bz = p[i + 1]![1] - p[i]![1];
  return (Math.atan2(ax * bz - az * bx, ax * bx + az * bz) * 180) / Math.PI;
};

/** The zigzags of a polyline: windows of under `WINDOW` of arc with turns both ways and a stray over `AMPLITUDE`, one per farthest vertex. */
export const zigzags = (p: readonly Pt[], amplitude = AMPLITUDE): Zigzag[] => {
  const s = [0];
  for (let i = 1; i < p.length; i++) s.push(s[i - 1]! + Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]));
  const turns = p.map((_, i) => (i > 0 && i < p.length - 1 ? turnOf(p, i) : 0));
  const best = new Map<number, Zigzag>();
  for (let i = 0; i + 2 < p.length; i++) {
    for (let j = i + 2; j < p.length && s[j]! - s[i]! < WINDOW; j++) {
      let left = false;
      let right = false;
      for (let k = i + 1; k < j; k++) {
        if (turns[k]! >= TURN_MIN) left = true;
        else if (turns[k]! <= -TURN_MIN) right = true;
      }
      if (!left || !right) continue;
      const dx = p[j]![0] - p[i]![0];
      const dz = p[j]![1] - p[i]![1];
      const len = Math.hypot(dx, dz);
      if (len < 0.05) continue;
      let k = i + 1;
      let dev = 0;
      for (let q = i + 1; q < j; q++) {
        const d = Math.abs((p[q]![0] - p[i]![0]) * dz - (p[q]![1] - p[i]![1]) * dx) / len;
        if (d > dev) [k, dev] = [q, d];
      }
      if (dev > amplitude && dev > (best.get(k)?.dev ?? 0)) best.set(k, { k, dev, span: s[j]! - s[i]! });
    }
  }
  return [...best.values()];
};

/** The kerb polylines of the ground: the sidewalk edges facing a carriageway, joined where pieces meet. */
export const kerbLines = (index: GroundIndex): { readonly pts: P2[]; readonly chunk: string }[] => {
  const chains: { pts: P2[]; chunk: string }[] = [];
  for (const piece of index.pieces) {
    if (piece.surface !== "sidewalk") continue;
    const ring = piece.ring;
    const n = ring.length;
    const faces = ring.map((a, i) => {
      const b = ring[(i + 1) % n]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < EDGE_MIN) return false;
      return index.roadAt((a.x + b.x) / 2 + ((b.z - a.z) / len) * 0.5, (a.z + b.z) / 2 - ((b.x - a.x) / len) * 0.5);
    });
    if (faces.every(Boolean)) {
      chains.push({ pts: [...ring, ring[0]!], chunk: piece.chunk });
      continue;
    }
    const first = faces.indexOf(false);
    let cur: P2[] = [];
    for (let m = 1; m <= n; m++) {
      const i = (first + m) % n;
      if (faces[i]) {
        if (!cur.length) cur.push(ring[i]!);
        cur.push(ring[(i + 1) % n]!);
      } else if (cur.length) {
        chains.push({ pts: cur, chunk: piece.chunk });
        cur = [];
      }
    }
    if (cur.length) chains.push({ pts: cur, chunk: piece.chunk });
  }
  return joinChains(chains);
};

const near = (p: P2, q: P2) => Math.hypot(p.x - q.x, p.z - q.z) < JOIN;

/** Chains whose ends lie within `JOIN` of each other, laid end to end (one of the two reversed when needed). */
const joinChains = (chains: readonly { pts: P2[]; chunk: string }[]): { pts: P2[]; chunk: string }[] => {
  const used = new Array<boolean>(chains.length).fill(false);
  const out: { pts: P2[]; chunk: string }[] = [];
  for (let i = 0; i < chains.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let cur = chains[i]!;
    for (let grown = true; grown; ) {
      grown = false;
      for (let j = 0; j < chains.length && !grown; j++) {
        if (used[j]) continue;
        const o = chains[j]!.pts;
        const [a0, a1, b0, b1] = [cur.pts[0]!, cur.pts[cur.pts.length - 1]!, o[0]!, o[o.length - 1]!];
        let pts: P2[] | null = null;
        if (near(a1, b0)) pts = [...cur.pts, ...o.slice(1)];
        else if (near(a1, b1)) pts = [...cur.pts, ...[...o].reverse().slice(1)];
        else if (near(a0, b1)) pts = [...o, ...cur.pts.slice(1)];
        else if (near(a0, b0)) pts = [...[...o].reverse(), ...cur.pts.slice(1)];
        if (!pts) continue;
        cur = { pts, chunk: cur.chunk };
        used[j] = true;
        grown = true;
      }
    }
    out.push(cur);
  }
  return out;
};

/** Points of the street axes that zigzag themselves (the data's own jag), as `STREET_NEAR` excuses. */
const streetJags = (streets: readonly (readonly Pt[])[]): P2[] =>
  streets.flatMap((s) => zigzags(s).map((z) => ({ x: s[z.k]![0], z: s[z.k]![1] })));

/** The zebras' corners, for telling a jag at a zebra's end from one along the kerb. */
const nearZebra = (index: GroundIndex, x: number, z: number): boolean =>
  index.pieces.some((p) => p.surface === "crossing" && p.ring.some((q) => Math.hypot(q.x - x, q.z - z) < 3));

export const kerbJag = (chunks: readonly GroundChunk[], streets: readonly (readonly Pt[])[]): Finding[] => {
  const index = new GroundIndex(chunks);
  const excused = streetJags(streets);
  return kerbLines(index).flatMap((line) =>
    zigzags(line.pts.map((p): Pt => [p.x, p.z])).flatMap((zz) => {
      const p = line.pts[zz.k]!;
      if (excused.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < STREET_NEAR)) return [];
      const where = nearZebra(index, p.x, p.z) ? "at a zebra" : "along the kerb";
      return [{ at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, what: `kerb zigzag ${zz.dev.toFixed(2)} m over ${zz.span.toFixed(1)} m ${where}` }];
    }),
  );
};
