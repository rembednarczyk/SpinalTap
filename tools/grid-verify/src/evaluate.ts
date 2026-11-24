import type { Check, Phase } from "./checklist.ts";

/** A grid's declaration (`docs/siatki/<name>.json`): its chunks and the decisions on the points no command settles. */
export interface Declaration {
  readonly nazwa: string;
  readonly chunki: readonly string[];
  /** The ref the scan's new places are measured against. */
  readonly baza?: string;
  /** The decisions by point: done, or taken in on purpose, each with its reference (a G, a T, a PR, a file). */
  readonly decyzje?: Readonly<Record<string, { readonly status: "zrobione" | "przyjete"; readonly odnosnik: string; readonly uwagi?: string }>>;
}

export type Status = "ok" | "blad" | "zrobione" | "przyjete" | "do-zrobienia" | "nie-uruchomione";

export interface Item {
  readonly id: string;
  readonly faza: Phase;
  readonly opis: string;
  readonly status: Status;
  readonly szczegoly?: string;
}

export interface Report {
  readonly nazwa: string;
  /** The commit and whether the tree had changes when the report was made: the hook takes a report of another state for none. */
  readonly head: string;
  readonly brudne: boolean;
  readonly kiedy: string;
  readonly punkty: readonly Item[];
}

/** A point settles the checklist when its command passed or a decision with a reference stands for it. */
export const SETTLED: ReadonlySet<Status> = new Set(["ok", "zrobione", "przyjete"]);

/**
 * A point's status from its run (true passed, false failed, null not run) and the declaration's decision: a failed or
 * unrun point a decision takes in stays settled only with a reference; a point with no command needs a decision.
 */
export const statusOf = (check: Check, run: boolean | null, d: Declaration): Status => {
  const decided = d.decyzje?.[check.id];
  const withRef = decided && decided.odnosnik.trim() !== "" ? decided.status : null;
  if (run === true) return "ok";
  if (run === false) return withRef === "przyjete" ? "przyjete" : "blad";
  if (check.komenda) return withRef ?? "nie-uruchomione";
  return withRef ?? "do-zrobienia";
};

/** The scan's new or grown places (`pnpm scan:diff <base> report`, lines `  + kind key…`): in the grid's chunks and outside them. */
export const splitNewPlaces = (diff: string, chunks: readonly string[]): { readonly inside: string[]; readonly outside: string[] } => {
  const added = diff.split("\n").filter((l) => /^\s+\+ /.test(l)).map((l) => l.trim().slice(2));
  const ours = (l: string) => chunks.some((c) => new RegExp(`(^|[^\\w-])${c.replace(/[-]/g, "\\-")}([^\\w-]|$)`).test(l));
  return { inside: added.filter(ours), outside: added.filter((l) => !ours(l)) };
};

/** The points not settled, for the hook and the summary. */
export const unsettled = (r: Report): Item[] => r.punkty.filter((p) => !SETTLED.has(p.status));

/** A report made at `head` with `brudne` describes the tree now. */
export const fresh = (r: Report, head: string, brudne: boolean): boolean => r.head === head && r.brudne === brudne;

/** The summary printed and written next to the report. */
export const summary = (r: Report): string => {
  const mark: Record<Status, string> = { ok: "OK", blad: "BŁĄD", zrobione: "zrobione", przyjete: "przyjęte", "do-zrobienia": "DO ZROBIENIA", "nie-uruchomione": "NIE URUCHOMIONE" };
  const lines = r.punkty.map((p) => `- [${mark[p.status]}] ${p.faza}: ${p.opis}${p.szczegoly ? ` (${p.szczegoly})` : ""}`);
  const left = unsettled(r).length;
  return [`Siatka ${r.nazwa} @ ${r.head.slice(0, 7)}${r.brudne ? " (zmiany niezatwierdzone)" : ""}: ${left === 0 ? "wszystko rozstrzygnięte" : `${left} do rozstrzygnięcia`}`, ...lines].join("\n");
};
