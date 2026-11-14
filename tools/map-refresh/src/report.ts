import { THRESHOLDS, type Thresholds } from "./config.ts";
import type { FileTable } from "./files.ts";
import type { ScanDiff } from "./scan.ts";
import type { TableStats } from "./table-stats.ts";

/**
 * The refresh's report as data (pure): two states of the map, before and after, and what the
 * checks found, into the differences and the verdict. Nothing in it depends on the clock or the
 * machine, so two runs on the same data give the same report.
 */

/** One state of the map: its files, its tables' counts, the widths' sources of `osm:build --stats`. */
export interface MapState {
  readonly files: FileTable;
  readonly stats: TableStats;
  readonly widths: WidthStats | null;
}

/** m of street side by the carriageway width's source (ADR-0080): streets, and with service ways. */
export interface WidthStats {
  readonly streets: Record<string, number>;
  readonly all: Record<string, number>;
}

/** A golden test whose assertion fails after the refresh (`pnpm hashes:check`). */
export interface HashRow {
  readonly file: string;
  readonly test: string;
  /** `same-numbers`, `bare` (only hashes moved), `numbers-changed`, `not-a-hash`. */
  readonly verdict: string;
  readonly hashes: readonly string[];
  readonly numbersChanged: readonly string[];
}

/** orto:diff's numbers of the change (ADR-0077), when it ran. */
export interface OrtoSummary {
  readonly changedM2: number;
  readonly addedM2ByCell: Record<string, number>;
  readonly terrainMaxAbs: number;
  readonly decksChanged: number;
}

export interface StepLine {
  readonly id: string;
  readonly status: "ran" | "failed" | "skipped";
  readonly note: string;
}

export interface Change<T> {
  readonly before: T;
  readonly after: T;
}

export interface Report {
  readonly base: string;
  readonly mode: { readonly offline: boolean; readonly sources: readonly string[] };
  readonly steps: readonly StepLine[];
  readonly files: readonly { readonly path: string; readonly before: number | null; readonly after: number | null }[];
  /** Files given back their old text (only download dates differed). */
  readonly restored: readonly string[];
  readonly objects: Record<string, Change<number>>;
  readonly objectsTotal: Change<number>;
  readonly surfaces: Record<string, Change<number>>;
  /** Σ |Δ m²| over the surfaces. */
  readonly surfaceMovedM2: number;
  readonly surfaceByChunk: Record<string, number>;
  readonly scan: ScanDiff;
  readonly hashes: { readonly ran: boolean; readonly rows: readonly HashRow[] };
  readonly widths: Change<WidthStats | null>;
  readonly orto: OrtoSummary | null;
  readonly verdict: Verdict;
}

export interface Verdict {
  readonly review: boolean;
  /** What is over a threshold, one line each. */
  readonly reasons: readonly string[];
  /** Where to look: scan keys, chunks, cells, kinds. */
  readonly places: readonly string[];
  readonly thresholds: Thresholds;
}

export interface ReportInput {
  readonly base: string;
  readonly mode: Report["mode"];
  readonly steps: readonly StepLine[];
  readonly before: MapState;
  readonly after: MapState;
  readonly restored: readonly string[];
  readonly scan: ScanDiff;
  readonly hashes: { readonly ran: boolean; readonly rows: readonly HashRow[] };
  readonly orto: OrtoSummary | null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const keysOf = (...ms: readonly Record<string, unknown>[]) => [...new Set(ms.flatMap((m) => Object.keys(m)))].sort();
const total = (m: Record<string, number>) => Object.values(m).reduce((a, b) => a + b, 0);

/** The files that differ, with their sizes (null where absent). */
export const fileChanges = (a: FileTable, b: FileTable): Report["files"] =>
  keysOf(a, b)
    .filter((p) => a[p]?.sha256 !== b[p]?.sha256)
    .map((p) => ({ path: p, before: a[p]?.bytes ?? null, after: b[p]?.bytes ?? null }));

/** Each key's before and after, only those that differ. */
export const changes = (a: Record<string, number>, b: Record<string, number>): Record<string, Change<number>> =>
  Object.fromEntries(
    keysOf(a, b)
      .filter((k) => (a[k] ?? 0) !== (b[k] ?? 0))
      .map((k) => [k, { before: a[k] ?? 0, after: b[k] ?? 0 }]),
  );

/** m² moved by chunk: Σ |Δ| over its surfaces, only the chunks with a change. */
const movedByChunk = (a: TableStats, b: TableStats): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const c of keysOf(a.surfaceByChunk, b.surfaceByChunk)) {
    const [sa, sb] = [a.surfaceByChunk[c] ?? {}, b.surfaceByChunk[c] ?? {}];
    const moved = r1(keysOf(sa, sb).reduce((s, k) => s + Math.abs((sb[k] ?? 0) - (sa[k] ?? 0)), 0));
    if (moved > 0) out[c] = moved;
  }
  return out;
};

