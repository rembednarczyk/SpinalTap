import { ZEBRA_STRIPE } from "../../../packages/engine/src/renderer/mapcity/crossing-plan";
import { type Obb, type P2, orientedBox, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { GroundIndex, type Piece } from "./ground-index";
import type { GroundChunk } from "./ground-strips";

/**
 * The shape of the zebras the game draws (`crossing-shape-skew`, `-overhang`, `-glow` and `-kerb`, the
 * user's question of 15.11). `planCrossing` lays its stripes in the oriented box of the crossing
 * piece's outline (the long side across the road, `ZEBRA_STRIPE` stripes and gaps from kerb to
 * kerb, `KERB_GAP` short of each), so the piece must be that box: a rectangle across the road.
 * - skew: the box's long axis off the perpendicular to the street's axis by more than `SKEW`;
 *   a carriageway zebra only (its middle within `ON_STREET` of a car street's axis, 2.5 m and more
 *   across), and not at a junction of streets bending 30 degrees apart where "the street" is none.
 * - overhang: stripes lying more than `BEYOND` outside the piece's outline, `OVER_AREA` m² and more.
 * - glow: the cyan edge lines `GLOW_OFF` m and more off the carriageway, cobbles and squares (on a sidewalk, a lawn or nothing).
 * - kerb: the zebra's end more than `KERB_TOL` from the kerb (where the carriageway and the
 *   crossing end along the zebra's axis, probed at the middle and at 0.8 of either side).
 */

type Finding = { readonly at: string; readonly what: string };
type Pt = readonly [number, number];

export const SKEW = 5;
export const ON_STREET = 1.5;
export const BEYOND = 0.15;
export const OVER_AREA = 0.3;
export const GLOW_OFF = 3;
export const KERB_TOL = 0.15;
/** A zebra's stripes stop this short of the kerbs, and the glow stands this far off its side (`crossing-plan.ts`). */
const KERB_GAP = 0.25;
const GLOW_AT = 0.12;
/** The surfaces a zebra's edge line may lie on: the carriageway and the squares and setts a zebra crosses. */
const DRIVEN: ReadonlySet<string> = new Set(["road", "crossing", "cobble", "square"]);
const PROBE = 0.05;
const FAR = 40;

const at1 = (b: Obb) => `${b.cx.toFixed(1)},${b.cz.toFixed(1)}`;
const local = (b: Obb, u: number, v: number): P2 => ({ x: b.cx + b.ux * u - b.uz * v, z: b.cz + b.uz * u + b.ux * v });

const edgeDistance = (ring: readonly P2[], p: P2): number => {
  let m = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    m = Math.min(m, Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz));
  }
  return m;
};

const crossings = (index: GroundIndex): { piece: Piece; box: Obb }[] =>
  index.pieces.filter((p) => p.surface === "crossing").map((piece) => ({ piece, box: orientedBox(piece.ring) }));

/** The street axis nearest the point: its distance and the unit tangent there. */
const nearestAxis = (streets: readonly (readonly Pt[])[], x: number, z: number, within: number): { d: number; tx: number; tz: number }[] => {
  const out: { d: number; tx: number; tz: number }[] = [];
  for (const s of streets) {
    let best: { d: number; tx: number; tz: number } | null = null;
    for (let i = 0; i + 1 < s.length; i++) {
      const [ax, az] = s[i]!;
      const [bx, bz] = s[i + 1]!;
      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (len * len)));
      const d = Math.hypot(x - ax - t * dx, z - az - t * dz);
      if (d <= within && (!best || d < best.d)) best = { d, tx: dx / len, tz: dz / len };
    }
    if (best) out.push(best);
  }
  return out.sort((a, b) => a.d - b.d);
};

/** A carriageway zebra whose long axis is off the perpendicular to its street by more than `SKEW` degrees. */
export const crossingSkew = (chunks: readonly GroundChunk[], streets: readonly (readonly Pt[])[]): Finding[] =>
  crossings(new GroundIndex(chunks)).flatMap(({ box }) => {
    if (box.halfLong < 2.5) return [];
    const axes = nearestAxis(streets, box.cx, box.cz, 3);
    const first = axes[0];
    if (!first || first.d >= ON_STREET) return [];
    const angle = (a: { tx: number; tz: number }) => Math.abs(90 - (Math.acos(Math.min(1, Math.abs(box.ux * a.tx + box.uz * a.tz))) * 180) / Math.PI);
    const bends = axes.some((a) => Math.abs(Math.acos(Math.min(1, Math.abs(a.tx * first.tx + a.tz * first.tz))) * (180 / Math.PI)) > 30);
    const skew = angle(first);
    return skew > SKEW && !bends ? [{ at: at1(box), what: `zebra ${skew.toFixed(1)} degrees off the perpendicular to its street` }] : [];
  });

