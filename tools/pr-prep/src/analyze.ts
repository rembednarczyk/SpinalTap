/**
 * What `prep.ts` (`pnpm pr:prep`) says of a branch, from git's lists alone: the generated files,
 * golden hashes and baselines it changes, the files it shares with the other open branches, and
 * after which of them its CI has to run again (a guarded file of one side whose inputs the other
 * changes, or a file both change). Pure functions on repository paths.
 */

/** `**` any path, `*` any name part. */
export const globToRegExp = (glob: string): RegExp =>
  new RegExp(
    `^${glob
      .split("**")
      .map((part) => part.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
      .join(".*")
      .replace(/\.\*\//g, "(?:.*/)?")}$`,
  );

const matches = (globs: readonly string[], path: string): boolean => globs.some((g) => globToRegExp(g).test(path));

export type Kind = "generated" | "golden" | "baseline";

export interface Guarded {
  readonly id: string;
  readonly kind: Kind;
  /** The files that hold it. */
  readonly files: readonly string[];
  /** What it is worked out from: a change there in another branch can change it. */
  readonly inputs: readonly string[];
}

const SIM = ["packages/core/src/**", "packages/sim/src/**"];
const MAP = ["packages/core/src/**", "packages/sim/src/content/**", "packages/sim/src/world/**", "packages/engine/src/renderer/mapcity/**"];
const IMPORT = ["tools/osm-import/**", "tools/orto/**", "data/osm/**", "data/terrain/**", "data/gugik/**", "data/orto/**"];

export const GUARDED: readonly Guarded[] = [
  { id: "lublin-tables", kind: "generated", files: ["packages/sim/src/content/lublin/*.generated.ts"], inputs: IMPORT },
  { id: "orto-cover", kind: "generated", files: ["data/orto/*.cover.*", "data/orto/sources.json"], inputs: ["tools/orto/src/**"] },
  { id: "albedo-medians", kind: "generated", files: ["data/orto/albedo-medians.json"], inputs: ["tools/orto/src/**", "data/orto/*.cover.*", "packages/sim/src/content/lublin/*.generated.ts"] },
  { id: "determinism", kind: "golden", files: ["packages/sim/test/determinism.test.ts"], inputs: SIM },
  { id: "ground-cut", kind: "golden", files: ["packages/engine/test/ground-cut.test.ts"], inputs: MAP },
  { id: "map-ground-golden", kind: "golden", files: ["packages/engine/test/map-ground-golden.test.ts"], inputs: MAP },
  { id: "npr-snapshot", kind: "golden", files: ["e2e/__snapshots__/**"], inputs: ["packages/engine/src/**", "packages/sim/src/content/**"] },
  { id: "glitch-baseline", kind: "baseline", files: ["tools/glitch-scan/test/glitch-baseline.json"], inputs: [...MAP, "tools/glitch-scan/**"] },
  { id: "i18n-baseline", kind: "baseline", files: ["tools/i18n-scan/test/i18n-baseline.json"], inputs: ["packages/*/src/**", "tools/i18n-scan/**"] },
  { id: "god-objects-baseline", kind: "baseline", files: ["tools/code-health/test/god-objects-baseline.json"], inputs: ["packages/*/src/**", "tools/code-health/**"] },
  { id: "perf-budgets", kind: "baseline", files: ["tools/perf-budgets.json"], inputs: ["packages/engine/src/**", "packages/sim/src/content/**"] },
];

/** The guarded things a list of changed files touches, each with its files there. */
export const guardedIn = (files: readonly string[], guarded: readonly Guarded[] = GUARDED): Record<string, readonly string[]> =>
  Object.fromEntries(guarded.map((g) => [g.id, files.filter((f) => matches(g.files, f))] as const).filter(([, f]) => f.length > 0));

export interface OtherBranch {
  readonly branch: string;
  readonly shared: readonly string[];
  /** Run this branch's CI again after merging the other one. */
  readonly rerun: boolean;
  readonly why: readonly string[];
}

/** One other open branch against this one. */
export const against = (mine: readonly string[], branch: string, theirs: readonly string[], guarded: readonly Guarded[] = GUARDED): OtherBranch => {
  const set = new Set(theirs);
  const shared = mine.filter((f) => set.has(f));
  const why: string[] = shared.length ? [`wspólne pliki: ${shared.length}`] : [];
  for (const g of guarded) {
    const [mineHolds, theirsHolds] = [mine.some((f) => matches(g.files, f)), theirs.some((f) => matches(g.files, f))];
    const [mineFeeds, theirsFeeds] = [mine.some((f) => matches(g.inputs, f)), theirs.some((f) => matches(g.inputs, f))];
    if (mineHolds && theirsHolds) why.push(`${g.id}: obie gałęzie go zmieniają`);
    else if (mineHolds && theirsFeeds) why.push(`${g.id}: ta gałąź go zmienia, tamta jego wejścia`);
    else if (theirsHolds && mineFeeds) why.push(`${g.id}: tamta gałąź go zmienia, ta jego wejścia`);
  }
  return { branch, shared, rerun: why.length > 0, why };
};

export interface Summary {
  readonly branch: string;
  readonly sha: string;
  readonly clean: boolean;
  readonly conflicts: readonly string[];
  readonly ahead: number;
  readonly behind: number;
  readonly guarded: Record<string, readonly string[]>;
  readonly others: readonly OtherBranch[];
}

const KIND_PL: Record<Kind, string> = { generated: "wygenerowane", golden: "złote", baseline: "bazy" };

/** The one line of the report. */
export const summaryLine = (s: Summary, guarded: readonly Guarded[] = GUARDED): string => {
  const merge = s.clean ? "scala się czysto z origin/main" : `KONFLIKT z origin/main (${s.conflicts.length}: ${s.conflicts.slice(0, 3).join(", ")}${s.conflicts.length > 3 ? ", …" : ""})`;
  const kinds = (["generated", "golden", "baseline"] as const).map((k) => {
    const ids = guarded.filter((g) => g.kind === k && s.guarded[g.id]).map((g) => g.id);
    return `${KIND_PL[k]} ${ids.length ? ids.join("+") : "-"}`;
  });
  const shared = s.others.filter((o) => o.shared.length).map((o) => `${o.branch} (${o.shared.length})`);
  const rerun = s.others.filter((o) => o.rerun).map((o) => o.branch);
  return [`${s.branch} ${s.sha}`, merge, `+${s.ahead}/-${s.behind} wobec main`, kinds.join(", "), `wspólne pliki: ${shared.join(", ") || "-"}`, `ponów CI po scaleniu: ${rerun.join(", ") || "-"}`].join(" | ");
};
