/**
 * The PNG the tool reads and writes, without a library: the WMS's truecolour images (8 bits,
 * RGB or RGBA, or a palette) and the cover rasters (a palette of 4 bits a pixel). No interlace.
 */
import { crc32, deflateSync, inflateSync } from "node:zlib";

const SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

export interface Rgb {
  readonly width: number;
  readonly height: number;
  /** R, G, B a pixel, rows north to south. */
  readonly rgb: Uint8Array;
}

export interface Indexed {
  readonly width: number;
  readonly height: number;
  /** One palette index a pixel. */
  readonly index: Uint8Array;
  /** R, G, B of each index. */
  readonly palette: readonly (readonly [number, number, number])[];
}

interface Chunks {
  readonly ihdr: DataView;
  readonly plte?: Uint8Array;
  readonly trns?: Uint8Array;
  readonly idat: Uint8Array;
}

const readChunks = (bytes: Uint8Array): Chunks => {
  if (!SIGNATURE.every((b, i) => bytes[i] === b)) throw new Error("not a PNG");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const idat: Uint8Array[] = [];
  let ihdr: DataView | undefined;
  let plte: Uint8Array | undefined;
  let trns: Uint8Array | undefined;
  for (let at = 8; at + 8 <= bytes.length; ) {
    const len = dv.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + len);
    if (type === "IHDR") ihdr = new DataView(data.buffer, data.byteOffset, data.byteLength);
    else if (type === "PLTE") plte = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    at += 12 + len;
  }
  if (!ihdr) throw new Error("PNG without IHDR");
  return { ihdr, ...(plte ? { plte } : {}), ...(trns ? { trns } : {}), idat: Buffer.concat(idat) };
};

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const [pa, pb, pc] = [Math.abs(p - a), Math.abs(p - b), Math.abs(p - c)];
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** The scanlines unfiltered: `rows` rows of `stride` bytes, `bpp` bytes a pixel (at least 1). */
const unfilter = (raw: Uint8Array, rows: number, stride: number, bpp: number): Uint8Array => {
  const out = new Uint8Array(rows * stride);
  for (let r = 0; r < rows; r++) {
    const f = raw[r * (stride + 1)]!;
    const src = r * (stride + 1) + 1;
    const dst = r * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i]!;
      const a = i >= bpp ? out[dst + i - bpp]! : 0;
      const b = r > 0 ? out[dst - stride + i]! : 0;
      const c = r > 0 && i >= bpp ? out[dst - stride + i - bpp]! : 0;
      const v = f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b : f === 3 ? x + ((a + b) >> 1) : paeth(a, b, c) + x;
      out[dst + i] = v & 255;
    }
  }
  return out;
};

const header = (c: Chunks) => {
  const h = c.ihdr;
  const [width, height, depth, colour, interlace] = [h.getUint32(0), h.getUint32(4), h.getUint8(8), h.getUint8(9), h.getUint8(12)];
  if (interlace !== 0) throw new Error("interlaced PNG");
  const channels = colour === 2 ? 3 : colour === 6 ? 4 : colour === 3 || colour === 0 ? 1 : colour === 4 ? 2 : 0;
  if (!channels) throw new Error(`PNG colour type ${colour}`);
  if (depth !== 8 && !(colour === 3 && (depth === 1 || depth === 2 || depth === 4))) throw new Error(`PNG bit depth ${depth}, colour type ${colour}`);
  return { width, height, depth, colour, channels };
};

/** Palette indices of an indexed PNG of 1-8 bits a pixel, one byte each. */
const unpack = (data: Uint8Array, width: number, height: number, depth: number): Uint8Array => {
  const stride = Math.ceil((width * depth) / 8);
  const out = new Uint8Array(width * height);
  const per = 8 / depth;
  const mask = (1 << depth) - 1;
  for (let r = 0; r < height; r++)
    for (let x = 0; x < width; x++) {
      const byte = data[r * stride + Math.floor(x / per)]!;
      out[r * width + x] = (byte >> (8 - depth * ((x % per) + 1))) & mask;
    }
  return out;
};

export const decodeIndexed = (bytes: Uint8Array): Indexed => {
  const c = readChunks(bytes);
  const h = header(c);
  if (h.colour !== 3 || !c.plte) throw new Error("not an indexed PNG");
  const data = unfilter(inflateSync(c.idat), h.height, Math.ceil((h.width * h.depth) / 8), 1);
  const palette: [number, number, number][] = [];
  for (let i = 0; i + 2 < c.plte.length; i += 3) palette.push([c.plte[i]!, c.plte[i + 1]!, c.plte[i + 2]!]);
  return { width: h.width, height: h.height, index: unpack(data, h.width, h.height, h.depth), palette };
};

/** Any 8-bit PNG of the WMS as RGB; fully transparent pixels (no image there) come back as 0, 0, 0 with `empty` set. */
export const decodeRgb = (bytes: Uint8Array): Rgb & { readonly empty: Uint8Array } => {
  const c = readChunks(bytes);
  const h = header(c);
  const n = h.width * h.height;
  const rgb = new Uint8Array(n * 3);
  const empty = new Uint8Array(n);
  if (h.colour === 3) {
    const ix = decodeIndexed(bytes);
    for (let i = 0; i < n; i++) {
      const k = ix.index[i]!;
      const p = ix.palette[k] ?? [0, 0, 0];
      rgb.set(p, i * 3);
      if (c.trns && k < c.trns.length && c.trns[k] === 0) empty[i] = 1;
    }
    return { width: h.width, height: h.height, rgb, empty };
  }
  const data = unfilter(inflateSync(c.idat), h.height, h.width * h.channels, h.channels);
  for (let i = 0; i < n; i++) {
    const s = i * h.channels;
    if (h.channels >= 3) rgb.set(data.subarray(s, s + 3), i * 3);
    else rgb.fill(data[s]!, i * 3, i * 3 + 3);
    if ((h.channels === 4 && data[s + 3] === 0) || (h.channels === 2 && data[s + 1] === 0)) empty[i] = 1;
  }
  return { width: h.width, height: h.height, rgb, empty };
};

const chunk = (type: string, data: Uint8Array): Uint8Array => {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(Buffer.from(type, "latin1"), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};

/** An indexed PNG of 4 bits a pixel (at most 16 colours), unfiltered rows, deflate at its best. */
export const encodeIndexed4 = (img: Indexed): Uint8Array => {
  if (img.palette.length > 16) throw new Error("more than 16 colours");
  const stride = Math.ceil(img.width / 2);
  const raw = new Uint8Array(img.height * (stride + 1));
  for (let r = 0; r < img.height; r++)
    for (let x = 0; x < img.width; x++) {
      const v = img.index[r * img.width + x]! & 15;
      raw[r * (stride + 1) + 1 + (x >> 1)]! |= x % 2 === 0 ? v << 4 : v;
    }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, img.width);
  dv.setUint32(4, img.height);
  ihdr.set([4, 3, 0, 0, 0], 8);
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("PLTE", Uint8Array.from(img.palette.flat())), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", new Uint8Array(0))]);
};
