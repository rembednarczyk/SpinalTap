import { type P2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import type { GroundChunk } from "./ground-strips";

/**
 * The ground pieces of the chunk tables as the game lays them (off the bridges, rings through
 * `cleanRing` as the renderer cleans them), in 16 m bins for point queries: what `kerb-jag` and
 * `crossing-shape-*` look the pieces up by.
 */
export interface Piece {
  readonly surface: string;
  readonly ring: readonly P2[];
  readonly box: ReturnType<typeof boundsOf>;
  readonly chunk: string;
}

const BIN = 16;
const binOf = (v: number) => Math.floor(v / BIN);

export class GroundIndex {
  readonly pieces: Piece[] = [];
  private readonly bins = new Map<string, Piece[]>();

  constructor(chunks: readonly GroundChunk[]) {
    for (const c of chunks) {
      for (const g of c.ground) {
        if (g.bridge) continue;
        const raw: P2[] = [];
        for (let i = 0; i + 1 < g.outline.length; i += 2) raw.push({ x: g.outline[i]!, z: g.outline[i + 1]! });
        const ring = cleanRing(raw);
        if (ring.length < 3) continue;
        const piece = { surface: g.surface, ring, box: boundsOf(ring), chunk: c.id };
        this.pieces.push(piece);
        for (let i = binOf(piece.box.minX); i <= binOf(piece.box.maxX); i++) {
          for (let k = binOf(piece.box.minZ); k <= binOf(piece.box.maxZ); k++) {
            const key = `${i},${k}`;
            const list = this.bins.get(key);
            if (list) list.push(piece);
            else this.bins.set(key, [piece]);
          }
        }
      }
    }
  }

  /** The surfaces of the pieces holding (x, z), in table order. */
  at(x: number, z: number): string[] {
    const out: string[] = [];
    for (const p of this.bins.get(`${binOf(x)},${binOf(z)}`) ?? []) {
      if (x >= p.box.minX && x <= p.box.maxX && z >= p.box.minZ && z <= p.box.maxZ && pointInRing({ x, z }, p.ring)) out.push(p.surface);
    }
    return out;
  }

  /** Is (x, z) on a carriageway the game draws a kerb against (`road` or `crossing`)? */
  roadAt(x: number, z: number): boolean {
    return this.at(x, z).some((s) => s === "road" || s === "crossing");
  }
}
