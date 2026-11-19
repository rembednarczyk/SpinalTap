import { ESCALATORS, ESCALATOR_LANDINGS, ESCALATOR_SIDE, type Escalator, MALL_RAIL, MALL_SLAB, escalatorHead } from "./mall-plan";
import { type Piece, box, piece } from "./plan";

/*
 * The gallery's escalators (ADR-0093 O1): criss-cross flights along the atrium's south edge, P0 to P1
 * to P2 to P3, each 1.5 m clear, as treads (`step`) the movement climbs, with a balustrade on either
 * side and a landing at each head. The belt does not run (no need, ADR-0093). Solid, drawn near only:
 * the engine draws the treads in steel and the balustrades as sloping glass with a handrail.
 */

/** A floating tread's depth under its top; how many solid pieces a side's balustrade is cut into. */
const TREAD = 0.45;
const SIDE = ESCALATOR_SIDE;
const PARTS = 3;

/** The tread k (1..risers-1) of a flight: its x span and its top. */
export const escalatorTread = (e: Escalator, k: number): { readonly x0: number; readonly x1: number; readonly top: number } => {
  const a = e.x0 + e.dir * (k - 1) * e.going;
  const b = e.x0 + e.dir * k * e.going;
  return { x0: Math.min(a, b), x1: Math.max(a, b), top: e.from + (k * (e.to - e.from)) / e.risers };
};

/** A flight's treads: the lowest flight's down to P0's floor, the others a tread deep (people walk under them). */
const treads = (e: Escalator): Piece[] => {
  const out: Piece[] = [];
  for (let k = 1; k < e.risers; k++) {
    const t = escalatorTread(e, k);
    out.push({ ...piece(box(t.x0, t.x1, e.lane.z0, e.lane.z1, e.solid ? e.from - 0.05 : t.top - TREAD, t.top), "step", true), inside: true });
  }
  return out;
};

/**
 * A flight's balustrades on both its sides, just outside its lane: each side in `PARTS` upright pieces
 * from under its lowest tread to a metre over its highest (the simulation's solids stand upright; the
 * engine draws the slope).
 */
const sides = (e: Escalator): Piece[] => {
  const head = escalatorHead(e);
  const [lo, hi] = [Math.min(e.x0, head), Math.max(e.x0, head)];
  const span = (hi - lo) / PARTS;
  const out: Piece[] = [];
  for (let j = 0; j < PARTS; j++) {
    const [x0, x1] = [lo + j * span, lo + (j + 1) * span];
    // Heights along it: the flight rises with dir along x.
    const at = (x: number) => e.from + ((e.dir > 0 ? x - lo : hi - x) / (hi - lo)) * (e.to - e.from) * ((e.risers - 1) / e.risers);
    const [y0, y1] = [Math.min(at(x0), at(x1)), Math.max(at(x0), at(x1))];
    for (const [z0, z1] of [
      [e.lane.z0 - SIDE, e.lane.z0],
      [e.lane.z1, e.lane.z1 + SIDE],
    ] as const) out.push({ ...piece(box(x0, x1, z0, z1, e.solid ? e.from - 0.05 : y0 - TREAD, y1 + MALL_RAIL), "escalator", true), inside: true });
  }
  return out;
};

/** The landings at the heads: a slab on the floor's level, its sides over the atrium railed. */
export const escalatorLandings = (): Piece[][] =>
  ESCALATOR_LANDINGS.map((l): Piece[] => {
    const rail = (x0: number, x1: number, z0: number, z1: number): Piece => ({ ...piece(box(x0, x1, z0, z1, l.y, l.y + MALL_RAIL), "parapet", true), inside: true });
    const out: Piece[] = [{ ...piece(box(l.x0, l.x1, l.z0, l.z1, l.y - MALL_SLAB, l.y), "floor", true), inside: true }];
    // North side, over the atrium; the far side from the flights (P1's and P3's west).
    out.push(rail(l.x0, l.x1, l.z1 - 0.12, l.z1));
    if (l.rail === "w") out.push(rail(l.x0, l.x0 + 0.12, l.z0, l.z1 - 0.12));
    return out;
  });

/** A flight's treads and balustrades. */
export const escalatorFlight = (e: Escalator): Piece[] => [...treads(e), ...sides(e)];

/** Every piece of the escalators. */
export const escalatorPieces = (): Piece[] => [...ESCALATORS.flatMap(escalatorFlight), ...escalatorLandings().flat()];
