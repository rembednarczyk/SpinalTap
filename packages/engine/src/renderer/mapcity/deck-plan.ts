import type { EntityId, Vec3 } from "@seki/core";
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

/** How deep the deck's fascia hangs below its surface (m). */
const DECK_DEPTH = 0.9;
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

  /** The highest deck over (x, z), or null off every bridge. */
  readonly heightAt = (x: number, z: number): number | null => {
    let best: number | null = null;
    for (const p of this.pieces.values()) {
      const b = p.bounds;
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ || !pointInRing({ x, z }, p.ring)) continue;
      const y = deckHeight(p.deck, x, z);
      if (best === null || y > best) best = y;
    }
    return best;
  };
}

/** The fascia along the edges of a deck piece that look out over the valley (no other deck beyond them). */
export const planDeckEdges = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number, onDeck: (x: number, z: number) => boolean): void => {
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
    const ya = h(a.x, a.z) + lift;
    const yb = h(b.x, b.z) + lift;
    quadUv(
      sink,
      [
        { x: a.x, y: ya - DECK_DEPTH, z: a.z },
        { x: b.x, y: yb - DECK_DEPTH, z: b.z },
        { x: b.x, y: yb, z: b.z },
        { x: a.x, y: ya, z: a.z },
      ],
      { x: nx, y: 0, z: nz },
      FASCIA,
      [
        [0, 0],
        [len, 0],
        [len, 1],
        [0, 1],
      ],
      meta,
    );
  }
};

/** The deck's underside under a piece: its outline `DECK_DEPTH` below the deck, facing down, for the view from the river bank. */
export const planDeckUnderside = (sink: MeshSink, ring: readonly P2[], h: HeightAt, lift: number): void => {
  const down = { x: 0, y: -1, z: 0 };
  const meta = [SURFACE_CODE.kerb, 0] as const;
  for (const tri of drapeTriangles(ring)) {
    const [a, b, c] = tri.map((p) => vertex(sink, { x: p.x, y: h(p.x, p.z) + lift - DECK_DEPTH, z: p.z }, down, FASCIA, [p.x, p.z], meta)) as [number, number, number];
    face(sink, a, b, c, down);
  }
};
