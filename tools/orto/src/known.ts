/**
 * Section 5 of the cell report: the known kinds. The glitch scan's hits in the cell (10 m squares
 * a kind, `reports/map-coverage-hits.json`, written by `glitch-scan.test.ts`) with what the
 * registers say of each kind anywhere in the city, so a cell nobody has walked yet gets them too:
 * - `docs/glitches.md` (then `docs/glitches-archiwum.md`): an entry `### G-…` naming the kind in
 *   backticks is a reference; outside the entries (the proposed checks' table) a line naming it
 *   gives the G and T ids in it;
 * - `docs/topografia.md`: a row `| T-… |` naming the kind;
 * - `docs/mapa-pokrycie.json`: a clause of any cell's note or reviews naming the kind or its short
 *   form (`ABBREVIATIONS`), up to the next `,`, `;` or `.`, gives the G, T and ADR ids in it;
 * - the check's own comment in `tools/glitch-scan/test/glitch-scan.test.ts` (G, T and ADR ids).
 * Up to `SHOWN` references a kind, those whose place (x; z) lies in the cell (or which name it)
 * first. A kind without any is new to the registers; one with none in the cell may be new here.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Rect } from "../../osm-import/src/geometry.ts";
import { REPO } from "./config.ts";

export const SHOWN = 3;

/** Short forms of the kinds in the registers' notes. */
export const ABBREVIATIONS: Readonly<Record<string, readonly string[]>> = {
  "kerb-gap": ["kerb-gap-bare"],
  "kerb-fill": ["kerb-fill-wide-estimated"],
  "ground-strip": ["ground-strip-overlap", "ground-strip-gap"],
  "ring-self-cross": ["ground-ring-self-cross"],
  "lamp-style-change": ["lamp-style-change-on-way"],
  "tree-height": ["tree-height-vs-nmpt"],
};

export interface Ref {
  readonly id: string;
  /** Its place lies in the cell, or it names the cell. */
  readonly inCell: boolean;
}

export interface KnownKind {
  readonly kind: string;
  readonly hits: number;
  readonly refs: readonly Ref[];
  /** All the references the registers have for the kind. */
  readonly total: number;
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

/** The registers as text, each piece with the ids it stands for (`own`) or that it mentions. */
export interface Registers {
  readonly glitches: string;
  readonly archive?: string;
  readonly topography: string;
  /** Each cell's note and reviews. */
  readonly notes: readonly { readonly cell: string; readonly text: string }[];
  readonly scan: string;
}

const IDS = /\b(?:[GT]-\d{3}|ADR-\d{4})\b/g;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The kind as a whole word: `kerb-strip` is not `kerb-strip-bare`. */
const word = (kind: string, flags = "") => new RegExp(`(?<![\\w-])${escape(kind)}(?![\\w-])`, flags);
const idsIn = (text: string) => [...text.matchAll(IDS)].map((m) => m[0]);

/** The names a kind goes by: itself and its short forms. */
const namesOf = (kind: string) => [kind, ...Object.entries(ABBREVIATIONS).filter(([, ks]) => ks.includes(kind)).map(([a]) => a)];

const num = (s: string) => Number(s.replace("−", "-").replace(",", "."));
const N_SEMI = String.raw`([−-]?\d+(?:,\d+)?)`;
const N_DOT = String.raw`([−-]?\d+(?:\.\d+)?)`;
/** Places in the registers' prose: `(x; z)`, `(x0..x1; z0..z1)` with decimal commas, or `(x, z)`, `(x0..x1, z0..z1)` with decimal points. */
const PLACES = [new RegExp(String.raw`\(\s*${N_SEMI}(?:\s*\.\.\s*${N_SEMI})?\s*;\s*${N_SEMI}(?:\s*\.\.\s*${N_SEMI})?\s*\)`, "g"), new RegExp(String.raw`\(\s*${N_DOT}(?:\s*\.\.\s*${N_DOT})?\s*,\s+${N_DOT}(?:\s*\.\.\s*${N_DOT})?\s*\)`, "g")];

/** The places a text gives, as rectangles (a point is a rectangle of no size). */
export const placesIn = (text: string): Rect[] =>
  PLACES.flatMap((re) =>
    [...text.matchAll(re)].map((m) => {
      const [x0, x1, z0, z1] = [num(m[1]!), num(m[2] ?? m[1]!), num(m[3]!), num(m[4] ?? m[3]!)];
      return { minX: Math.min(x0, x1), maxX: Math.max(x0, x1), minZ: Math.min(z0, z1), maxZ: Math.max(z0, z1) };
    }),
  );

const meets = (a: Rect, b: Rect) => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;
const inCellOf = (text: string, cell: string, rect: Rect) => text.includes(cell) || placesIn(text).some((p) => meets(p, rect));

/** The clauses of `text` that name `name`: from the name to the next `,`, `;` or `. `. */
const clauses = (text: string, name: string): string[] => {
  const out: string[] = [];
  const re = word(name, "g");
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const rest = text.slice(m.index, m.index + 240);
    const end = rest.search(/[;,]|\.(\s|$)/);
    out.push(end >= 0 ? rest.slice(0, end) : rest);
  }
  return out;
};

/** The G and T ids in the clauses of `text` that name `kind` or a short form of it. */
export const refsInText = (text: string, kind: string): string[] => namesOf(kind).flatMap((n) => clauses(text, n).flatMap((c) => idsIn(c).filter((id) => !id.startsWith("ADR"))));

