import type { CellBounds } from "./map-coverage.ts";
import { OFF_MAP } from "./scan-keys.ts";

/**
 * The scan's part of the city on a pull request (ADR-0054, decision of the user 16.11):
 * `GLITCH_SCAN_CHUNKS=krakowskie,podzamcze` (the districts whose tables changed, the names of
 * their `packages/sim/src/content/lublin/<district>.generated.ts`, `tools/ci-scope`) compares the
 * keys of those districts' chunks and of every chunk touching them, a corner too; unset, the whole
 * city as before. Main and the nightly run always compare the whole city.
 *
 * Every check still runs over the whole city: their cost is the worlds they build once from the
 * sources and all the tables (`cityLanduseWorld`, `generatedCity`, the patrol lanes), not the
 * chunks, so a check limited to some chunks would save little (measured 16.11: the scan with the
 * tables of 8 of the 20 chunks took as long as with all) and could miss what lies past them.
 * The part limits only what is compared with the base.
 *
 * Why the neighbours: a district's tables move findings past their chunks' bounds. Pieces of
 * ground and buildings reach over a chunk's bound and are keyed where their finding lies
 * (`keyOf` keys by place); checks look across the seams on purpose (`seam-gap`, the 0.25 m
 * rasters of `walk-blocked` and `ground-strip-*`, `kerb-gap-bare`'s box of the chunk and twice its
 * gap, the buildings split at a bound, `building-duplicate`). One ring of chunks (about 200 m)
 * holds all of these. Keys with no chunk, off the map (`poza`) or with no place (`?`), are
 * compared always: no chunk to tell them by. What reaches farther, the patrol and drone lanes and
 * the traffic routes planned over the whole city, can show a new key in a chunk past the ring:
 * only main's run, which compares everything, catches it.
 */

/** The variable that sets the part. */
export const CHUNKS_ENV = "GLITCH_SCAN_CHUNKS";

interface Cell {
  readonly id: string;
  readonly bounds: CellBounds;
}

/** The districts in the variable, or `undefined` when unset or empty: the whole city. */
export const parseScanChunks = (value: string | undefined): string[] | undefined => {
  const names = (value ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n !== "");
  return names.length > 0 ? names : undefined;
};

/** A district's chunks: its own id or `<district>-<i>-<j>`. */
const ofDistrict = (name: string, id: string) => id === name || (id.startsWith(`${name}-`) && /^\d+-\d+$/.test(id.slice(name.length + 1)));

/** Do two chunks' bounds meet (an edge or a corner)? */
const touch = (a: CellBounds, b: CellBounds) => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

/**
 * The chunks compared: the named districts' chunks and every chunk touching one of them.
 * Throws on a name with no chunk (a table renamed or a typo), so a part never compares nothing.
 */
export const scanArea = (names: readonly string[], cells: readonly Cell[]): Set<string> => {
  const own = cells.filter((c) => names.some((n) => ofDistrict(n, c.id)));
  const missing = names.filter((n) => !cells.some((c) => ofDistrict(n, c.id)));
  if (missing.length > 0) throw new Error(`${CHUNKS_ENV}: no chunk of ${missing.join(", ")} (the chunks: ${cells.map((c) => c.id).join(", ")})`);
  return new Set(cells.filter((c) => own.some((o) => touch(o.bounds, c.bounds))).map((c) => c.id));
};

/** Is a key (`chunk x,z` or `? text`, `scan-keys.ts`) compared in the part? */
export const inArea = (area: ReadonlySet<string>, key: string): boolean => {
  const chunk = key.slice(0, key.indexOf(" "));
  return chunk === "?" || chunk === OFF_MAP || area.has(chunk);
};

/** The keys of a kind's base or findings that the part compares; the whole map with no part. */
export const restrictKeys = <T>(keys: ReadonlyMap<string, T>, area: ReadonlySet<string> | undefined): Map<string, T> =>
  new Map(area === undefined ? keys : [...keys].filter(([k]) => inArea(area, k)));

/**
 * `GLITCH_BASELINE=update|accept` with a part is refused: the base is the whole city's list, and
 * a write from a part would have to keep the keys it did not compare by hand. Update the base
 * with the whole scan (`pnpm scan:update`).
 */
export const checkWrite = (mode: string | undefined, names: readonly string[] | undefined): void => {
  if (names !== undefined && (mode === "update" || mode === "accept"))
    throw new Error(`GLITCH_BASELINE=${mode} with ${CHUNKS_ENV}=${names.join(",")}: the base is written only from the whole scan; unset ${CHUNKS_ENV}`);
};
