import { BARRIER_OPENINGS, type BarrierKind, type StreetPropItem, barrierLayout } from "../../../packages/core/src";
import { distanceToBarrier } from "../../../packages/sim/src/content/lublin/barriers";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types";
import { SQUARE } from "../src/scan-keys.ts";
import { type LinePiece, pathPieces } from "./world-samples";

/**
 * How much of the map's barriers the game keeps (ADR-0077): the lines the import writes into the
 * chunks against the pieces the game lays of them after its own cuts (G-606, G-607, the city
 * walls), and the height of the low walls of a ruin's outline (G-605).
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

const near = (p: Pt): string => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

/** A barrier line of a chunk with its points. */
interface DataLine {
  readonly id: string;
  readonly kind: BarrierKind;
  readonly pts: readonly Pt[];
}

const dataLines = (chunks: readonly LublinChunkData[]): DataLine[] =>
  chunks.flatMap((c) =>
    (c.barriers ?? [])
      .filter((b) => !BARRIER_OPENINGS.has(b.kind))
      .map((b) => ({ id: b.id, kind: b.kind, pts: Array.from({ length: b.line.length / 2 }, (_, k) => ({ x: b.line[2 * k]!, z: b.line[2 * k + 1]! })) })),
  );

/** Samples every half metre along a line, with the length each stands for. */
const samples = (pts: readonly Pt[]): { p: Pt; len: number }[] =>
  pts.slice(1).flatMap((b, k) => {
    const a = pts[k]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const n = Math.max(1, Math.ceil(len / 0.5));
    return Array.from({ length: n }, (_, i) => ({ p: { x: a.x + ((b.x - a.x) * (i + 0.5)) / n, z: a.z + ((b.z - a.z) * (i + 0.5)) / n }, len: len / n }));
  });

/** The game's pieces by 8 m, of one kind. */
const pieceIndex = (items: readonly StreetPropItem[]) => {
  const cells = new Map<string, StreetPropItem[]>();
  for (const i of items) {
    const k = `${Math.floor(i.x / 8)}:${Math.floor(i.z / 8)}`;
    cells.set(k, [...(cells.get(k) ?? []), i]);
  }
  /** Is (p) under a piece of the kind (within 0.15 m of its footprint)? */
  return (p: Pt, kind: BarrierKind): boolean => {
    const [ci, cj] = [Math.floor(p.x / 8), Math.floor(p.z / 8)];
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (const it of cells.get(`${i}:${j}`) ?? []) if (barrierLayout(it.variant).kind === kind && distanceToBarrier(it, p.x, p.z) <= 0.15) return true;
      }
    }
    return false;
  };
};

/** A line of the map this long and more, kept along less than half of it, counts as cut. */
const MIN_LINE = 4;

export const barrierCoverChecks = (chunks: readonly LublinChunkData[], items: readonly StreetPropItem[], ruins: readonly (readonly Pt[])[], inRing: (p: Pt, ring: readonly Pt[]) => boolean): Record<string, () => Finding[]> => {
  const kept = pieceIndex(items);
  const lines = dataLines(chunks);
  return {
    /**
     * A barrier line of a chunk (4 m and longer) the game keeps along less than half its length:
     * cut away along a route, a flight or a road it runs beside, not just where they cross it.
     */
    "barrier-parallel-cut": () =>
      lines.flatMap((l) => {
        const s = samples(l.pts);
        const total = s.reduce((n, x) => n + x.len, 0);
        const on = s.reduce((n, x) => n + (kept(x.p, l.kind) ? x.len : 0), 0);
        return total >= MIN_LINE && on * 2 < total ? [{ at: near(s[Math.floor(s.length / 2)]!.p), what: `${l.id} ${l.kind} ${on.toFixed(0)} of ${total.toFixed(0)} m` }] : [];
      }),
    /**
     * The city walls in the chunks the game leaves out: one finding a metre, so the kept metres only
     * grow. Rounded in each square of the scan's keys, on the world's 0.5 m grid (`world-samples.ts`):
     * spread over the whole wall's metres left out, a stretch kept or lost at one end moved the
     * findings of every other stretch, from one square to the next (G-756).
     */
    "city-wall-kept": () =>
      lines
        .filter((l) => l.kind === "city-wall")
        .flatMap((l) => {
          const squares = new Map<string, LinePiece[]>();
          for (const x of pathPieces(l.pts, 0.5)) {
            if (kept(x, l.kind)) continue;
            const key = `${Math.floor(Number(x.x.toFixed(0)) / SQUARE)},${Math.floor(Number(x.z.toFixed(0)) / SQUARE)}`;
            squares.set(key, [...(squares.get(key) ?? []), x]);
          }
          return [...squares.values()].flatMap((missing) => {
            const metres = Math.round(missing.reduce((n, x) => n + x.len, 0) + 1e-9);
            return Array.from({ length: metres }, (_, k) => ({ at: near(missing[Math.min(missing.length - 1, Math.floor((k * missing.length) / metres))]!), what: `${l.id} metre ${k + 1} of ${metres} left out in its square` }));
          });
        }),
    /** A wall piece over 0.6 m inside a ruin's outline (`historic=ruins`): its foundations are low walls (G-605). */
    "ruin-wall-height": () =>
      items.flatMap((i) => {
        const b = barrierLayout(i.variant);
        return b.kind === "wall" && b.height > 0.6 && ruins.some((r) => inRing(i, r)) ? [{ at: near(i), what: `wall ${b.height} m in a ruin` }] : [];
      }),
  };
};
