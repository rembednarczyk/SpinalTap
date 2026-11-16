/**
 * The values of a failed golden assertion (`check.ts`): what Vitest printed as expected and actual,
 * taken apart into hashes (8 hex digits, alone or after a count, as `"6 408ae390"`), numbers and
 * the rest, and the rewrite of a test file's old hashes to new ones. Pure functions.
 */

export const HEX = /^[0-9a-f]{8}$/;
const COUNTED = /^(-?\d+(?:\.\d+)?) ([0-9a-f]{8})$/;

export interface Parts {
  /** Path (`key`, `key.sub`, `` for the value itself) to a hash. */
  readonly hashes: Record<string, string>;
  readonly numbers: Record<string, number>;
  readonly other: Record<string, string>;
}

/** The value as Vitest serialised it: JSON-like with trailing commas, a string bare or quoted. */
export const parseValue = (text: string): unknown => {
  const t = text.trim();
  try {
    return JSON.parse(t.replace(/,(\s*[}\]])/g, "$1"));
  } catch {
    return t;
  }
};

export const partsOf = (value: unknown): Parts => {
  const parts = { hashes: {} as Record<string, string>, numbers: {} as Record<string, number>, other: {} as Record<string, string> };
  const walk = (v: unknown, path: string) => {
    if (typeof v === "number") parts.numbers[path] = v;
    else if (typeof v === "string") {
      const m = COUNTED.exec(v);
      if (HEX.test(v)) parts.hashes[path] = v;
      else if (m) {
        parts.numbers[path] = Number(m[1]);
        parts.hashes[path] = m[2]!;
      } else parts.other[path] = v;
    } else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    else parts.other[path] = String(v);
  };
  walk(value, "");
  return parts;
};

export type Verdict = "same-numbers" | "bare" | "numbers-changed" | "not-a-hash";

export interface HashChange {
  readonly path: string;
  readonly old: string;
  readonly new: string;
}

export interface Comparison {
  readonly verdict: Verdict;
  readonly hashes: readonly HashChange[];
  /** The numbers on both sides, and those that differ (a count in only one is a difference). */
  readonly numbers: Record<string, { readonly expected: number | null; readonly actual: number | null }>;
  readonly numbersChanged: readonly string[];
  readonly otherChanged: readonly string[];
}

/**
 * Expected against actual: `same-numbers` when only hashes differ and the assertion has numbers,
 * all equal; `bare` when only hashes differ and it has none; `numbers-changed` when a number or
 * the set of keys differs; `not-a-hash` when no hash differs, or something other than one does.
 */
export const compare = (expected: string, actual: string): Comparison => {
  const [e, a] = [partsOf(parseValue(expected)), partsOf(parseValue(actual))];
  const keys = (x: Record<string, unknown>, y: Record<string, unknown>) => [...new Set([...Object.keys(x), ...Object.keys(y)])].sort();
  const hashes = keys(e.hashes, a.hashes)
    .filter((k) => e.hashes[k] !== a.hashes[k])
    .map((k) => ({ path: k, old: e.hashes[k] ?? "", new: a.hashes[k] ?? "" }));
  const numbers = Object.fromEntries(keys(e.numbers, a.numbers).map((k) => [k, { expected: e.numbers[k] ?? null, actual: a.numbers[k] ?? null }]));
  const numbersChanged = Object.entries(numbers).filter(([, v]) => v.expected !== v.actual).map(([k]) => k);
  const otherChanged = keys(e.other, a.other).filter((k) => e.other[k] !== a.other[k]);
  const lost = hashes.some((h) => !h.old || !h.new);
  const verdict: Verdict =
    !hashes.length || otherChanged.length ? "not-a-hash" : numbersChanged.length || lost ? "numbers-changed" : Object.keys(numbers).length ? "same-numbers" : "bare";
  return { verdict, hashes, numbers, numbersChanged, otherChanged };
};

const count = (s: string, sub: string) => s.split(sub).length - 1;

/**
 * The test file's source with `old` replaced by `new`: on line `line` (1-based) when it holds the
 * old hash once, else where the file holds it once; null when neither (the place is not certain).
 */
export const rewriteHash = (source: string, line: number | null, change: HashChange): string | null => {
  const lines = source.split("\n");
  if (line !== null && line >= 1 && line <= lines.length && count(lines[line - 1]!, change.old) === 1) {
    lines[line - 1] = lines[line - 1]!.replace(change.old, change.new);
    return lines.join("\n");
  }
  return count(source, change.old) === 1 ? source.replace(change.old, change.new) : null;
};

/** The copy of a golden test that `check.ts` runs: every assertion soft, so one run shows them all. */
export const softCopy = (source: string): string => source.replace(/\bexpect\(/g, "expect.soft(");
