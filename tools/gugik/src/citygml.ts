/**
 * A small reader of the GUGiK CityGML 2.0 building files (ADR-0077), as plain text: it never
 * resolves entities, schemas or links, it only cuts `<bldg:Building>` elements and reads the
 * attributes and coordinates the extracts need. Coordinates stay in the file's grid (EPSG:2180,
 * easting first) with heights; `frame.ts` maps them to the world.
 *
 * - LoD1 2024 (`lod1Solid`): a prism; the footprint is the face whose points all lie at the
 *   lowest height, `measuredHeight` the prism's height.
 * - LoD2 2017 (`boundedBy` surfaces): the footprint is the `GroundSurface`, the eaves the
 *   lowest and the ridge the highest point of the `RoofSurface`s, `roofType` the roof's code,
 *   the main eaves and ridge those of the main mass (`mainRoof`).
 */

/** A ring of grid points: easting, northing, height. */
export type Ring3 = readonly (readonly [number, number, number])[];

export interface GmlBuilding {
  /** BDOT10k building id (`buildingId`, a UUID). */
  readonly id: string;
  /** Exterior rings of the footprint (more than one when the ground is split). */
  readonly footprint: readonly Ring3[];
  readonly ground: number;
  readonly measuredHeight?: number;
  readonly roofType?: number;
  /** LoD2: lowest and highest point of the roof surfaces, metres above sea level. */
  readonly eaves?: number;
  readonly ridge?: number;
  /** LoD2: the main mass's roof (`mainRoof`), heights in metres above sea level. */
  readonly main?: MainRoof;
  /** LoD1: top of the prism, metres above sea level. */
  readonly top?: number;
}

const BUILDING_OPEN = "<bldg:Building ";
const BUILDING_CLOSE = "</bldg:Building>";

/** Each `<bldg:Building …>…</bldg:Building>` element of a file, as text. */
export function* buildingElements(xml: string): Generator<string> {
  let at = 0;
  for (;;) {
    const start = xml.indexOf(BUILDING_OPEN, at);
    if (start < 0) return;
    const end = xml.indexOf(BUILDING_CLOSE, start);
    if (end < 0) return;
    yield xml.slice(start, end + BUILDING_CLOSE.length);
    at = end + BUILDING_CLOSE.length;
  }
}

const attr = (el: string, name: string): string | undefined => new RegExp(`name="${name}">\\s*<gen:value>([^<]*)</gen:value>`).exec(el)?.[1]?.trim();

