/**
 * Coordinates (ADR-0042): geographic WGS84/ETRS89 to world metres around `LUBLIN_ANCHOR`
 * (equirectangular on the anchor's radii of curvature; x east, z north) and to the Polish grid
 * PUWG 1992 (EPSG:2180, transverse Mercator on GRS80) the GUGiK terrain model is served in.
 */
import { LUBLIN_ANCHOR, type GeoAnchor } from "../../../packages/core/src/world/city-geo.ts";
import { type Pt } from "./geometry.ts";

const A = 6378137;
const F = 1 / 298.257222101;
const E2 = F * (2 - F);
const RAD = Math.PI / 180;

/** Metres per radian of latitude (meridian) and of longitude (prime vertical × cos φ) at `anchor`. */
const radii = (anchor: GeoAnchor) => {
  const s = Math.sin(anchor.lat * RAD);
  const w = Math.sqrt(1 - E2 * s * s);
  const m = (A * (1 - E2)) / (w * w * w);
  const n = A / w;
  return { m, n: n * Math.cos(anchor.lat * RAD) };
};

export const geoToWorld = (lat: number, lon: number, anchor: GeoAnchor = LUBLIN_ANCHOR): Pt => {
  const r = radii(anchor);
  return { x: (lon - anchor.lon) * RAD * r.n, z: (lat - anchor.lat) * RAD * r.m };
};

export const worldToGeo = (p: Pt, anchor: GeoAnchor = LUBLIN_ANCHOR): { lat: number; lon: number } => {
  const r = radii(anchor);
  return { lat: anchor.lat + p.z / r.m / RAD, lon: anchor.lon + p.x / r.n / RAD };
};

/** PUWG 1992 grid coordinates: `n` northing (the grid's x), `e` easting (the grid's y). */
export interface Puwg {
  readonly n: number;
  readonly e: number;
}

const K0 = 0.9993;
const LON0 = 19 * RAD;
const FE = 500000;
const FN = -5300000;
const N3 = F / (2 - F);
const AR = (A / (1 + N3)) * (1 + (N3 * N3) / 4 + N3 ** 4 / 64);
const ALPHA = [N3 / 2 - (2 * N3 * N3) / 3 + (5 * N3 ** 3) / 16, (13 * N3 * N3) / 48 - (3 * N3 ** 3) / 5, (61 * N3 ** 3) / 240];

/** Geographic (GRS80) to PUWG 1992, Krüger series (sub-millimetre in Poland). */
export const geoToPuwg = (lat: number, lon: number): Puwg => {
  const phi = lat * RAD;
  const dl = lon * RAD - LON0;
  const c = (2 * Math.sqrt(N3)) / (1 + N3);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - c * Math.atanh(c * Math.sin(phi)));
  const xi = Math.atan(t / Math.cos(dl));
  const eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
  let e = eta;
  let n = xi;
  for (let j = 0; j < 3; j++) {
    const k = 2 * (j + 1);
    e += ALPHA[j]! * Math.cos(k * xi) * Math.sinh(k * eta);
    n += ALPHA[j]! * Math.sin(k * xi) * Math.cosh(k * eta);
  }
  return { n: K0 * AR * n + FN, e: K0 * AR * e + FE };
};

export const worldToPuwg = (p: Pt, anchor: GeoAnchor = LUBLIN_ANCHOR): Puwg => {
  const g = worldToGeo(p, anchor);
  return geoToPuwg(g.lat, g.lon);
};

/**
 * The world-to-PUWG map near the anchor as a similarity: (e, n) = origin + scale · R(γ) · (x, z),
 * R(γ) a counter-clockwise turn by the meridian convergence γ: east of the central meridian
 * 19° E grid north lies γ east of true north (about 2.78° at the anchor). Measured by finite differences; used for reports and as a check.
 */
export const puwgFrame = (anchor: GeoAnchor = LUBLIN_ANCHOR) => {
  const o = worldToPuwg({ x: 0, z: 0 }, anchor);
  const ex = worldToPuwg({ x: 100, z: 0 }, anchor);
  const gamma = Math.atan2(ex.n - o.n, ex.e - o.e);
  const scale = Math.hypot(ex.n - o.n, ex.e - o.e) / 100;
  return { origin: o, gammaDeg: gamma / RAD, scale };
};
