/**
 * The counting part of the A/B timing (`bench.ts`): order of the pairs, the load gate, median and
 * spread, the one-line result and the time of a test from the Vitest JSON report. No clock and no
 * process here: times, loads and the sleep come in, so the tests are fixed numbers.
 */

export type Side = "A" | "B";

/** Order of pair `i`: A first on even pairs, B first on odd ones, so neither side always runs second (warm caches). */
export const pairOrder = (i: number): readonly [Side, Side] => (i % 2 === 0 ? ["A", "B"] : ["B", "A"]);

/** One pair: the time of each side, ms, and the load around it. */
export interface Pair {
  readonly a: number;
  readonly b: number;
  readonly first: Side;
  readonly loadStart: number;
  readonly loadEnd: number;
  /** The gate gave up waiting: the pair ran above the load limit. */
  readonly waitedOut: boolean;
}

/** Linear-interpolated quantile, `q` in 0-1; NaN for no values. */
export const quantile = (values: readonly number[], q: number): number => {
  if (values.length === 0) return Number.NaN;
  const s = [...values].sort((x, y) => x - y);
  const at = (s.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return s[lo]! + (s[hi]! - s[lo]!) * (at - lo);
};

export const median = (values: readonly number[]): number => quantile(values, 0.5);

export interface Summary {
  readonly pairs: number;
  /** Median time of A and of B, ms (a tenth). */
  readonly aMs: number;
  readonly bMs: number;
  /** Median of the per-pair change B / A - 1, %: the result. */
  readonly deltaPct: number;
  /** Spread of the per-pair changes, %. */
  readonly spread: { readonly min: number; readonly p25: number; readonly p75: number; readonly max: number };
  readonly load: { readonly min: number; readonly max: number };
  readonly waitedOut: number;
}

const r1 = (x: number): number => Math.round(x * 10) / 10;

export const summarize = (pairs: readonly Pair[]): Summary => {
  const d = pairs.map((p) => (p.b / p.a - 1) * 100);
  const loads = pairs.flatMap((p) => [p.loadStart, p.loadEnd]);
  return {
    pairs: pairs.length,
    aMs: r1(median(pairs.map((p) => p.a))),
    bMs: r1(median(pairs.map((p) => p.b))),
    deltaPct: r1(median(d)),
    spread: { min: r1(quantile(d, 0)), p25: r1(quantile(d, 0.25)), p75: r1(quantile(d, 0.75)), max: r1(quantile(d, 1)) },
    load: { min: Math.min(...loads), max: Math.max(...loads) },
    waitedOut: pairs.filter((p) => p.waitedOut).length,
  };
};

/** A number the Polish way: decimal comma, a real minus, `+` on request. */
export const pl = (x: number, digits: number, sign = false): string => {
  const s = Math.abs(x).toFixed(digits).replace(".", ",");
  return x < 0 && Number(s.replace(",", ".")) !== 0 ? `−${s}` : sign ? `+${s}` : s;
};

/** A time, ms: whole from 100 ms, with a tenth below (short tests). */
const ms = (x: number): string => (x >= 100 ? String(Math.round(x)) : pl(x, 1));

/** `+3,4% (1234 ms / 1276 ms, 12 par, load 2,1–3,9); rozrzut −1,2…+5,6%`, the line for a report. */
export const oneLine = (s: Summary): string => {
  const over = s.waitedOut > 0 ? `, ${s.waitedOut} par ponad progiem obciążenia` : "";
  return (
    `${pl(s.deltaPct, 1, true)}% (${ms(s.aMs)} ms / ${ms(s.bMs)} ms, ${s.pairs} par, load ${pl(s.load.min, 1)}–${pl(s.load.max, 1)}${over}); ` +
    `rozrzut ${pl(s.spread.min, 1, true)}…${pl(s.spread.max, 1, true)}%, połowa par ${pl(s.spread.p25, 1, true)}…${pl(s.spread.p75, 1, true)}%`
  );
};

/**
 * Waits until the load is under `limit`, reading it every `stepMs`; after `maxWaitMs` gives up
 * (`waitedOut`) and lets the pair run anyway, marked in the result.
 */
export const waitForLoad = async (
  read: () => number,
  sleep: (ms: number) => Promise<void>,
  limit: number,
  maxWaitMs: number,
  stepMs = 15_000,
): Promise<{ readonly load: number; readonly waitedMs: number; readonly waitedOut: boolean }> => {
  let waited = 0;
  for (;;) {
    const load = read();
    if (load < limit) return { load, waitedMs: waited, waitedOut: false };
    if (waited >= maxWaitMs) return { load, waitedMs: waited, waitedOut: true };
    await sleep(stepMs);
    waited += stepMs;
  }
};

interface VitestJson {
  readonly testResults?: readonly { readonly name: string; readonly assertionResults?: readonly { readonly fullName: string; readonly status: string; readonly duration?: number | null }[] }[];
}

/** Duration, ms, of the one passed test whose full name contains `name`, from a Vitest JSON report. */
export const testDuration = (report: VitestJson, name: string): number => {
  const tests = (report.testResults ?? []).flatMap((f) => f.assertionResults ?? []).filter((t) => t.fullName.includes(name));
  if (tests.length !== 1) throw new Error(`${tests.length} tests named like "${name}" in the report (${tests.map((t) => t.fullName).join("; ")}); give a unique part of the name`);
  const [t] = tests as [(typeof tests)[number]];
  if (t.status !== "passed" || typeof t.duration !== "number") throw new Error(`test "${t.fullName}" ${t.status}: no time to measure`);
  return t.duration;
};
