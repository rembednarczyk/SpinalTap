import type { BreachDaemonId } from "@seki/core";

/**
 * Breach Protocol (ADR-0028) as pure functions: the UI draws the matrix with any random source
 * (Math.random is fine here, the layout stays out of the deterministic stream) and checks the
 * moves; the simulation only receives the daemons won.
 *
 * Rules (Cyberpunk 2077): the first pick is in the top row, then picks alternate between the
 * column and the row of the previous one, and no cell is used twice. Each pick goes into the
 * buffer; a daemon is won when its codes stand in the buffer one after another.
 */
export const BREACH_CODES = ["1C", "55", "BD", "E9", "7A", "FF"] as const;

export type BreachCode = (typeof BREACH_CODES)[number];

export interface BreachCell {
  readonly row: number;
  readonly col: number;
}

export interface BreachSequence {
  readonly daemon: BreachDaemonId;
  readonly codes: readonly BreachCode[];
}

export interface BreachPuzzle {
  readonly size: number;
  /** matrix[row][col]. */
  readonly matrix: readonly (readonly BreachCode[])[];
  readonly bufferSize: number;
  readonly sequences: readonly BreachSequence[];
  /** One path that wins every daemon (the generator starts from it). */
  readonly solution: readonly BreachCell[];
}

/** Uniform [0, 1). */
export type Rng = () => number;

const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;

/** Daemon sequence lengths by position: the first is the easy one. */
const SEQUENCE_LENGTHS = [2, 3, 3] as const;

const sameCell = (a: BreachCell, b: BreachCell) => a.row === b.row && a.col === b.col;

/** Cells the next pick may take after `picks`. */
export const legalCells = (puzzle: Pick<BreachPuzzle, "size" | "bufferSize">, picks: readonly BreachCell[]): BreachCell[] => {
  if (picks.length >= puzzle.bufferSize) return [];
  const out: BreachCell[] = [];
  const last = picks[picks.length - 1];
  for (let i = 0; i < puzzle.size; i++) {
    // Even picks walk a row (the first one the top row), odd picks the column of the previous one.
    const cell = !last ? { row: 0, col: i } : picks.length % 2 === 1 ? { row: i, col: last.col } : { row: last.row, col: i };
    if (!picks.some((p) => sameCell(p, cell))) out.push(cell);
  }
  return out;
};

export const isLegal = (puzzle: Pick<BreachPuzzle, "size" | "bufferSize">, picks: readonly BreachCell[], cell: BreachCell): boolean =>
  legalCells(puzzle, picks).some((c) => sameCell(c, cell));

export const bufferOf = (puzzle: Pick<BreachPuzzle, "matrix">, picks: readonly BreachCell[]): BreachCode[] =>
  picks.map((p) => puzzle.matrix[p.row]?.[p.col] as BreachCode);

/** True when `codes` stand in `buffer` one after another. */
export const contains = (buffer: readonly string[], codes: readonly string[]): boolean => {
  if (codes.length === 0) return true;
  for (let i = 0; i + codes.length <= buffer.length; i++) if (codes.every((c, j) => buffer[i + j] === c)) return true;
  return false;
};

/** Daemons won by `picks`, in the order of the puzzle. */
export const solvedDaemons = (puzzle: BreachPuzzle, picks: readonly BreachCell[]): BreachDaemonId[] => {
  const buffer = bufferOf(puzzle, picks);
  return puzzle.sequences.filter((s) => contains(buffer, s.codes)).map((s) => s.daemon);
};

/** The run is over: the buffer is full, no legal cell is left, or every daemon is in. */
export const isFinished = (puzzle: BreachPuzzle, picks: readonly BreachCell[]): boolean =>
  legalCells(puzzle, picks).length === 0 || solvedDaemons(puzzle, picks).length === puzzle.sequences.length;

/** The auto-solve gives at most one daemon: the shortest (easiest) sequence. */
export const autoSolve = (puzzle: BreachPuzzle): BreachDaemonId[] => {
  const easiest = [...puzzle.sequences].sort((a, b) => a.codes.length - b.codes.length)[0];
  return easiest ? [easiest.daemon] : [];
};

/** A random walk by the rules, `length` picks long; null when it gets stuck. */
const randomPath = (rng: Rng, size: number, length: number): BreachCell[] | null => {
  const path: BreachCell[] = [];
  for (let i = 0; i < length; i++) {
    const options = legalCells({ size, bufferSize: length }, path);
    if (options.length === 0) return null;
    path.push(pick(rng, options));
  }
  return path;
};

export interface BreachOptions {
  readonly size?: number;
}

/**
 * Draws a matrix and 1..3 daemon sequences that one path wins all at once: the sequences are
 * overlapping pieces of the codes along a random legal path as long as the buffer.
 */
export const generateBreach = (rng: Rng, daemons: readonly BreachDaemonId[], options: BreachOptions = {}): BreachPuzzle => {
  const size = options.size ?? 5;
  const offered = daemons.slice(0, 3);
  const bufferSize = 4 + offered.length;
  for (let attempt = 0; ; attempt++) {
    const matrix = Array.from({ length: size }, () => Array.from({ length: size }, () => pick(rng, BREACH_CODES)));
    const solution = randomPath(rng, size, bufferSize);
    if (!solution) continue;
    const codes = solution.map((c) => matrix[c.row]?.[c.col] as BreachCode);
    const sequences = offered.map((daemon, i) => {
      const len = SEQUENCE_LENGTHS[i] ?? 3;
      const start = Math.floor(rng() * (bufferSize - len + 1));
      return { daemon, codes: codes.slice(start, start + len) };
    });
    // Two daemons with the same codes would be one daemon; draw again (a few tries at most).
    const keys = new Set(sequences.map((s) => s.codes.join(" ")));
    if (keys.size < sequences.length && attempt < 20) continue;
    return { size, matrix, bufferSize, sequences, solution };
  }
};

/** Polish names and one-line effects of the daemons. */
export const DAEMON_INFO: Readonly<Record<BreachDaemonId, { readonly name: string; readonly effect: string }>> = {
  icepick: { name: "ICEpick", effect: "Quickhacki w tej sieci kosztują mniej RAM" },
  datamine: { name: "Kopacz danych", effect: "Eddies z kont sieci" },
  mass_vulnerability: { name: "Masowa podatność", effect: "Ochrona sieci słabnie" },
};

/** Seconds on the clock of a timed breach; the timer starts with the first pick. */
export const BREACH_SECONDS = 30;
