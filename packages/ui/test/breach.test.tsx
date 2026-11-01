// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS, type UiIntents, type UiState, createUiStore } from "../src";
import { BreachPanel } from "../src/breach/breach-panel";
import { type BreachCell, type BreachPuzzle, autoSolve, bufferOf, contains, generateBreach, isFinished, isLegal, legalCells, solvedDaemons } from "../src/breach/breach-logic";
import { UiContext } from "../src/use-ui";

/** mulberry32: a seeded [0, 1) source, so the layouts under test are fixed. */
const seeded = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ALL = ["icepick", "datamine", "mass_vulnerability"] as const;

/** Every pick of a path follows the rules (top row first, then column, row, column...). */
const walk = (puzzle: BreachPuzzle, path: readonly BreachCell[]) => path.every((cell, i) => isLegal(puzzle, path.slice(0, i), cell));

describe("breach logic", () => {
  it("starts in the top row, then alternates column and row and never reuses a cell", () => {
    const p = { size: 5, bufferSize: 6 };
    expect(legalCells(p, [])).toEqual([0, 1, 2, 3, 4].map((col) => ({ row: 0, col })));
    // After (0,2): the rest of column 2.
    expect(legalCells(p, [{ row: 0, col: 2 }])).toEqual([1, 2, 3, 4].map((row) => ({ row, col: 2 })));
    // After (0,2) and (3,2): the rest of row 3.
    expect(legalCells(p, [{ row: 0, col: 2 }, { row: 3, col: 2 }])).toEqual([0, 1, 3, 4].map((col) => ({ row: 3, col })));
    expect(isLegal(p, [{ row: 0, col: 2 }], { row: 0, col: 3 })).toBe(false);
    // A full buffer takes nothing more.
    expect(legalCells({ size: 5, bufferSize: 1 }, [{ row: 0, col: 0 }])).toEqual([]);
  });

  it("finds sequences only as consecutive codes", () => {
    expect(contains(["1C", "55", "BD"], ["55", "BD"])).toBe(true);
    expect(contains(["1C", "55", "BD"], ["1C", "BD"])).toBe(false);
    expect(contains([], [])).toBe(true);
    expect(contains(["1C"], ["1C", "55"])).toBe(false);
  });

  it.each([1, 2, 3])("draws %i daemons that one legal path wins together", (n) => {
    for (let seed = 1; seed <= 40; seed++) {
      const puzzle = generateBreach(seeded(seed), ALL.slice(0, n));
      expect(puzzle.sequences.map((s) => s.daemon)).toEqual(ALL.slice(0, n));
      expect(puzzle.bufferSize).toBe(4 + n);
      expect(puzzle.matrix).toHaveLength(5);
      expect(puzzle.solution).toHaveLength(puzzle.bufferSize);
      expect(walk(puzzle, puzzle.solution)).toBe(true);
      expect(solvedDaemons(puzzle, puzzle.solution)).toEqual(ALL.slice(0, n));
      expect(isFinished(puzzle, puzzle.solution)).toBe(true);
      expect(puzzle.sequences[0]?.codes).toHaveLength(2);
    }
  });

  it("is over when every daemon is in, before the buffer is full", () => {
    const puzzle = generateBreach(seeded(3), ["icepick"]);
    expect(isFinished(puzzle, [])).toBe(false);
    const buffer = bufferOf(puzzle, puzzle.solution);
    const codes = puzzle.sequences[0]!.codes;
    const start = buffer.findIndex((_, i) => contains(buffer.slice(i, i + codes.length), codes));
    const enough = puzzle.solution.slice(0, start + codes.length);
    expect(isFinished(puzzle, enough)).toBe(true);
  });

  it("auto-solve gives at most one daemon, the easiest", () => {
    const puzzle = generateBreach(seeded(9), ALL);
    expect(autoSolve(puzzle)).toEqual(["icepick"]);
    expect(autoSolve({ ...puzzle, sequences: [] })).toEqual([]);
  });

  it("still returns a layout with a degenerate random source", () => {
    const puzzle = generateBreach(() => 0, ALL);
    expect(walk(puzzle, puzzle.solution)).toBe(true);
  });
});

const intents = (): UiIntents & Record<string, ReturnType<typeof vi.fn>> => {
  const spies: Record<string | symbol, ReturnType<typeof vi.fn>> = {};
  return new Proxy(spies, { get: (t, k) => (t[k] ??= vi.fn()) }) as UiIntents & Record<string, ReturnType<typeof vi.fn>>;
};

const mount = (state: Partial<UiState>, seed = 5) => {
  const store = createUiStore({ screen: "playing", breach: { terminalKey: "crane", daemons: ALL }, ...state });
  const i = intents();
  render(
    <UiContext.Provider value={{ store, intents: i }}>
      <BreachPanel rng={seeded(seed)} />
    </UiContext.Provider>,
  );
  return { store, i, puzzle: generateBreach(seeded(seed), ALL) };
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("breach panel", () => {
  it("plays the solution path into the buffer and sends every daemon won", () => {
    const { i, puzzle } = mount({});
    expect(screen.getAllByRole("gridcell")).toHaveLength(25);
    // The rules are on the panel until the first pick (gap audit: no system hints for Breach).
    expect(screen.getByTestId("breach-rules").textContent).toContain("lit row");
    // Only the top row is open at first.
    expect((screen.getByTestId("breach-cell-1-0") as HTMLButtonElement).disabled).toBe(true);
    for (const c of puzzle.solution) {
      if (screen.queryByTestId("breach-result")) break;
      fireEvent.click(screen.getByTestId(`breach-cell-${c.row}-${c.col}`));
      expect(screen.queryByTestId("breach-rules")).toBeNull();
    }
    expect(screen.getByTestId("breach-result").textContent).toContain("ICEpick");
    expect(screen.getByTestId("breach-daemon-datamine").className).toContain("breach__daemon--won");
    fireEvent.click(screen.getByText("Finish"));
    expect(i.submitBreach).toHaveBeenCalledWith(["icepick", "datamine", "mass_vulnerability"]);
  });

  it("auto-solves into one daemon, and disconnecting sends what was won so far", () => {
    const { i } = mount({});
    fireEvent.click(screen.getByText("Auto-solve (1 daemon)"));
    expect(i.submitBreach).toHaveBeenLastCalledWith(["icepick"]);
    fireEvent.click(screen.getByText("Disconnect"));
    expect(i.submitBreach).toHaveBeenLastCalledWith([]);
  });

  it("runs the clock from the first pick and stops the run when it is out", () => {
    vi.useFakeTimers();
    const { puzzle } = mount({});
    expect(screen.getByTestId("breach-timer").textContent).toContain("starts on the first pick");
    const first = puzzle.solution[0]!;
    fireEvent.click(screen.getByTestId(`breach-cell-${first.row}-${first.col}`));
    act(() => vi.advanceTimersByTime(5000));
    expect(Number.parseFloat(screen.getByTestId("breach-timer").textContent ?? "")).toBeLessThan(26);
    act(() => vi.advanceTimersByTime(30000));
    expect(screen.getByTestId("breach-result").textContent).toContain("Time's up");
  });

  it("has no clock with the untimed setting", () => {
    mount({ settings: { ...DEFAULT_SETTINGS, untimedBreach: true } });
    expect(screen.queryByTestId("breach-timer")).toBeNull();
    expect(screen.getByText("no time limit")).toBeTruthy();
  });

  it("shows nothing without a breach", () => {
    mount({ breach: null });
    expect(screen.queryByTestId("breach")).toBeNull();
  });
});
