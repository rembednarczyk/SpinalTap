/**
 * The terrain model as stored in `data/terrain/`: a district's GUGiK NMT 1 m mosaic in the
 * PUWG 1992 grid, heights in decimetres above 100 m as little-endian uint16 (0 = no data), and
 * the EU-DEM 25 m fallback as a lattice in world metres. Both answer heights in world points.
 */
import { type Pt } from "./geometry.ts";
import { type Puwg, worldToPuwg } from "./project.ts";

export interface DtmHeader {
  readonly source: string;
  readonly crs: "EPSG:2180";
  readonly vertical: string;
  /** Easting of the west edge of column 0 and northing of the north edge of row 0. */
  readonly e0: number;
  readonly n0: number;
  readonly cols: number;
  readonly rows: number;
  readonly step: number;
  readonly offset: number;
  readonly scale: number;
}

export const DTM_OFFSET = 100;
export const DTM_SCALE = 0.1;

export interface Dtm {
  readonly header: DtmHeader;
  readonly cells: Uint16Array;
}

export const encodeHeight = (h: number): number => (Number.isFinite(h) && h > -1000 ? Math.max(1, Math.min(65535, Math.round((h - DTM_OFFSET) / DTM_SCALE))) : 0);

export const dtmToBytes = (cells: Uint16Array): Uint8Array => {
  const out = new Uint8Array(cells.length * 2);
  const dv = new DataView(out.buffer);
  cells.forEach((v, i) => dv.setUint16(i * 2, v, true));
  return out;
};

export const dtmFromBytes = (bytes: Uint8Array): Uint16Array => {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cells = new Uint16Array(bytes.byteLength / 2);
  for (let i = 0; i < cells.length; i++) cells[i] = dv.getUint16(i * 2, true);
  return cells;
};

/** Height (metres above sea level) of the grid point nearest-interpolated bilinearly; NaN without data. */
export const dtmAtGrid = (d: Dtm, g: Puwg): number => {
  const h = d.header;
  const fc = (g.e - h.e0) / h.step - 0.5;
  const fr = (h.n0 - g.n) / h.step - 0.5;
  if (fc < -0.5 || fr < -0.5 || fc > h.cols - 0.5 || fr > h.rows - 0.5) return Number.NaN;
  const c0 = Math.max(0, Math.min(h.cols - 2, Math.floor(fc)));
  const r0 = Math.max(0, Math.min(h.rows - 2, Math.floor(fr)));
  const tx = Math.max(0, Math.min(1, fc - c0));
  const tz = Math.max(0, Math.min(1, fr - r0));
  const v = (r: number, c: number): number => {
    const raw = d.cells[r * h.cols + c] ?? 0;
    return raw === 0 ? Number.NaN : raw * h.scale + h.offset;
  };
  const top = v(r0, c0) * (1 - tx) + v(r0, c0 + 1) * tx;
  const bottom = v(r0 + 1, c0) * (1 - tx) + v(r0 + 1, c0 + 1) * tx;
  return top * (1 - tz) + bottom * tz;
};

/** EU-DEM fallback: heights above sea level on a lattice in world metres. */
export interface Lattice {
  readonly source: string;
  readonly originX: number;
  readonly originZ: number;
  readonly step: number;
  readonly cols: number;
  readonly rows: number;
  readonly heights: readonly number[];
}

export const latticeAt = (l: Lattice, p: Pt): number => {
  const fx = Math.max(0, Math.min(l.cols - 1, (p.x - l.originX) / l.step));
  const fz = Math.max(0, Math.min(l.rows - 1, (p.z - l.originZ) / l.step));
  const c0 = Math.min(Math.floor(fx), l.cols - 2);
  const r0 = Math.min(Math.floor(fz), l.rows - 2);
  const tx = fx - c0;
  const tz = fz - r0;
  const h = (r: number, c: number) => l.heights[r * l.cols + c] ?? Number.NaN;
  return (h(r0, c0) * (1 - tx) + h(r0, c0 + 1) * tx) * (1 - tz) + (h(r0 + 1, c0) * (1 - tx) + h(r0 + 1, c0 + 1) * tx) * tz;
};

/** Height above sea level at a world point: the NMT where it has data, else the EU-DEM lattice. */
export type HeightSource = (p: Pt) => number;

export const heightSource = (dtms: readonly Dtm[], fallback: Lattice | null): HeightSource => (p) => {
  const g = worldToPuwg(p);
  for (const d of dtms) {
    const h = dtmAtGrid(d, g);
    if (Number.isFinite(h)) return h;
  }
  if (fallback) return latticeAt(fallback, p);
  throw new Error(`no terrain at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`);
};
