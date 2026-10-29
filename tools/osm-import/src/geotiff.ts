/**
 * Minimal GeoTIFF reader for the GUGiK terrain model (WCS GetCoverage): little- or big-endian,
 * one band, float32, uncompressed, in strips, with ModelTiepoint and ModelPixelScale. Anything
 * else is refused, so a format change on the server shows up instead of producing garbage.
 */

export interface Raster {
  readonly width: number;
  readonly height: number;
  /** Grid easting of the left edge of column 0 and northing of the top edge of row 0 (EPSG:2180). */
  readonly e0: number;
  readonly n0: number;
  readonly step: number;
  /** Row-major, row 0 north. */
  readonly values: Float32Array;
}

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8 };

export const readGeoTiff = (buf: Uint8Array): Raster => {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const le = buf[0] === 0x49 && buf[1] === 0x49;
  if (!le && !(buf[0] === 0x4d && buf[1] === 0x4d)) throw new Error("not a TIFF");
  if (dv.getUint16(2, le) !== 42) throw new Error("not a classic TIFF");
  const ifd = dv.getUint32(4, le);
  const count = dv.getUint16(ifd, le);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    const tag = dv.getUint16(e, le);
    const type = dv.getUint16(e + 2, le);
    const n = dv.getUint32(e + 4, le);
    const size = (TYPE_SIZE[type] ?? 1) * n;
    const at = size <= 4 ? e + 8 : dv.getUint32(e + 8, le);
    const vals: number[] = [];
    for (let k = 0; k < n && type !== 2; k++) {
      const o = at + k * (TYPE_SIZE[type] ?? 1);
      if (type === 3) vals.push(dv.getUint16(o, le));
      else if (type === 4) vals.push(dv.getUint32(o, le));
      else if (type === 12) vals.push(dv.getFloat64(o, le));
      else if (type === 11) vals.push(dv.getFloat32(o, le));
      else if (type === 1) vals.push(dv.getUint8(o));
    }
    tags.set(tag, vals);
  }
  const one = (t: number, def?: number): number => {
    const v = tags.get(t)?.[0] ?? def;
    if (v === undefined) throw new Error(`TIFF tag ${t} missing`);
    return v;
  };
  const width = one(256);
  const height = one(257);
  if (one(258) !== 32 || one(339, 1) !== 3) throw new Error("expected float32 samples");
  if (one(259, 1) !== 1) throw new Error("compressed TIFF not supported");
  if (one(277, 1) !== 1) throw new Error("expected one band");
  if (tags.has(322)) throw new Error("tiled TIFF not supported");
  const offsets = tags.get(273) ?? [];
  const rowsPerStrip = one(278, height);
  const tie = tags.get(33922);
  const scale = tags.get(33550);
  if (!tie || !scale || tie[0] !== 0 || tie[1] !== 0) throw new Error("expected a tiepoint at pixel (0, 0)");
  if (scale[0] !== scale[1]) throw new Error("expected square pixels");
  const values = new Float32Array(width * height);
  for (let s = 0; s < offsets.length; s++) {
    const first = s * rowsPerStrip;
    const rows = Math.min(rowsPerStrip, height - first);
    for (let k = 0; k < rows * width; k++) values[first * width + k] = dv.getFloat32(offsets[s]! + k * 4, le);
  }
  return { width, height, e0: tie[3]!, n0: tie[4]!, step: scale[0]!, values };
};