/** A glitch register in pieces: each `### G-…` entry whole, each other line apart. */
const glitchPieces = (md: string): { readonly own?: string; readonly text: string }[] => {
  const out: { own?: string; text: string }[] = [];
  for (const part of md.split(/^(?=#{2,3} )/m)) {
    const own = /^### (G-\d{3})/.exec(part)?.[1];
    if (own) out.push({ own, text: part });
    else for (const line of part.split("\n")) if (line.trim()) out.push({ text: line });
  }
  return out;
};

/** The comment over each check of the scan, by kind. */
const scanDocs = (src: string): Map<string, string> => {
  const out = new Map<string, string>();
  for (const m of src.matchAll(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n\s*"([a-z0-9-]+)":/g)) out.set(m[2]!, m[1]!);
  return out;
};

/** Every reference the registers have for `kind`, in order of trust, with whether it is in the cell. */
export const refsOf = (reg: Registers, kind: string, cell: string, rect: Rect): Ref[] => {
  const names = namesOf(kind);
  const named = (t: string) => names.some((n) => word(n).test(t));
  const ticked = (t: string) => t.includes(`\`${kind}\``);
  const found: Ref[] = [];
  const add = (ids: readonly string[], text: string, inCell = inCellOf(text, cell, rect)) => {
    for (const id of ids) found.push({ id, inCell });
  };
  for (const md of [reg.glitches, reg.archive ?? ""])
    for (const p of glitchPieces(md)) {
      if (p.own && ticked(p.text)) add([p.own], p.text);
      else if (!p.own && ticked(p.text)) add(idsIn(p.text), p.text);
    }
  for (const line of reg.topography.split("\n")) {
    const own = /^\| (T-\d{3}) \|/.exec(line)?.[1];
    if (own && named(line)) add([own], line);
  }
  for (const n of reg.notes)
    for (const name of names) for (const c of clauses(n.text, name)) add(idsIn(c), c, n.cell === cell || inCellOf(c, cell, rect));
  const doc = scanDocs(reg.scan).get(kind);
  if (doc) add(idsIn(doc), doc, false);
  const seen = new Map<string, Ref>();
  for (const r of found) seen.set(r.id, { id: r.id, inCell: (seen.get(r.id)?.inCell ?? false) || r.inCell });
  return [...seen.values()].sort((a, b) => Number(b.inCell) - Number(a.inCell));
};

export const knownSection = (cell: string, rect: Rect, hits: CellHitsLike | undefined, reg: Registers): KnownSection => {
  if (!hits) return { missing: "brak reports/map-coverage-hits.json: puść `pnpm exec vitest run tools/glitch-scan/test/glitch-scan.test.ts`", findings: 0, kinds: [], verdict: "trafień skanu nie sprawdzono" };
  const kinds = Object.entries(hits.kinds)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([kind, n]) => {
      const refs = refsOf(reg, kind, cell, rect);
      return { kind, hits: n, refs: refs.slice(0, SHOWN), total: refs.length };
    });
  const none = kinds.filter((k) => !k.total).map((k) => k.kind);
  const elsewhere = kinds.filter((k) => k.total && !k.refs.some((r) => r.inCell)).map((k) => k.kind);
  const parts = [none.length ? `rodzaje bez odsyłacza w rejestrach: ${none.join(", ")}` : "każdy rodzaj ma odsyłacz w rejestrach", elsewhere.length ? `bez odsyłacza w tej komórce (znane gdzie indziej, sprawdź, czy to ten sam przypadek): ${elsewhere.join(", ")}` : ""];
  return { findings: hits.findings, kinds, verdict: parts.filter(Boolean).join("; ") };
};

const read = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);

/** The registers in a checkout. */
export const readRegisters = (repo = REPO): Registers => {
  const reg = read(join(repo, "docs/mapa-pokrycie.json"));
  const cells = reg ? (JSON.parse(reg) as { komorki: { id: string; notatka?: string; przeglady?: string[] }[] }).komorki : [];
  const archive = read(join(repo, "docs/glitches-archiwum.md"));
  return {
    glitches: read(join(repo, "docs/glitches.md")) ?? "",
    ...(archive ? { archive } : {}),
    topography: read(join(repo, "docs/topografia.md")) ?? "",
    notes: cells.map((c) => ({ cell: c.id, text: [c.notatka ?? "", ...(c.przeglady ?? [])].join("\n") })),
    scan: read(join(repo, "tools/glitch-scan/test/glitch-scan.test.ts")) ?? "",
  };
};

/** The section from the files in the checkout (the scan's hits and the registers). */
export const loadKnown = (cell: string, rect: Rect, repo = REPO): KnownSection => {
  const hitsFile = read(join(repo, "reports/map-coverage-hits.json"));
  const hits = hitsFile ? ((JSON.parse(hitsFile) as { cells: Record<string, CellHitsLike> }).cells[cell] ?? { findings: 0, kinds: {} }) : undefined;
  return knownSection(cell, rect, hits, readRegisters(repo));
};

export const knownText = (s: KnownSection): string[] => [
  `-- znane rodzaje (trafienia skanu w komórce, kwadraty 10 m; do ${SHOWN} odsyłaczy, * = miejsce w komórce)`,
  ...(s.missing ? [s.missing] : [`znalezisk ${s.findings}; ${s.kinds.map((k) => `${k.kind} ${k.hits}${k.total ? ` (${k.refs.map((r) => `${r.id}${r.inCell ? "*" : ""}`).join(", ")}${k.total > k.refs.length ? ` z ${k.total}` : ""})` : " (bez odsyłacza)"}`).join("; ") || "brak trafień"}`]),
  `werdykt: ${s.verdict}`,
];
