/**
 * Game world ↔ PUWG 1992 (EPSG:2180) for the GUGiK sets (ADR-0077). The forward map is the
 * importer's own (`tools/osm-import/src/project.ts`: world → WGS84 around `LUBLIN_ANCHOR`, then
 * the Krüger series), so the extracts land exactly where `pnpm osm:build` puts the buildings.
 * The inverse is a Newton iteration on it, started from its local similarity (`puwgFrame`):
 * three steps bring it under a millimetre over the whole map.
 *
 * Axis order in the GUGiK GML and GPKG files: easting first, then northing (744 600, 369 600
 * around Lublin), heights in metres (LoD1 2024: PL-EVRF2007-NH, LoD2 2017: PL-KRON86-NH).
 */
import { type Pt } from "../../osm-import/src/geometry.ts";
import { puwgFrame, worldToPuwg } from "../../osm-import/src/project.ts";

const FRAME = puwgFrame();
const GAMMA = (FRAME.gammaDeg * Math.PI) / 180;
const COS = Math.cos(GAMMA) / FRAME.scale;
const SIN = Math.sin(GAMMA) / FRAME.scale;

/** World metres (x east, z north) of a PUWG 1992 point given as easting `e`, northing `n`. */
export const puwgToWorld = (e: number, n: number): Pt => {
  // Undo the similarity (e, n) = origin + scale · R(γ) · (x, z), then refine on the exact map.
  let x = COS * (e - FRAME.origin.e) + SIN * (n - FRAME.origin.n);
  let z = -SIN * (e - FRAME.origin.e) + COS * (n - FRAME.origin.n);
  for (let i = 0; i < 3; i++) {
    const p = worldToPuwg({ x, z });
    const de = e - p.e;
    const dn = n - p.n;
    x += COS * de + SIN * dn;
    z += -SIN * de + COS * dn;
  }
  return { x, z };
};

/** PUWG 1992 easting and northing of a world point. */
export const worldToEn = (p: Pt): { e: number; n: number } => {
  const g = worldToPuwg(p);
  return { e: g.e, n: g.n };
};

/** The transform for reports and the extracts' headers. */
export const frameInfo = () => ({
  crs: "EPSG:2180",
  axes: "easting, northing",
  world: "x east, z north, metres around LUBLIN_ANCHOR (tools/osm-import/src/project.ts)",
  origin: { e: Math.round(FRAME.origin.e * 100) / 100, n: Math.round(FRAME.origin.n * 100) / 100 },
  gammaDeg: Math.round(FRAME.gammaDeg * 1e5) / 1e5,
  scale: Math.round(FRAME.scale * 1e7) / 1e7,
});
