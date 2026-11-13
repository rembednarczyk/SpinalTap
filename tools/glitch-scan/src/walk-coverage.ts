import { SQUARE, gridOf } from "./scan-keys.ts";

/**
 * How much of the six older checks of steps `walk-blocked` covers (ADR-0080, PR 4 and 9): for each
 * of their keys, whether `walk-blocked` has a key in the same 10 m square, or in one of the eight
 * round it (a sample of an edge 0.3 m past a square's side). `walk-coverage-cli.ts` reads the keys.
 */

/** The checks `walk-blocked` is to replace (ADR-0080, point 5). */
export const REPLACED = ["deck-abutment-step", "deck-step-face", "deck-slot", "steps-riser-tall", "flight-underpass", "deck-drawn-over-flight"] as const;

/** A key's 10 m square, `x,z` of its least corner, or null for a key with no place. */
export const squareOf = (kind: string, key: string): string | null => {
  const place = key.split(" ")[1];
  if (key.startsWith("? ") || !place) return null;
  const [x, z] = place.split(",").map(Number) as [number, number];
  if (gridOf(kind) === SQUARE) return `${x},${z}`;
  return `${Math.floor(x / SQUARE) * SQUARE},${Math.floor(z / SQUARE) * SQUARE}`;
};

export type Cover = "square" | "beside" | "none";

/** Whether `walk-blocked`'s keys `walk` hold an old check's key `key` of kind `kind`. */
export const coverOf = (kind: string, key: string, walk: ReadonlySet<string>): Cover => {
  const sq = squareOf(kind, key);
  if (sq === null) return "none";
  if (walk.has(sq)) return "square";
  const [x, z] = sq.split(",").map(Number) as [number, number];
  for (const dx of [-SQUARE, 0, SQUARE]) for (const dz of [-SQUARE, 0, SQUARE]) if (walk.has(`${x + dx},${z + dz}`)) return "beside";
  return "none";
};

/** The report's lines: a line a key of the old checks, then the sums. */
export const coverageLines = (old: ReadonlyMap<string, ReadonlyMap<string, number>>, walkKeys: Iterable<string>): string[] => {
  const walk = new Set([...walkKeys].map((k) => squareOf("walk-blocked", k)).filter((s): s is string => s !== null));
  const lines: string[] = [];
  const sums = { square: 0, beside: 0, none: 0 };
  for (const kind of REPLACED) {
    const keys = [...(old.get(kind)?.keys() ?? [])];
    lines.push(`${kind}: ${keys.length} key(s)`);
    for (const k of keys) {
      const c = coverOf(kind, k, walk);
      sums[c]++;
      lines.push(`  ${c === "none" ? "NOT COVERED" : c === "square" ? "covered" : "covered beside"} ${k}`);
    }
  }
  lines.push(`walk-blocked ${walk.size} square(s); old keys ${sums.square + sums.beside + sums.none}: ${sums.square} in the same square, ${sums.beside} beside, ${sums.none} not covered`);
  return lines;
};
