/**
 * A bridge's deck ending down a bank (G-739): an end of a deck's axis where the terrain (the NMT,
 * the bridge left out) lies more than `IN_SLOPE` under the highest terrain within `SLOPE_REACH`
 * on past the end along the axis. A deck is level from end to end at the terrain's height at its
 * ends, so an end mapped down the bank of the valley it spans tilts the whole deck down to it,
 * off the level of the street it goes on from. Not an end another deck goes on from: a bridge
 * mapped in several ways is one deck on through that node.
 */
type Pt = { readonly x: number; readonly z: number };
type Deck = { readonly a: Pt; readonly b: Pt };
type Finding = { readonly at: string; readonly what: string };

/** How far on past the end the scan reads the terrain (m). */
export const SLOPE_REACH = 2.5;
/** The step it reads it at (m). */
export const SLOPE_SAMPLE = 0.25;
/** An end more than this under the terrain on past it lies down a bank (m). */
export const IN_SLOPE = 0.5;
/** Another deck's end this close is the node it goes on from (m): the import rounds to 0.1. */
const SAME = 0.15;

const axisKey = (d: Deck): string => `${d.a.x},${d.a.z},${d.b.x},${d.b.z}`;

/** The ends of `decks`' axes down a bank, `terrain` the NMT at (x, z). */
export const bridgeEndsInSlope = (decks: readonly Deck[], terrain: (x: number, z: number) => number): Finding[] => {
  const out: Finding[] = [];
  // A deck cut into pieces (the niches of G-274) has one axis: its ends counted once.
  const seen = new Set<string>();
  for (const d of decks) {
    const own = axisKey(d);
    for (const [end, from] of [
      [d.a, d.b],
      [d.b, d.a],
    ] as const) {
      const len = Math.hypot(end.x - from.x, end.z - from.z);
      const at = `${end.x.toFixed(1)},${end.z.toFixed(1)}`;
      if (len < 1e-6 || seen.has(`${own}@${at}`)) continue;
      seen.add(`${own}@${at}`);
      const [dx, dz] = [(end.x - from.x) / len, (end.z - from.z) / len];
      if (decks.some((o) => axisKey(o) !== own && [o.a, o.b].some((q) => Math.hypot(q.x - end.x, q.z - end.z) < SAME))) continue;
      const y = terrain(end.x, end.z);
      let top = y;
      for (let s = SLOPE_SAMPLE; s <= SLOPE_REACH + 1e-9; s += SLOPE_SAMPLE) top = Math.max(top, terrain(end.x + dx * s, end.z + dz * s));
      if (top - y > IN_SLOPE) out.push({ at, what: `end at ${y.toFixed(2)}, the terrain up to ${top.toFixed(2)} within ${SLOPE_REACH} m on` });
    }
  }
  return out;
};