/** What is over the thresholds, and where (pure). */
export const verdictOf = (r: Omit<Report, "verdict">, t: Thresholds = THRESHOLDS): Verdict => {
  const reasons: string[] = [];
  const places: string[] = [];
  const failed = r.steps.filter((s) => s.status === "failed");
  if (failed.length) reasons.push(`kroki nieudane: ${failed.map((s) => s.id).join(", ")}`);
  if (!r.scan.ran) reasons.push("skan glitchy nie przebiegł");
  const serious = r.scan.kinds.filter((k) => k.severity === "S1-S3" && k.added.length > 0);
  if (serious.length) reasons.push(`nowe klucze skanu S1–S3: ${serious.map((k) => `${k.kind} +${k.added.length}`).join(", ")}`);
  places.push(...serious.flatMap((k) => k.added));
  const { before, after } = r.objectsTotal;
  const share = before > 0 ? Math.abs(after - before) / before : after > 0 ? 1 : 0;
  if (share >= t.objectsShare) reasons.push(`obiekty razem: ${before} -> ${after} (${(share * 100).toFixed(1)}%, próg ${t.objectsShare * 100}%)`);
  for (const [k, c] of Object.entries(r.objects)) {
    if (Math.abs(c.after - c.before) > Math.max(t.kindShare * c.before, t.kindMin)) {
      reasons.push(`rodzaj ${k}: ${c.before} -> ${c.after}`);
      places.push(`rodzaj ${k}`);
    }
  }
  if (r.surfaceMovedM2 >= t.surfaceM2) {
    reasons.push(`nawierzchnia w tablicach: przesunięte ${r.surfaceMovedM2} m² (próg ${t.surfaceM2} m²)`);
    places.push(...Object.entries(r.surfaceByChunk).map(([c, m]) => `kawałek ${c}: ${m} m² nawierzchni`));
  }
  if (r.orto && r.orto.changedM2 >= t.surfaceM2) {
    reasons.push(`orto:diff: zmienione ${r.orto.changedM2} m² nawierzchni`);
    places.push(...Object.entries(r.orto.addedM2ByCell).filter(([, m]) => m > 0).map(([c, m]) => `komórka ${c}: +${m} m² (orto:diff)`));
  }
  if (r.orto && r.orto.terrainMaxAbs > t.terrainM) reasons.push(`teren: największe przesunięcie ${r.orto.terrainMaxAbs} m (próg ${t.terrainM} m)`);
  if (r.orto && r.orto.decksChanged > 0) reasons.push(`pomosty: zmienione ${r.orto.decksChanged}`);
  const counted = r.hashes.rows.filter((h) => h.verdict === "numbers-changed" || h.verdict === "not-a-hash");
  if (counted.length) reasons.push(`testy złote z innymi liczbami niż sam skrót: ${counted.map((h) => `${h.file} (${h.test})`).join(", ")}`);
  return { review: reasons.length > 0, reasons, places: [...new Set(places)], thresholds: t };
};

/** The report of a refresh from its two states and the checks' results (pure). */
export const buildReport = (i: ReportInput): Report => {
  const [a, b] = [i.before.stats, i.after.stats];
  const surfaces = Object.fromEntries(Object.entries(changes(a.surfaces, b.surfaces)).map(([k, c]) => [k, { before: c.before, after: c.after }]));
  const partial: Omit<Report, "verdict"> = {
    base: i.base,
    mode: i.mode,
    steps: i.steps,
    files: fileChanges(i.before.files, i.after.files),
    restored: [...i.restored].sort(),
    objects: changes(a.objects, b.objects),
    objectsTotal: { before: r1(total(a.objects)), after: r1(total(b.objects)) },
    surfaces,
    surfaceMovedM2: r1(Object.values(surfaces).reduce((s, c) => s + Math.abs(c.after - c.before), 0)),
    surfaceByChunk: movedByChunk(a, b),
    scan: i.scan,
    hashes: i.hashes,
    widths: { before: i.before.widths, after: i.after.widths },
    orto: i.orto,
  };
  return { ...partial, verdict: verdictOf(partial) };
};
