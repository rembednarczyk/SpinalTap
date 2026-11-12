/**
 * The map's cells (`docs/mapa-pokrycie.json`, one per import chunk) the GUGiK report is cut
 * into (ADR-0077).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type Rect } from "../../osm-import/src/geometry.ts";
import { REPO } from "../../osm-import/src/paths.ts";

export interface MapCell {
  readonly id: string;
  readonly district: string;
  readonly bounds: Rect;
}

export const loadCells = (file = join(REPO, "docs/mapa-pokrycie.json")): MapCell[] => {
  const doc = JSON.parse(readFileSync(file, "utf8")) as { komorki: { id: string; dzielnica: string; bounds: Rect }[] };
  return doc.komorki.map((c) => ({ id: c.id, district: c.dzielnica, bounds: c.bounds }));
};

/** The cell a world point falls in, if any. */
export const cellOf = (cells: readonly MapCell[], x: number, z: number): MapCell | undefined =>
  cells.find((c) => x >= c.bounds.minX && x < c.bounds.maxX && z >= c.bounds.minZ && z < c.bounds.maxZ);
