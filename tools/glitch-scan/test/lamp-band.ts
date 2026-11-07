/**
 * `lamp-off-band` (G-477, T-232, T-233): a lamp the generator walked along a line of the plan
 * (`docs/world/lublin-props.todo.json`) standing more than `SLACK` off any paving. The plan's
 * lines are streets' axes and its lamps stand at their kerbs; off the paving one stands on the
 * lawn beside a causeway or in a garden behind a wall. A lamp at a node of the plan (OSM's own
 * street lamps) stands where the map has it and is not counted.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };
type Lamp = { readonly prop: string; readonly x: number; readonly z: number };

/** One group of the plan, as far as the check reads it. */
export interface PlanGroup {
  readonly id: string;
  readonly kind: string;
  readonly spacing?: number;
  readonly line?: readonly number[];
  readonly lines?: readonly (readonly number[])[];
  readonly points?: readonly (readonly [number, number])[];
  readonly position?: Pt;
}

/** The most a lamp of the plan may stand off the paving (m): a kerbside lamp stands 0.5–1 m off the road in Lublin (curator, G-477). */
export const SLACK = 1.0;
/** How far from its group's line a lamp still belongs to it (m): past the widest offset the generator gives. */
export const REACH = 8;
/** A lamp this near a node of the plan is that node's (m). */
export const AT_NODE = 1;
/** The kinds whose lines the generator walks at the kerb; a candelabrum with no spacing lights a path (the castle's stairs). */
const KERB_LAMPS: ReadonlySet<string> = new Set(["lamp-pastoral", "lamp-modern-pole", "lamp-candelabra", "lamp-road"]);
/** Directions the slack is sampled in round a lamp. */
const AROUND = Array.from({ length: 16 }, (_, i) => ({ x: Math.sin((i * Math.PI) / 8), z: Math.cos((i * Math.PI) / 8) }));

const flat = (f: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]!, z: f[i + 1]! });
  return out;
};

export const toLine = (p: Pt, line: readonly Pt[]): number => {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
  }
  return best;
};

const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

const BIN = 16;

/** Whether a point lies on one of `rings` (the paving), over bins of `BIN` m. */
export const pavedAt = (rings: readonly (readonly Pt[])[]): ((p: Pt) => boolean) => {
  const bins = new Map<string, (readonly Pt[])[]>();
  for (const r of rings) {
    if (r.length < 3) continue;
    const xs = r.map((p) => p.x);
    const zs = r.map((p) => p.z);
    for (let i = Math.floor(Math.min(...xs) / BIN); i <= Math.floor(Math.max(...xs) / BIN); i++) {
      for (let j = Math.floor(Math.min(...zs) / BIN); j <= Math.floor(Math.max(...zs) / BIN); j++) {
        const k = `${i}:${j}`;
        const list = bins.get(k);
        if (list) list.push(r);
        else bins.set(k, [r]);
      }
    }
  }
  return (p) => (bins.get(`${Math.floor(p.x / BIN)}:${Math.floor(p.z / BIN)}`) ?? []).some((r) => inRing(p, r));
};

/** The lines of the plan's kerb lamps by kind, and the plan's nodes. */
export const planOf = (groups: readonly PlanGroup[]): { lines: { id: string; prop: string; line: Pt[] }[]; nodes: Pt[] } => ({
  lines: groups
    .filter((g) => KERB_LAMPS.has(g.kind) && (g.kind !== "lamp-candelabra" || g.spacing !== undefined))
    .flatMap((g) => [...(g.line ? [g.line] : []), ...(g.lines ?? [])].map((l) => ({ id: g.id, prop: g.kind, line: flat(l) })).filter((l) => l.line.length >= 2)),
  nodes: groups.flatMap((g) => [...(g.points ?? []).map(([x, z]) => ({ x, z })), ...(g.position ? [g.position] : [])]),
});

/** Every lamp of the plan's lines more than `SLACK` off the paving, with its group and its distance from the line. */
export const lampsOffBand = (lamps: readonly Lamp[], groups: readonly PlanGroup[], paved: (p: Pt) => boolean): Finding[] => {
  const { lines, nodes } = planOf(groups);
  return lamps.flatMap((i) => {
    const own = lines.filter((l) => l.prop === i.prop);
    if (own.length === 0 || nodes.some((n) => Math.hypot(n.x - i.x, n.z - i.z) < AT_NODE)) return [];
    const [d, from] = own.map((l) => [toLine(i, l.line), l.id] as const).reduce((a, b) => (b[0] < a[0] ? b : a));
    if (d > REACH || paved(i) || AROUND.some((u) => paved({ x: i.x + u.x * SLACK, z: i.z + u.z * SLACK }))) return [];
    return [{ at: `${i.x.toFixed(1)},${i.z.toFixed(1)}`, what: `${i.prop} of ${from} ${d.toFixed(1)} m from its line, off the paving` }];
  });
};
