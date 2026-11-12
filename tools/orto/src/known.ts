/**
 * Section 5 of the cell report: the known kinds. The glitch scan's hits in the cell (10 m squares
 * a kind, `reports/map-coverage-hits.json`, written by `glitch-scan.test.ts`) with the glitches and
 * T rows the registers point to: a clause of the cell's note or reviews in `docs/mapa-pokrycie.json`
 * naming the kind (up to the next `,`, `;` or `.`), the cell's T rows (`wierszeT`) whose row in
 * `docs/topografia.md` names it, and the entries of `docs/glitches.md` naming the kind in backticks
 * together with the cell. A kind with none is new to the registers.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "./config.ts";

export interface KnownKind {
  readonly kind: string;
  readonly hits: number;
  readonly refs: readonly string[];
}

export interface KnownSection {
  /** Why the section is empty, when it is. */
  readonly missing?: string;
  readonly findings: number;
  readonly kinds: readonly KnownKind[];
  readonly verdict: string;
}

export interface CellHitsLike {
  readonly findings: number;
  readonly kinds: Readonly<Record<string, number>>;
}

const REF = /\b[GT]-\d{3}\b/g;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The kind as a whole word: `kerb-strip` is not `kerb-strip-bare`. */
const word = (kind: string, flags = "") => new RegExp(`(?<![\\w-])${escape(kind)}(?![\\w-])`, flags);

/** The G and T ids in the clauses of `text` that name `kind`. */
export const refsInText = (text: string, kind: string): string[] => {
  const out: string[] = [];
  const re = word(kind, "g");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const rest = text.slice(m.index, m.index + 240);
    const end = rest.search(/[;,]|\.(\s|$)/);
    out.push(...[...(end >= 0 ? rest.slice(0, end) : rest).matchAll(REF)].map((r) => r[0]));
  }
  return out;
};

/** The glitches of `docs/glitches.md` naming the kind in backticks and the cell. */
export const glitchesNaming = (md: string, kind: string, cell: string): string[] =>
  md
    .split(/^### /m)
    .filter((e) => /^G-\d{3}/.test(e) && e.includes(`\`${kind}\``) && e.includes(cell))
    .map((e) => e.slice(0, 5));

/** The T rows among `rows` (id → the row's text) that name the kind. */
export const rowsNaming = (rows: Readonly<Record<string, string>>, kind: string): string[] =>
  Object.entries(rows)
    .filter(([, text]) => word(kind).test(text))
    .map(([id]) => id);

export const knownSection = (cell: string, hits: CellHitsLike | undefined, register: string, glitches: string, rows: Readonly<Record<string, string>> = {}): KnownSection => {
  if (!hits) return { missing: "brak reports/map-coverage-hits.json: puść `pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts`", findings: 0, kinds: [], verdict: "trafień skanu nie sprawdzono" };
  const kinds = Object.entries(hits.kinds)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, n]) => ({ kind, hits: n, refs: [...new Set([...refsInText(register, kind), ...rowsNaming(rows, kind), ...glitchesNaming(glitches, kind, cell)])].sort() }));
  const bare = kinds.filter((k) => !k.refs.length);
  return {
    findings: hits.findings,
    kinds,
    verdict: bare.length ? `rodzaje bez odsyłacza w rejestrach: ${bare.map((k) => k.kind).join(", ")}; sprawdź, czy są nowe` : "każdy rodzaj trafień ma odsyłacz w rejestrach",
  };
};

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** The section from the files in the repository (the scan's hits, the coverage register, the glitch register). */
export const loadKnown = (cell: string, repo = REPO): KnownSection => {
  const hitsFile = read(join(repo, "reports/map-coverage-hits.json"));
  const hits = hitsFile ? (JSON.parse(hitsFile) as { cells: Record<string, CellHitsLike> }).cells[cell] : undefined;
  const reg = read(join(repo, "docs/mapa-pokrycie.json"));
  type Entry = { id: string; notatka?: string; przeglady?: string[]; wierszeT?: { otwarte?: string[]; rozwiazane?: string[] } };
  const entry = reg ? (JSON.parse(reg) as { komorki: Entry[] }).komorki.find((c) => c.id === cell) : undefined;
  const register = entry ? [entry.notatka ?? "", ...(entry.przeglady ?? [])].join("\n") : "";
  const ids = new Set([...(entry?.wierszeT?.otwarte ?? []), ...(entry?.wierszeT?.rozwiazane ?? [])]);
  const rows: Record<string, string> = {};
  for (const line of (read(join(repo, "docs/topografia.md")) ?? "").split("\n")) {
    const id = /^\| (T-\d{3}) \|/.exec(line)?.[1];
    if (id && ids.has(id)) rows[id] = line;
  }
  return knownSection(cell, hitsFile ? (hits ?? { findings: 0, kinds: {} }) : undefined, register, read(join(repo, "docs/glitches.md")) ?? "", rows);
};

export const knownText = (s: KnownSection): string[] => [
  "-- znane rodzaje (trafienia skanu w komórce, kwadraty 10 m)",
  ...(s.missing ? [s.missing] : [`znalezisk ${s.findings}; ${s.kinds.map((k) => `${k.kind} ${k.hits}${k.refs.length ? ` (${k.refs.join(", ")})` : " (bez odsyłacza)"}`).join("; ") || "brak trafień"}`]),
  `werdykt: ${s.verdict}`,
];
