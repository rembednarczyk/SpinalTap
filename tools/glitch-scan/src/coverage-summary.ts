import { COVERAGE_STATUSES, type CoverageCell, type CoverageRegister, type CoverageStatus, type HitsPerCell } from "./map-coverage.ts";

/**
 * The coverage's numbers (`docs/mapa-pokrycie.md`): the share of cells in each status for the
 * whole city and each district, and the map steward's queue.
 */

export type StatusShares = Readonly<Record<CoverageStatus, number>>;

export interface QueuedCell {
  readonly id: string;
  readonly dzielnica: string;
  readonly status: CoverageStatus;
  readonly hits: number;
  readonly findings: number;
  /** The kinds with most hits in the cell, most first. */
  readonly top: readonly { readonly kind: string; readonly hits: number }[];
  readonly open: number;
}

export interface CoverageSummary {
  readonly cells: number;
  readonly city: StatusShares;
  readonly districts: Readonly<Record<string, StatusShares>>;
  /** Percent of cells with a fixed T row, for the city (`miasto`) and each district: history, not a status. */
  readonly withFixes: Readonly<Record<string, number>>;
  readonly queue: readonly QueuedCell[];
  readonly outside: number;
  readonly unplaced: number;
}

/** Percent of `statuses` in each status, to 0.1. */
const shares = (statuses: readonly CoverageStatus[]): StatusShares =>
  Object.fromEntries(COVERAGE_STATUSES.map((s) => [s, statuses.length === 0 ? 0 : Math.round((1000 * statuses.filter((x) => x === s).length) / statuses.length) / 10])) as Record<
    CoverageStatus,
    number
  >;

/**
 * The queue: cells not yet `czyste`, the least reviewed first, then the most hits, then the most
 * T rows open; at most `size`.
 */
export const coverageSummary = (register: CoverageRegister, hits: HitsPerCell, size = 10): CoverageSummary => {
  const cells = register.komorki;
  const districts: Record<string, StatusShares> = {};
  const fixed = (of: readonly CoverageCell[]) => (of.length === 0 ? 0 : Math.round((1000 * of.filter((c) => c.wierszeT.rozwiazane.length > 0).length) / of.length) / 10);
  const withFixes: Record<string, number> = { miasto: fixed(cells) };
  for (const d of [...new Set(cells.map((c) => c.dzielnica))]) {
    const of = cells.filter((c) => c.dzielnica === d);
    districts[d] = shares(of.map((c) => c.status));
    withFixes[d] = fixed(of);
  }
  const rank = (s: CoverageStatus) => COVERAGE_STATUSES.indexOf(s);
  const queue = cells
    .filter((c) => c.status !== "czyste")
    .map((c): QueuedCell => {
      const h = hits.cells[c.id];
      const top = Object.entries(h?.kinds ?? {})
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 3)
        .map(([kind, n]) => ({ kind, hits: n }));
      return { id: c.id, dzielnica: c.dzielnica, status: c.status, hits: h?.hits ?? 0, findings: h?.findings ?? 0, top, open: c.wierszeT.otwarte.length };
    })
    .sort((a, b) => rank(a.status) - rank(b.status) || b.hits - a.hits || b.open - a.open || a.id.localeCompare(b.id))
    .slice(0, size);
  return { cells: cells.length, city: shares(cells.map((c) => c.status)), districts, withFixes, queue, outside: hits.outside, unplaced: hits.unplaced };
};

const row = (name: string, s: StatusShares, fixes: number) => `| ${name} | ${COVERAGE_STATUSES.map((k) => `${s[k].toFixed(1)}%`).join(" | ")} | ${fixes.toFixed(1)}% |`;

/** The summary as Markdown, for the console and the steward's report. */
export const formatSummary = (s: CoverageSummary): string =>
  [
    `# Pokrycie przeglądów mapy (${s.cells} komórek)`,
    "",
    `| obszar | ${COVERAGE_STATUSES.join(" | ")} | z poprawionym wierszem T |`,
    `|---|${COVERAGE_STATUSES.map(() => "---").join("|")}|---|`,
    row("miasto", s.city, s.withFixes.miasto ?? 0),
    ...Object.entries(s.districts).map(([d, v]) => row(d, v, s.withFixes[d] ?? 0)),
    "",
    "## Kolejka opiekuna mapy",
    "",
    "| # | komórka | status | trafienia (10 m) | znaleziska | otwarte T | najczęstsze rodzaje |",
    "|---|---|---|---|---|---|---|",
    ...s.queue.map((q, k) => `| ${k + 1} | ${q.id} | ${q.status} | ${q.hits} | ${q.findings} | ${q.open} | ${q.top.map((t) => `${t.kind} ${t.hits}`).join(", ")} |`),
    "",
    `Poza komórkami: ${s.outside} znalezisk, bez miejsca: ${s.unplaced}.`,
  ].join("\n");
