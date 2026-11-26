/**
 * Clipper2 for the streets' ground (ADR-0104): rings in metres to Clipper's integer paths in
 * millimetres and back, and the few operations the model is built of. The same input gives the
 * same paths (ADR-0078).
 */
import { EndType, FillRule, JoinType, type Path64, type Paths64, difference, inflatePaths, intersect, isPositive, union } from "clipper2-ts";
import { type Pt, ccw, pointInRing, signedArea } from "../geometry.ts";
import { cutHoles } from "../ring-holes.ts";

/** Clipper's grid: millimetres. */
export const SCALE = 1000;
/** The most an arc strays from its circle (m). */
const ARC = 0.02;
/** The farthest a mitred corner reaches, in times the offset. */
const MITRE = 3;
/** Holes and outlines smaller than this are dropped (m²). */
const SPECK = 0.01;

export type Area = Paths64;

export const toPath = (line: readonly Pt[]): Path64 => line.map((p) => ({ x: Math.round(p.x * SCALE), y: Math.round(p.z * SCALE) }));
export const toPts = (path: Path64): Pt[] => path.map((p) => ({ x: p.x / SCALE, z: p.y / SCALE }));

/** A ring (either way round) as an area. */
export const areaOfRing = (ring: readonly Pt[]): Area => union([toPath(ring)], FillRule.NonZero);
export const join = (...areas: readonly Area[]): Area => union(areas.flat(), FillRule.NonZero);
export const less = (a: Area, b: Area): Area => (b.length === 0 ? a : difference(a, b, FillRule.NonZero));
export const within = (a: Area, b: Area): Area => (a.length === 0 || b.length === 0 ? [] : intersect(a, b, FillRule.NonZero));

/** The area grown by `d` m (shrunk for negative), round corners. */
export const grown = (a: Area, d: number): Area => (a.length === 0 ? [] : union(inflatePaths(a, d * SCALE, JoinType.Round, EndType.Polygon, MITRE, ARC * SCALE), FillRule.NonZero));

/** The band `half` m each side of an open line, round joins, square ends. */
export const band = (line: readonly Pt[], half: number): Area =>
  line.length < 2 || half <= 0 ? [] : union(inflatePaths([toPath(line)], half * SCALE, JoinType.Round, EndType.Butt, MITRE, ARC * SCALE), FillRule.NonZero);

/** The band of an open line with round ends. */
export const capsule = (line: readonly Pt[], half: number): Area =>
  line.length < 1 || half <= 0 ? [] : union(inflatePaths([toPath(line.length === 1 ? [line[0]!, line[0]!] : line)], half * SCALE, JoinType.Round, EndType.Round, MITRE, ARC * SCALE), FillRule.NonZero);

/** A disc of radius `r` m round `c`. */
export const disc = (c: Pt, r: number): Area => capsule([c], r);

/** The area's size (m²). */
export const sizeOf = (a: Area): number => a.reduce((s, p) => s + signedArea(toPts(p)), 0);

/** An area as rings: each outline with the holes inside it cut in (`cutHoles`), specks dropped. */
export const rings = (a: Area): Pt[][] => {
  const outers = a.filter((p) => isPositive(p)).map(toPts).filter((r) => Math.abs(signedArea(r)) >= SPECK);
  const holes = a.filter((p) => !isPositive(p)).map(toPts).filter((r) => Math.abs(signedArea(r)) >= SPECK);
  const size = outers.map((o) => Math.abs(signedArea(o)));
  const owner = holes.map((h) => outers.reduce((best, o, i) => (pointInRing(h[0]!, o) && (best < 0 || size[i]! < size[best]!) ? i : best), -1));
  return outers.map((o, i) => {
    const inside = holes.filter((_, k) => owner[k] === i);
    return inside.length > 0 ? cutHoles(o, inside) : ccw(o);
  });
};

/** Whether a point lies in the area (NonZero, holes out). */
export const holds = (a: Area, p: Pt): boolean => {
  let wind = 0;
  for (const path of a) if (pointInRing(p, toPts(path))) wind += isPositive(path) ? 1 : -1;
  return wind > 0;
};