/** What of a zebra lies outside its piece: stripes by what is under them (m2), edge line off the driven surfaces (m). */
const beyond = (index: GroundIndex, piece: Piece, box: Obb) => {
  const across = box.halfLong - KERB_GAP;
  if (across <= ZEBRA_STRIPE || box.halfShort < 0.5) return null;
  const count = Math.floor((2 * across + ZEBRA_STRIPE) / (2 * ZEBRA_STRIPE));
  const start = -((count * 2 - 1) * ZEBRA_STRIPE) / 2;
  const under: Record<string, number> = {};
  let area = 0;
  for (let k = 0; k < count; k++) {
    const u0 = start + k * 2 * ZEBRA_STRIPE;
    for (let u = u0 + 0.05; u < u0 + ZEBRA_STRIPE; u += 0.1) {
      for (let v = -box.halfShort + 0.05; v < box.halfShort; v += 0.1) {
        const p = local(box, u, v);
        if (pointInRing(p, piece.ring) || edgeDistance(piece.ring, p) <= BEYOND) continue;
        const on = index.at(p.x, p.z).filter((s) => s !== "crossing");
        const key = on.length ? on[0]! : "none";
        under[key] = (under[key] ?? 0) + 0.01;
        area += 0.01;
      }
    }
  }
  const glowUnder: Record<string, number> = {};
  let glow = 0;
  for (const side of [-1, 1]) {
    for (let u = -across; u <= across; u += 0.1) {
      const p = local(box, u, side * (box.halfShort + GLOW_AT));
      const on = index.at(p.x, p.z);
      if (on.some((q) => DRIVEN.has(q))) continue;
      glow += 0.1;
      const key = on.length ? on[0]! : "none";
      glowUnder[key] = (glowUnder[key] ?? 0) + 0.1;
    }
  }
  return { area, under, glow, glowUnder };
};

const listed = (m: Record<string, number>) => Object.entries(m).map(([s, a]) => `${s} ${a.toFixed(1)}`).join(", ");

/** A zebra whose stripes lie `OVER_AREA` m2 and more outside its piece (the box of its outline is wider than the piece). */
export const crossingOverhang = (chunks: readonly GroundChunk[]): Finding[] => {
  const index = new GroundIndex(chunks);
  return crossings(index).flatMap(({ piece, box }) => {
    const o = beyond(index, piece, box);
    return o && o.area >= OVER_AREA ? [{ at: at1(box), what: `zebra stripes ${o.area.toFixed(1)} m2 beyond its piece (${listed(o.under)})` }] : [];
  });
};

/** A zebra whose cyan edge lines lie `GLOW_OFF` m and more off the carriageway, cobbles and squares (on a sidewalk, a lawn or nothing). */
export const crossingGlow = (chunks: readonly GroundChunk[]): Finding[] => {
  const index = new GroundIndex(chunks);
  return crossings(index).flatMap(({ piece, box }) => {
    const o = beyond(index, piece, box);
    return o && o.glow >= GLOW_OFF ? [{ at: at1(box), what: `zebra edge glow ${o.glow.toFixed(1)} m off the carriageway (${listed(o.glowUnder)})` }] : [];
  });
};

/** A zebra whose end lies more than `KERB_TOL` from the kerb along its axis. */
export const crossingKerb = (chunks: readonly GroundChunk[]): Finding[] => {
  const index = new GroundIndex(chunks);
  return crossings(index).flatMap(({ box }) => {
    if (box.halfLong < 2) return [];
    const exit = (sign: number, v: number): number => {
      for (let d = 0; d < FAR; d += PROBE) {
        const p = local(box, sign * d, v);
        if (!index.roadAt(p.x, p.z)) return d;
      }
      return FAR;
    };
    let worst = 0;
    for (const sign of [-1, 1]) {
      for (const v of [0, box.halfShort * 0.8, -box.halfShort * 0.8]) {
        const d = exit(sign, v);
        if (d < FAR) worst = Math.max(worst, Math.abs(d - box.halfLong));
      }
    }
    return worst > KERB_TOL ? [{ at: at1(box), what: `zebra end ${worst.toFixed(2)} m off the kerb` }] : [];
  });
};
