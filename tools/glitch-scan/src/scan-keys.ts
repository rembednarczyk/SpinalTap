import { type CellBounds, type Finding, cellAt } from "./map-coverage.ts";

/**
 * The glitch scan's base by place (decision of 13.11): every finding of a kind gets a key, the
 * chunk it is in and its place on a grid chosen for the kind, and the base is the list of known
 * keys. A new key fails the scan even when the kind's sum comes down; a fix only removes keys.
 * Pure functions: the findings and the chunks come in, keys, diffs and the base's text come out.
 *
 * The grids:
 * - 1 m (`Math.round` of x and z) for the kinds that find one thing (a piece, a building, a lane's
 *   end, a pad): the key stays as long as the thing does not move by half a metre, and two
 *   findings on one metre (two lanes ending at one point) are one key counted twice: the base
 *   keeps the count, and a key found more often than its base also fails.
 * - A 10 m square (the corner at its least x and z, as `HIT_SQUARE` of the coverage register) for
 *   the kinds that sample a line or an area every metre or less (`SAMPLED_KINDS`): a fix that moves
 *   a strip by a few centimetres shifts every sample but not the squares, and the base holds
 *   thousands of squares instead of a hundred thousand samples. The square is the key, not counted:
 *   its samples come and go with any small shift. The chunks' bounds lie on the 10 m grid, so a
 *   square is in one chunk.
 * - A finding with no `x,z` in its `at` (a model's fault, a building missing from the map) is
 *   keyed by its `at` text, or its `what` when `at` is only a mark (`?`, `-`).
 */

/** The side of a sampled kind's square (m). */
export const SQUARE = 10;

/** The kinds that sample a line or an area every metre or less: keyed by their 10 m square. */
export const SAMPLED_KINDS: ReadonlySet<string> = new Set([
  "car-lane-off-road",
  "lane-off-ground",
  "lane-in-building",
  "sidewalk-under-carriageway",
  "footway-on-carriageway",
  "kerb-strip-bare",
  "city-wall-kept",
  "landuse-bare",
  "bare-on-cover",
  "fill-on-green",
  "kerb-gap-bare",
  "kerb-fill-wide-estimated",
  "ground-strip-overlap",
  "ground-strip-gap",
  "ground-over-deck",
  "deck-slot",
  "deck-step-face",
  "deck-abutment-step",
  "deck-kerb-step",
  "walk-blocked",
  "metro-exit-bare",
  "metro-shaft-ray",
]);

/** The grid of a kind's keys (m). */
export const gridOf = (kind: string): number => (SAMPLED_KINDS.has(kind) ? SQUARE : 1);

/** The chunk's id in a key for a place in none of them. */
export const OFF_MAP = "poza";

const PLACE = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;

/**
 * The place of a finding: its `at` when that is `x,z`, else the last `x,z` in it (a patrol
 * lane's `lane from 1,2 at 3.4,5.6 y 7`, a paving pair's `road and sidewalk at 3.4,5.6`).
 */
export const placeOf = (at: string): { x: number; z: number } | null => {
  const all = [...at.matchAll(PLACE)];
  const m = all[all.length - 1];
  return m ? { x: Number(m[1]), z: Number(m[2]) } : null;
};

const num = (v: number) => (Object.is(v, -0) ? 0 : v);

/** A finding's key in its kind: `chunk x,z` on the kind's grid, or `? text` with no place. */
export const keyOf = (kind: string, f: Finding, cells: readonly { readonly id: string; readonly bounds: CellBounds }[]): string => {
  const p = placeOf(f.at);
  if (!p) return `? ${f.at === "?" || f.at === "-" || f.at === "" ? f.what : f.at}`;
  const g = gridOf(kind);
  const [x, z] = g === 1 ? [num(Math.round(p.x)), num(Math.round(p.z))] : [num(Math.floor(p.x / g) * g), num(Math.floor(p.z / g) * g)];
  const chunk = cellAt(cells, x + (g === 1 ? 0 : g / 2), z + (g === 1 ? 0 : g / 2)) ?? OFF_MAP;
  return `${chunk} ${x},${z}`;
};

/** A key as found: how many findings it holds (1 for a sampled kind's square) and the first one's `what`. */
export interface FoundKey {
  readonly n: number;
  readonly samples: number;
  readonly what: string;
}

/** A kind's findings by key. */
export const keysOf = (kind: string, findings: readonly Finding[], cells: readonly { readonly id: string; readonly bounds: CellBounds }[]): Map<string, FoundKey> => {
  const out = new Map<string, FoundKey>();
  const counted = !SAMPLED_KINDS.has(kind);
  for (const f of findings) {
    const k = keyOf(kind, f, cells);
    const was = out.get(k);
    out.set(k, was ? { n: counted ? was.n + 1 : 1, samples: was.samples + 1, what: was.what } : { n: 1, samples: 1, what: f.what });
  }
  return out;
};

/** A kind's base: its known keys with how many findings each holds. */
export type KindBase = ReadonlyMap<string, number>;

export interface KindDiff {
  readonly kind: string;
  /** Keys not in the base: a new glitch's place. Fails. */
  readonly added: readonly { readonly key: string; readonly n: number; readonly what: string }[];
  /** Known keys found more often than the base holds (1 m kinds only). Fails. */
  readonly grown: readonly { readonly key: string; readonly was: number; readonly now: number; readonly what: string }[];
  /** Known keys found less often or not at all: a fix, for `GLITCH_BASELINE=update`. */
  readonly removed: readonly { readonly key: string; readonly was: number; readonly now: number }[];
  /** The base's sum and the found keys' sum. */
  readonly before: number;
  readonly after: number;
}

