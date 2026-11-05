import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface StepLine {
  readonly speaker: string | null;
  readonly text: string;
}

export interface Step {
  /** `<file>:<line>` of the step's first line. */
  readonly at: string;
  readonly lines: readonly StepLine[];
}

const SPEAKER = /^([A-Z]+):\s*(.*)$/;
const SKIP = /^(\/\/|~|VAR |CONST |INCLUDE |EXTERNAL )/;
const length = (lines: readonly StepLine[]) => lines.reduce((n, l) => n + l.text.length, 0);

/** Inline ink: the longest of `{a|b}`, the text of `{cond: text}`, a name for `{var}`, no tags or glue. */
const flatten = (s: string): string =>
  s
    .replace(/\s#.*$/, "")
    .replace(/<>/g, "")
    .replace(/\{[^{}]*\}/g, (m) => {
      const body = m.slice(1, -1);
      const colon = body.indexOf(":");
      const options = (colon >= 0 && !body.includes("|") ? body.slice(colon + 1) : body).split("|");
      return /^\s*\w+\s*$/.test(body) ? "Seki Senshi" : options.reduce((a, b) => (b.length > a.length ? b : a), "").trim();
    })
    .trim();

const toLine = (s: string): StepLine | null => {
  const text = flatten(s);
  if (!text) return null;
  const m = SPEAKER.exec(text);
  return m ? { speaker: m[1] ?? null, text: m[2] ?? "" } : { speaker: null, text };
};

/**
 * The steps of one ink file as the subtitles show them (G-283): the lines between two choices.
 * A conditional block counts with its longest branch, the body of each choice runs on into the
 * gather after it, and a divert ends the step. An approximation of the runtime, worst case
 * within a branch; enough to size the subtitle box.
 */
export const inkSteps = (source: string, file: string): Step[] => {
  const steps: Step[] = [];
  let current: StepLine[] = [];
  let start = 0;
  /** Bodies of the choices waiting for the gather that follows them. */
  let pending: { at: number; lines: StepLine[] }[] = [];
  /** Past the gather: `current` runs on after every pending body. */
  let gathered = false;
  /** Open conditional blocks: each a list of branches. */
  const blocks: StepLine[][][] = [];
  const emit = (at: number, lines: readonly StepLine[]) => {
    if (lines.length > 0) steps.push({ at: `${file}:${at}`, lines });
  };
  const flush = () => {
    if (pending.length > 0) {
      if (!gathered) pending.at(-1)?.lines.push(...current.splice(0));
      for (const p of pending) emit(p.at, [...p.lines, ...current]);
      pending = [];
      gathered = false;
    } else emit(start, current);
    current = [];
  };
  const push = (line: StepLine, n: number) => {
    const branch = blocks.at(-1)?.at(-1);
    if (branch) branch.push(line);
    else {
      if (current.length === 0) start = n;
      current.push(line);
    }
  };
  source.split("\n").forEach((raw, i) => {
    const n = i + 1;
    const s = raw.trim();
    if (!s || SKIP.test(s)) return;
    if (s === "{" || /^\{[^}]*:$/.test(s)) return void blocks.push([[]]);
    if (blocks.length > 0 && /^-\s*(else|[^:]*):$/.test(s)) return void blocks.at(-1)?.push([]);
    if (blocks.length > 0 && s === "}") {
      const longest = (blocks.pop() ?? []).reduce((a, b) => (length(b) > length(a) ? b : a), []);
      for (const l of longest) push(l, n);
      return;
    }
    if (/^(==|=|->|<-)/.test(s)) return void flush();
    const choice = /^[*+][\s*+]*(?:\{[^}]*\}\s*)*(\[[^\]]*\])?\s*(.*)$/.exec(s);
    if (choice) {
      // The step on screen ends at its first choice; the body of the one before waits for the gather.
      if (pending.length === 0 || gathered) flush();
      else pending.at(-1)?.lines.push(...current.splice(0));
      pending.push({ at: n, lines: [] });
      return;
    }
    const gather = /^-\s*(\(\w+\))?\s*(.*)$/.exec(s);
    const text = (gather ? (gather[2] ?? "") : s).replace(/->.*$/, "").trim();
    if (gather && pending.length > 0 && !gathered) {
      pending.at(-1)?.lines.push(...current.splice(0));
      gathered = true;
    }
    const line = text ? toLine(text) : null;
    if (line) push(line, n);
    if (/->/.test(s)) flush();
  });
  flush();
  return steps;
};

/** Every step of every ink file in `ink/<locale>`. */
export const allSteps = (locale: "en" | "pl"): Step[] => {
  const dir = join(import.meta.dirname, "../packages/narrative/ink", locale);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".ink"))
    .sort()
    .flatMap((f) => inkSteps(readFileSync(join(dir, f), "utf8"), `${locale}/${f}`));
};
