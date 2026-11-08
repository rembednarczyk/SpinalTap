/**
 * The map's review coverage (`docs/mapa-pokrycie.json`, format in `docs/mapa-pokrycie.md`): one cell
 * per chunk of the imported city, with how far its review has got, and the glitch scan's hits
 * counted per cell. Pure functions: the register and the scan's findings come in, problems,
 * counts and the map steward's queue come out. The scan's bases and checks stay as they are.
 */

/** The statuses of a cell, from the least reviewed to the most. */
export const COVERAGE_STATUSES = ["nieprzejrzane", "przejrzane", "poprawione", "czyste"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export interface CellBounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

export interface CoverageCell {
  /** The chunk's id in the import (`krakowskie-2-1`). */
  readonly id: string;
  /** The import's district, the id's prefix (`krakowskie`). */
  readonly dzielnica: string;
  /** The game's district of the chunk (`shinsekai-7`). */
  readonly dzielnicaGry: string;
  readonly bounds: CellBounds;
  readonly status: CoverageStatus;
  /** When the status was last set (`YYYY-MM-DD`); null while `nieprzejrzane`. */
  readonly data: string | null;
  /** The PRs that fixed something in the cell. */
  readonly pr: readonly number[];
  /** The rows of `docs/topografia.md` with a place in the cell: still to fix, and fixed. */
  readonly wierszeT: { readonly otwarte: readonly string[]; readonly rozwiazane: readonly string[] };
  /** The curator's audits and reviews that touched the cell, short. */
  readonly przeglady: readonly string[];
  readonly notatka: string;
}

export interface CoverageRegister {
  readonly opis: string;
  readonly komorki: readonly CoverageCell[];
}

export type Finding = { readonly at: string; readonly what: string };

/** A chunk of the city as the import gives it. */
export interface CityChunk {
  readonly id: string;
  readonly district: string;
  readonly bounds: CellBounds;
}

/** The side of a hit's square (m): a kind of glitch in one 10 × 10 m square is one hit. */
export const HIT_SQUARE = 10;

export interface CellHits {
  /** The scan's findings in the cell, one per sample. */
  readonly findings: number;
  /** Distinct (kind, 10 m square) pairs: dense samplers (`landuse-bare` every 0.5 m) count once per square. */
  readonly hits: number;
  /** Hits by kind. */
  readonly kinds: Readonly<Record<string, number>>;
}

export interface HitsPerCell {
  readonly cells: Readonly<Record<string, CellHits>>;
  /** Findings with a place in no cell (past the chunks' rectangles). */
  readonly outside: number;
  /** Findings whose `at` is not `x,z`. */
  readonly unplaced: number;
}

const inside = (b: CellBounds, x: number, z: number, closed: boolean) =>
  closed ? x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ : x >= b.minX && x < b.maxX && z >= b.minZ && z < b.maxZ;

/** The cell holding (x, z): half-open rectangles, so a seam belongs to one cell; the city's outer edge is closed. */
export const cellAt = (cells: readonly { readonly id: string; readonly bounds: CellBounds }[], x: number, z: number): string | undefined =>
  (cells.find((c) => inside(c.bounds, x, z, false)) ?? cells.find((c) => inside(c.bounds, x, z, true)))?.id;

const PLACE = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

/** The scan's findings by kind counted per cell. */
export const hitsPerCell = (found: Readonly<Record<string, readonly Finding[]>>, cells: readonly { readonly id: string; readonly bounds: CellBounds }[]): HitsPerCell => {
  const acc = new Map<string, { findings: number; squares: Set<string>; kinds: Record<string, number> }>(
    cells.map((c) => [c.id, { findings: 0, squares: new Set<string>(), kinds: {} }]),
  );
  let outside = 0;
  let unplaced = 0;
  for (const [kind, findings] of Object.entries(found)) {
    for (const f of findings) {
      const m = PLACE.exec(f.at);
      if (!m) {
        unplaced++;
        continue;
      }
      const [x, z] = [Number(m[1]), Number(m[2])];
      const id = cellAt(cells, x, z);
      if (!id) {
        outside++;
        continue;
      }
      const a = acc.get(id)!;
      a.findings++;
      const square = `${kind}:${Math.floor(x / HIT_SQUARE)},${Math.floor(z / HIT_SQUARE)}`;
      if (!a.squares.has(square)) {
        a.squares.add(square);
        a.kinds[kind] = (a.kinds[kind] ?? 0) + 1;
      }
    }
  }
  const out: Record<string, CellHits> = {};
  for (const [id, a] of acc) out[id] = { findings: a.findings, hits: a.squares.size, kinds: a.kinds };
  return { cells: out, outside, unplaced };
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const T_ROW = /^T-\d{3}$/;

/** What is wrong with one cell's record, on its own. */
const cellProblems = (c: CoverageCell): string[] => {
  const out: string[] = [];
  if (!(COVERAGE_STATUSES as readonly string[]).includes(c.status)) out.push(`${c.id}: status "${c.status}" not one of ${COVERAGE_STATUSES.join(", ")}`);
  if (c.status === "nieprzejrzane" ? c.data !== null : !DATE.test(c.data ?? "")) out.push(`${c.id}: data "${c.data}" for ${c.status}`);
  if (c.dzielnica !== c.id.replace(/-\d+-\d+$/, "")) out.push(`${c.id}: dzielnica ${c.dzielnica} is not the id's prefix`);
  const rows = [...c.wierszeT.otwarte, ...c.wierszeT.rozwiazane];
  if (rows.some((t) => !T_ROW.test(t))) out.push(`${c.id}: a T row not like T-123`);
  if (c.status === "czyste" && c.wierszeT.otwarte.length > 0) out.push(`${c.id}: czyste with T rows open (${c.wierszeT.otwarte.join(", ")})`);
  if (c.status === "poprawione" && c.pr.length === 0) out.push(`${c.id}: poprawione without a PR`);
  return out;
};

/**
 * What is wrong with the register against the city's chunks: a chunk without its cell, a cell of
 * no chunk, bounds or districts that moved, statuses off the list. With the scan's hits, also a
 * `czyste` cell with any hit.
 */
export const registerProblems = (register: CoverageRegister, chunks: readonly CityChunk[], hits?: HitsPerCell): string[] => {
  const out: string[] = [];
  const byId = new Map(register.komorki.map((c) => [c.id, c]));
  if (byId.size !== register.komorki.length) out.push("a cell is listed twice");
  for (const ch of chunks) {
    const c = byId.get(ch.id);
    if (!c) out.push(`${ch.id}: no cell in the register`);
    else {
      if (c.dzielnicaGry !== ch.district) out.push(`${ch.id}: dzielnicaGry ${c.dzielnicaGry}, the chunk's is ${ch.district}`);
      if ((["minX", "maxX", "minZ", "maxZ"] as const).some((k) => c.bounds[k] !== ch.bounds[k])) out.push(`${ch.id}: bounds differ from the chunk's`);
    }
  }
  const ids = new Set(chunks.map((c) => c.id));
  for (const c of register.komorki) {
    if (!ids.has(c.id)) out.push(`${c.id}: no such chunk in the city`);
    out.push(...cellProblems(c));
    const h = hits?.cells[c.id];
    if (c.status === "czyste" && h && h.hits > 0) out.push(`${c.id}: czyste with ${h.hits} hits of the scan`);
  }
  return out;
};
