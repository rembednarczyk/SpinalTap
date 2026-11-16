import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { baseKinds, readKind } from "../../glitch-scan/src/scan-base.ts";
import { type FoundKey, type KindBase, describeKey, diffKind } from "../../glitch-scan/src/scan-keys.ts";
import { S4_KINDS, SCAN_BASE, SCAN_REPORT } from "./config.ts";

/** A kind's keys that came, grew and went against the scan's base. */
export interface ScanKindDiff {
  readonly kind: string;
  readonly severity: "S1-S3" | "S4";
  readonly before: number;
  readonly after: number;
  /** New keys and known keys found more often, as `describeKey` writes them. */
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

export interface ScanDiff {
  readonly ran: boolean;
  /** Only the kinds with a key come or gone, sorted. */
  readonly kinds: readonly ScanKindDiff[];
}

/** The diff of the found keys against the base by kind (pure): kinds absent on one side have no keys there. */
export const scanDiff = (base: ReadonlyMap<string, KindBase>, found: ReadonlyMap<string, ReadonlyMap<string, number>>): ScanDiff => {
  const kinds: ScanKindDiff[] = [];
  for (const kind of [...new Set([...base.keys(), ...found.keys()])].sort()) {
    const keys = new Map<string, FoundKey>([...(found.get(kind) ?? new Map<string, number>())].map(([k, n]) => [k, { n, samples: n, what: "" }]));
    const d = diffKind(kind, base.get(kind) ?? new Map(), keys);
    if (!d.added.length && !d.grown.length && !d.removed.length) continue;
    kinds.push({
      kind,
      severity: S4_KINDS.has(kind) ? "S4" : "S1-S3",
      before: d.before,
      after: d.after,
      added: [...d.added.map((a) => describeKey(kind, a.key)), ...d.grown.map((g) => `${describeKey(kind, g.key)} ${g.was} -> ${g.now}`)],
      removed: d.removed.map((r) => describeKey(kind, r.key)),
    });
  }
  return { ran: true, kinds };
};

/** The scan's last run in `root` against its base there; `ran: false` without a report. */
export const readScanDiff = (root: string): ScanDiff => {
  const file = join(root, SCAN_REPORT);
  if (!existsSync(file)) return { ran: false, kinds: [] };
  const r = JSON.parse(readFileSync(file, "utf8")) as { keys?: Record<string, Record<string, number>> };
  if (!r.keys) return { ran: false, kinds: [] };
  const found = new Map(Object.entries(r.keys).map(([k, m]) => [k, new Map(Object.entries(m))]));
  const dir = join(root, SCAN_BASE);
  // Only the kinds the run ran: a kind of the base it did not run is not "all gone".
  const base = new Map(baseKinds(dir).filter((k) => found.has(k)).map((k) => [k, readKind(dir, k)]));
  return scanDiff(base, found);
};