const sum = (m: ReadonlyMap<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);

/** A kind's found keys against its base. */
export const diffKind = (kind: string, base: KindBase, found: ReadonlyMap<string, FoundKey>): KindDiff => {
  const added: KindDiff["added"][number][] = [];
  const grown: KindDiff["grown"][number][] = [];
  const removed: KindDiff["removed"][number][] = [];
  for (const [key, f] of found) {
    const was = base.get(key);
    if (was === undefined) added.push({ key, n: f.n, what: f.what });
    else if (f.n > was) grown.push({ key, was, now: f.n, what: f.what });
  }
  for (const [key, was] of base) {
    const now = found.get(key)?.n ?? 0;
    if (now < was) removed.push({ key, was, now });
  }
  return { kind, added, grown, removed, before: sum(base), after: sum(new Map([...found].map(([k, f]) => [k, f.n]))) };
};

/** Does the diff fail the scan: a new key, or a known one found more often? */
export const fails = (d: KindDiff): boolean => d.added.length > 0 || d.grown.length > 0;

/** `GLITCH_BASELINE=update`: the base with the keys gone and the counts come down, nothing added. */
export const pruned = (base: KindBase, found: ReadonlyMap<string, FoundKey>): Map<string, number> => {
  const out = new Map<string, number>();
  for (const [key, was] of base) {
    const now = found.get(key)?.n ?? 0;
    if (now > 0) out.set(key, Math.min(was, now));
  }
  return out;
};

/** `GLITCH_BASELINE=accept`: the base as found, the new keys taken in. */
export const accepted = (found: ReadonlyMap<string, FoundKey>): Map<string, number> => new Map([...found].map(([k, f]) => [k, f.n]));

/** A key's place for sorting: chunk, then z, then x; the unplaced last. */
const order = (a: string, b: string) => {
  const pa = a.split(" ");
  const pb = b.split(" ");
  if ((pa[0] === "?") !== (pb[0] === "?")) return pa[0] === "?" ? 1 : -1;
  if (pa[0] !== pb[0] || pa[0] === "?") return a < b ? -1 : a > b ? 1 : 0;
  const [ax, az] = pa[1]!.split(",").map(Number);
  const [bx, bz] = pb[1]!.split(",").map(Number);
  return az! - bz! || ax! - bx!;
};

/** The header of a kind's base file: its kind and grid, checked on reading. */
const header = (kind: string) =>
  `# ${kind}: ${gridOf(kind) === 1 ? "grid 1 m (x,z rounded); a count after the place is how many findings hold it" : `grid ${SQUARE} m (x,z = the square's corner at its least x and z)`}`;

/** A kind's base as its file's text: the header, then one key a line, with ` *n` when it holds more than one finding. */
export const formatKind = (kind: string, base: KindBase): string => {
  const lines = [...base.keys()].sort(order).map((k) => (base.get(k)! > 1 ? `${k} *${base.get(k)}` : k));
  return `${[header(kind), ...lines].join("\n")}\n`;
};

/** A kind's base read from its file's text; throws when its header is not the kind's (a grid changed). */
export const parseKind = (kind: string, text: string): Map<string, number> => {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines[0] !== header(kind)) throw new Error(`${kind}: the base's header ${JSON.stringify(lines[0])} is not ${JSON.stringify(header(kind))} (its grid changed: GLITCH_BASELINE=accept)`);
  const out = new Map<string, number>();
  for (const l of lines.slice(1)) {
    const m = / \*(\d+)$/.exec(l);
    out.set(m ? l.slice(0, m.index) : l, m ? Number(m[1]) : 1);
  }
  return out;
};

/** A key with its kind for a reader: `kind chunk x,z` and, on a square, its extent. */
export const describeKey = (kind: string, key: string): string => {
  const [chunk, place] = key.split(" ");
  if (chunk === "?" || !place || gridOf(kind) === 1) return `${kind} ${key}`;
  const [x, z] = place.split(",").map(Number);
  return `${kind} ${chunk} ${x}..${x! + SQUARE},${z}..${z! + SQUARE}`;
};

const what = (w: string) => (w ? `: ${w}` : "");

/** The diff's lines for a reader: what came, what grew, what went, the sums. Empty when nothing changed. */
export const formatDiff = (d: KindDiff, most = 20): string[] => {
  if (d.added.length + d.grown.length + d.removed.length === 0) return [];
  const cut = <T>(list: readonly T[], line: (t: T) => string) => [...list.slice(0, most).map(line), ...(list.length > most ? [`    … and ${list.length - most} more`] : [])];
  return [
    `${d.kind}: sum ${d.before} -> ${d.after}, +${d.added.length} new key(s), ${d.grown.length} grown, -${d.removed.length} gone or fewer`,
    ...cut(d.added, (a) => `  + ${describeKey(d.kind, a.key)}${a.n > 1 ? ` *${a.n}` : ""}${what(a.what)}`),
    ...cut(d.grown, (g) => `  ^ ${describeKey(d.kind, g.key)} ${g.was} -> ${g.now}${what(g.what)}`),
    ...cut(d.removed, (r) => `  - ${describeKey(d.kind, r.key)}${r.now > 0 ? ` ${r.was} -> ${r.now}` : ""}`),
  ];
};
