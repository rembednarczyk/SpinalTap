import type { EntityId, Vec3 } from "@seki/core";
import { DECK_DEPTH, DECK_HEADROOM, deckDepth } from "@seki/sim";
import { DRESS_FLAG, type MeshSink, hexColor } from "../mesh-sink";
import { type HeightAt, SURFACE_CODE, drapeTriangles } from "./ground-plan";
import { type Box2, type P2, boundsOf, pointInRing } from "./polygon";
import { face, quadUv, vertex } from "./sink-ops";

/**
 * Bridges' decks (ADR-0053): the pieces of road and path the map has on a bridge are laid level
 * from abutment to abutment instead of on the valley under them; their open edges get a
 * concrete fascia down to the deck's underside, and the underside closes the deck from below.
 */
export interface DeckAxis {
  readonly a: Vec3;
  readonly b: Vec3;
}

/** Length of the fascia's quads over a way under the bridge, where its depth follows the terrain (m). */
const FASCIA_STEP = 2;
const FASCIA = hexColor("#6f6b66", DRESS_FLAG.solid);

/** The deck's height over (x, z): straight from `a` to `b` along the axis, level across it. */
export const deckHeight = (d: DeckAxis, x: number, z: number): number => {
  const dx = d.b.x - d.a.x;
  const dz = d.b.z - d.a.z;
  const t = Math.max(0, Math.min(1, ((x - d.a.x) * dx + (z - d.a.z) * dz) / (dx * dx + dz * dz || 1)));
  return d.a.y + (d.b.y - d.a.y) * t;
};

/** The decks of the spawned ground, for the height the pieces on them (and their markings) are laid at. */
export class Decks {
  private readonly pieces = new Map<EntityId, { readonly ring: readonly P2[]; readonly deck: DeckAxis; readonly bounds: Box2 }>();

  add(id: EntityId, ring: readonly P2[], deck: DeckAxis): void {
    this.pieces.set(id, { ring, deck, bounds: boundsOf(ring) });
  }

  remove(id: EntityId): void {
    this.pieces.delete(id);
  }

  /**
   * The highest deck over (x, z), or null off every bridge. For a way on the terrain at `under`,
   * only the decks within DECK_HEADROOM of it: under a higher one it stays on the terrain (G-062).
   */
  readonly heightAt = (x: number, z: number, under?: number): number | null => {
    let best: number | null = null;
    for (const p of this.pieces.values()) {
      const b = p.bounds;
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || !pointInRing({ x, z }, p.ring)) continue;
      const y = deckHeight(p.deck, x, z);
      if (under !== undefined && y - under > DECK_HEADROOM) continue;
      if (best === null || y > best) best = y;
    }
    return best;
  };
}

/**
 * The fascia along the edges of a deck piece that look out over the valley (no other deck beyond
 * them). With the `terrain`, it is thinner over a way under the bridge.
 */
export const planDeckEdges = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number, onDeck: (x: number, z: number) => boolean, terrain?: HeightAt): void => {
  const meta = [SURFACE_CODE.kerb, 0] as const;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i] as P2;
    const b = ring[(i + 1) % ring.length] as P2;
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.3) continue;
    // Outward normal of a counter-clockwise ring.
    const nx = (b.z - a.z) / len;
    const nz = -(b.x - a.x) / len;
    if (onDeck((a.x + b.x) / 2 + nx * 0.3, (a.z + b.z) / 2 + nz * 0.3)) continue;
    const n = terrain ? Math.ceil(len / FASCIA_STEP) : 1;
    const at = (k: number) => {
      const x = a.x + ((b.x - a.x) * k) / n;
      const z = a.z + ((b.z - a.z) * k) / n;
      const y = h(x, z);
      return { x, z, y: y + lift, depth: terrain ? deckDepth(y, terrain(x, z)) : DECK_DEPTH, u: (len * k) / n };
    };
    for (let k = 0; k < n; k++) {
      const [p, q] = [at(k), at(k + 1)];
      quadUv(
        sink,
        [
          { x: p.x, y: p.y - p.depth, z: p.z },
          { x: q.x, y: q.y - q.depth, z: q.z },
          { x: q.x, y: q.y, z: q.z },
          { x: p.x, y: p.y, z: p.z },
        ],
        { x: nx, y: 0, z: nz },
        FASCIA,
        [
          [p.u, 0],
          [q.u, 0],
          [q.u, 1],
          [p.u, 1],
        ],
        meta,
      );
    }
  }
};

/**
 * The deck's underside under a piece: its outline `DECK_DEPTH` below the deck, facing down, for
 * the view from the river bank. With the `terrain`, it is higher over a way under the bridge.
 */
export const planDeckUnderside = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number, terrain?: HeightAt): void => {
  const down = { x: 0, y: -1, z: 0 };
  const meta = [SURFACE_CODE.kerb, 0] as const;
  const under = (p: P2) => {
    const y = h(p.x, p.z);
    return y + lift - (terrain ? deckDepth(y, terrain(p.x, p.z)) : DECK_DEPTH);
  };
  for (const tri of drapeTriangles(ring)) {
    const [a, b, c] = tri.map((p) => vertex(sink, { x: p.x, y: under(p), z: p.z }, down, FASCIA, [p.x, p.z], meta)) as [number, number, number];
    face(sink, a, b, c, down);
  }
};
