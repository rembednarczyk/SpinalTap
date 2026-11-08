/**
 * `lamp-beside-deck` (G-503, T-239): a lamp the generator walked along a line of the plan whose
 * axis runs over a bridge's deck there (Zamkowa's viaduct, its causeway's span), standing under
 * the deck or within `NEAR` of it and `DROP` or more under it: down on the valley's ground by the
 * deck's edge, its lantern among the deck's walkers or in its slab. In Lublin those lamps stand
 * on the deck by its parapets. A lamp at a node of the plan (OSM's own) is not counted.
 */
import { AT_NODE, type PlanGroup, REACH, planOf, toLine } from "./lamp-band";

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };
type Lamp = { readonly prop: string; readonly x: number; readonly y: number; readonly z: number };

/** How far from a deck's edge a lamp still stands beside it (m). */
export const NEAR = 2;
/**
 * How far under the deck a lamp's foot may stand (m): an abutment's bank. 1.85 m under Zamkowa's the
 * pastoral's lantern hung 1.55 m over the paving, among its walkers (G-507).
 */
export const DROP = 1.5;
/** Directions and radii the deck is looked for at round a lamp. */
const AROUND = Array.from({ length: 16 }, (_, i) => ({ x: Math.sin((i * Math.PI) / 8), z: Math.cos((i * Math.PI) / 8) }));
const RADII = [0.5, 1, 1.5, NEAR];

/** The point of a line nearest p. */
const footOn = (p: Pt, line: readonly Pt[]): Pt => {
  let best = { d: Number.POSITIVE_INFINITY, q: line[0]! };
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    const q = { x: a.x + dx * t, z: a.z + dz * t };
    const d = Math.hypot(p.x - q.x, p.z - q.z);
    if (d < best.d) best = { d, q };
  }
  return best.q;
};

/**
 * Every lamp of the plan's lines over a deck standing beside it or under it, `DROP` or more lower
 * than it; `deck` is the highest deck's height at a point, null off every deck.
 */
export const lampsBesideDeck = (lamps: readonly Lamp[], groups: readonly PlanGroup[], deck: (x: number, z: number) => number | null): Finding[] => {
  const { lines, nodes } = planOf(groups);
  return lamps.flatMap((i) => {
    const own = lines.filter((l) => l.prop === i.prop);
    if (own.length === 0 || nodes.some((n) => Math.hypot(n.x - i.x, n.z - i.z) < AT_NODE)) return [];
    const [d, line, from] = own.map((l) => [toLine(i, l.line), l.line, l.id] as const).reduce((a, b) => (b[0] < a[0] ? b : a));
    const axis = footOn(i, line);
    if (d > REACH || deck(axis.x, axis.z) === null) return [];
    const tops = [deck(i.x, i.z), ...RADII.flatMap((r) => AROUND.map((u) => deck(i.x + u.x * r, i.z + u.z * r)))].filter((y): y is number => y !== null);
    if (tops.length === 0 || Math.max(...tops) - i.y < DROP) return [];
    return [{ at: `${i.x.toFixed(1)},${i.z.toFixed(1)}`, what: `${i.prop} of ${from} ${(Math.max(...tops) - i.y).toFixed(2)} m under the deck beside it` }];
  });
};
