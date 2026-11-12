/**
 * Lines out of a BDOT10k GeoPackage (ADR-0077): the file is opened read-only with Node's own
 * SQLite (`node:sqlite`) and only queried, and the geometry blobs (GeoPackage header + WKB) are
 * decoded here. Only (multi)linestrings are read; Z and M ordinates are dropped.
 */
import { DatabaseSync } from "node:sqlite";

/** A line in grid coordinates: [easting, northing] pairs. */
export type Line2 = readonly (readonly [number, number])[];

export interface GpkgLine {
  readonly id: string;
  readonly kind: string;
  readonly lines: readonly Line2[];
}

const ENVELOPE_BYTES = [0, 32, 48, 48, 64];

/** WKB (multi)linestrings of a GeoPackage geometry blob. */
export const decodeLines = (blob: Uint8Array): Line2[] => {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  if (blob[0] !== 0x47 || blob[1] !== 0x50) throw new Error("not a GeoPackage geometry");
  const flags = blob[3]!;
  const env = ENVELOPE_BYTES[(flags >> 1) & 7];
  if (env === undefined) throw new Error(`bad envelope flag ${flags}`);
  let at = 8 + env;
  const out: Line2[] = [];
  const read = (): void => {
    const le = blob[at] === 1;
    const raw = view.getUint32(at + 1, le);
    at += 5;
    // ISO (1000s) and EWKB (high bits) flags for Z and M.
    const iso = Math.floor((raw & 0xffff) / 1000);
    const base = (raw & 0xffff) % 1000;
    const dims = 2 + (iso === 1 || iso === 2 ? 1 : iso === 3 ? 2 : 0) + (raw & 0x80000000 ? 1 : 0) + (raw & 0x40000000 ? 1 : 0);
    if (base === 2) {
      const n = view.getUint32(at, le);
      at += 4;
      const line: [number, number][] = [];
      for (let i = 0; i < n; i++, at += 8 * dims) line.push([view.getFloat64(at, le), view.getFloat64(at + 8, le)]);
      out.push(line);
    } else if (base === 5) {
      const n = view.getUint32(at, le);
      at += 4;
      for (let i = 0; i < n; i++) read();
    } else throw new Error(`unsupported WKB type ${raw}`);
  };
  read();
  return out;
};

/** The features of a single-table BDOT10k line file, with their `RODZAJ` (kind) and `LOKALNYID`. */
export const readGpkgLines = (file: string): GpkgLine[] => {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const geo = db.prepare("SELECT table_name AS t, column_name AS c, srs_id AS s FROM gpkg_geometry_columns").get() as { t: string; c: string; s: number } | undefined;
    if (!geo) return [];
    if (geo.s !== 2180) throw new Error(`${file}: SRS ${geo.s}, expected 2180`);
    const rows = db.prepare(`SELECT "LOKALNYID" AS id, "RODZAJ" AS kind, "${geo.c.replace(/"/g, "")}" AS g FROM "${geo.t.replace(/"/g, "")}"`).all() as {
      id: string;
      kind: string | null;
      g: Uint8Array | null;
    }[];
    return rows.filter((r) => r.g).map((r) => ({ id: String(r.id), kind: r.kind ?? "", lines: decodeLines(r.g!) }));
  } finally {
    db.close();
  }
};