const num = (el: string, tag: string): number | undefined => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*([-0-9.eE+]+)\\s*</${tag}>`).exec(el);
  return m ? Number(m[1]) : undefined;
};

/** Points of a ring: one `posList` or a run of `pos`. */
const ringPoints = (ring: string): Ring3 => {
  const values: number[] = [];
  for (const m of ring.matchAll(/<gml:pos(?:List)?(?:\s[^>]*)?>([^<]*)<\/gml:pos(?:List)?>/g)) for (const v of m[1]!.trim().split(/\s+/)) values.push(Number(v));
  const pts: [number, number, number][] = [];
  for (let i = 0; i + 2 < values.length; i += 3) pts.push([values[i]!, values[i + 1]!, values[i + 2]!]);
  return pts;
};

/** Exterior rings of all polygons in a piece of GML (interior rings, the holes, are skipped). */
export const exteriorRings = (gml: string): Ring3[] => {
  const rings: Ring3[] = [];
  for (const m of gml.matchAll(/<gml:exterior>\s*<gml:LinearRing(?:\s[^>]*)?>([\s\S]*?)<\/gml:LinearRing>/g)) {
    const pts = ringPoints(m[1]!);
    if (pts.length >= 3) rings.push(pts);
  }
  return rings;
};

/** The pieces of an element under one kind of `boundedBy` surface (`RoofSurface`, `GroundSurface`). */
const surfaces = (el: string, kind: string): string[] => [...el.matchAll(new RegExp(`<bldg:${kind}[\\s>][\\s\\S]*?</bldg:${kind}>`, "g"))].map((m) => m[0]);

const zRange = (rings: readonly Ring3[]) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of rings)
    for (const p of r) {
      lo = Math.min(lo, p[2]);
      hi = Math.max(hi, p[2]);
    }
  return { lo, hi };
};

/** One building element of a LoD1 2024 file. */
export const parseLod1 = (el: string): GmlBuilding | undefined => {
  const id = attr(el, "buildingId");
  const rings = exteriorRings(el);
  if (!id || rings.length === 0) return undefined;
  const { lo, hi } = zRange(rings);
  const footprint = rings.filter((r) => r.every((p) => Math.abs(p[2] - lo) < 0.005));
  const mh = num(el, "bldg:measuredHeight");
  return { id, footprint: footprint.length ? footprint : [rings[0]!], ground: lo, top: hi, ...(mh !== undefined ? { measuredHeight: mh } : {}) };
};

/** A point's key at a centimetre: surfaces of one shell share their edges' points exactly. */
const pointKey = (p: readonly [number, number, number]) => `${p[0].toFixed(2)} ${p[1].toFixed(2)} ${p[2].toFixed(2)}`;

const planArea = (r: Ring3) => {
  let a = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

/** A roof surface too small to set the main mass's eaves: under this plan area, m² (G-639). */
const SLIVER_AREA = 5;
/** …or under this share of the largest surface's plan area. */
const SLIVER_SHARE = 0.02;
/** A surface flatter than this (rise over run) gives no ridge direction. */
const MIN_SLOPE = 0.09;

/** The horizontal part of a ring's normal (Newell), pointing down the slope; its length the slope's sine. */
const downslope = (r: Ring3): { readonly e: number; readonly n: number; readonly slope: number } => {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < r.length; i++) {
    const p = r[i]!;
    const q = r[(i + 1) % r.length]!;
    nx += (p[1] - q[1]) * (p[2] + q[2]);
    ny += (p[2] - q[2]) * (p[0] + q[0]);
    nz += (p[0] - q[0]) * (p[1] + q[1]);
  }
  // Facing up: the horizontal part then points down the slope.
  const k = nz < 0 ? -1 : 1;
  const h = Math.hypot(nx, ny);
  return { e: (k * nx) / (h || 1), n: (k * ny) / (h || 1), slope: h / (Math.abs(nz) || 1e-9) };
};

export interface MainRoof {
  /** The lowest point of the shell's surfaces bar slivers (`SLIVER_AREA`, `SLIVER_SHARE`). */
  readonly eaves: number;
  readonly ridge: number;
  /** The lowest point of the whole shell, slivers included. */
  readonly shellEaves: number;
  /** Down the slope of the shell's largest surface (grid east, north), when it slopes: the ridge runs across it. */
  readonly fall?: { readonly e: number; readonly n: number };
}

/**
 * The eaves and the ridge of a roof's main mass (G-639): the lowest and the highest point of the
 * shell of roof surfaces joined edge to edge (two points or more in common) with the surface of
 * the largest plan area. A mansard's steep lower slopes and the slopes of a hipped or a gabled
 * roof join the shell; the roof of a low annex, a porch or a lower wing meets the main mass's
 * walls, not its roof, and stays out (Lublinianka: 4.3 m the annex's eaves; Pałac Parysów:
 * 10.7 m the eaves under its mansard, 15.0 m its break). A sliver of the shell (a dormer's cheek,
 * a gutter's piece) does not set the eaves: kamienica Złota 5 at 11.3 m from 3.1 m², 13.0 m from
 * its slopes. The ridge runs across the fall of the largest surface.
 */
export const mainRoof = (roofs: readonly Ring3[]): MainRoof | undefined => {
  if (roofs.length === 0) return undefined;
  const keys = roofs.map((r) => new Set(r.map(pointKey)));
  const areas = roofs.map(planArea);
  const largest = Math.max(...areas);
  const seed = areas.indexOf(largest);
  const shell = new Set([seed]);
  for (let grown = true; grown; ) {
    grown = false;
    for (let i = 0; i < roofs.length; i++) {
      if (shell.has(i)) continue;
      const touches = [...shell].some((j) => {
        let common = 0;
        for (const k of keys[i]!) if (keys[j]!.has(k) && ++common >= 2) return true;
        return false;
      });
      if (touches) {
        shell.add(i);
        grown = true;
      }
    }
  }
  const all = [...shell];
  const z = zRange(all.map((i) => roofs[i]!));
  const solid = zRange(all.filter((i) => areas[i]! >= SLIVER_AREA && areas[i]! >= SLIVER_SHARE * largest).map((i) => roofs[i]!));
  const d = downslope(roofs[seed]!);
  return { eaves: solid.lo, ridge: z.hi, shellEaves: z.lo, ...(d.slope >= MIN_SLOPE ? { fall: { e: d.e, n: d.n } } : {}) };
};

/** One building element of a LoD2 2017 file. */
export const parseLod2 = (el: string): GmlBuilding | undefined => {
  const id = attr(el, "buildingId");
  const ground = surfaces(el, "GroundSurface").flatMap(exteriorRings);
  const roof = surfaces(el, "RoofSurface").flatMap(exteriorRings);
  if (!id || ground.length === 0) return undefined;
  const g = zRange(ground);
  const r = roof.length ? zRange(roof) : undefined;
  const roofType = num(el, "bldg:roofType");
  const main = mainRoof(roof);
  return { id, footprint: ground, ground: g.lo, ...(roofType !== undefined ? { roofType } : {}), ...(r ? { eaves: r.lo, ridge: r.hi } : {}), ...(main ? { main } : {}) };
};

/** CityGML `RoofTypeType` codes (SIG3D list, used by GUGiK) as OSM `roof:shape` values. */
export const ROOF_TYPES: Readonly<Record<number, string>> = {
  1000: "flat",
  1010: "skillion",
  1020: "double_saltbox",
  1030: "gabled",
  1040: "hipped",
  1050: "half-hipped",
  1060: "mansard",
  1070: "pyramidal",
  1080: "cone",
  1090: "dome",
  1100: "sawtooth",
  1110: "round",
  1120: "pyramidal",
  1130: "combination",
};
