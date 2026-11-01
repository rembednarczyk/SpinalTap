import { VEHICLE_SIZE, type VehicleModel } from "@seki/core";
import { furnitureNear } from "./furniture-index";
import { inRing, stripCut } from "./kerb-bays";
import { distanceToPiece } from "./lublin/furniture";
import type { Pt } from "./lublin/roads";
import { MAP_CHUNKS } from "./lublin/sites";
import { footprint, inside, segmentDistance, segmentsGap } from "./parked-geometry";
import { pointAt, projectOn } from "./traffic";

/**
 * The room a parked car's body keeps from the street furniture, the service roads and the
 * footways of the map. A car in a kerb car park (its `strip`, the outline the map draws) keeps
 * from what stands beyond the strip's kerb only the room the kerb leaves it (G-189): in Lublin
 * the parking meter and the pavement's footway stand just past the kerb of the strip
 * (Radziwiłłowska, T-104), and the full room would keep a car's nose a metre off the kerb, out
 * of its bay.
 */

/**
 * Room a parked car's body leaves the axis of an unnamed service road (a driveway, a yard's lane,
 * G-140): its half width and this gap (m). No lane of the game runs there, so nothing else keeps
 * the car off its mouth at the kerb.
 */
const SERVICE_GAP = 0.5;
/**
 * Least room a parked car's body leaves the axis of a footway or a path mapped on its own (m), or
 * its half width when wider (G-143). It is drawn over the asphalt where it meets a street, and the
 * paving check takes it for the carriageway.
 */
const FOOT_CLEAR = 1.25;
/** Least room a car's body leaves the axis of a footway past its strip's kerb (m): a metre keeps the walkers' way free, and a tenth more the footway's axis as the import simplifies it. */
const FOOT_AT_KERB = 1.1;
/** Room a parked car's side keeps from a piece of furniture beyond half its width (m). */
const FURNITURE_GAP = 0.3;

/** A kept way's axis, the room a car's body leaves it, and the least it leaves it from past a strip's kerb (Infinity: the full room). */
const wayRoom = (w: { readonly line: readonly number[] }, reach: number, atKerb: number) => {
  const pts = Array.from({ length: w.line.length / 2 }, (_, i): Pt => [w.line[2 * i]!, w.line[2 * i + 1]!]);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { pts, reach, atKerb, minX: Math.min(...xs) - reach, maxX: Math.max(...xs) + reach, minZ: Math.min(...zs) - reach, maxZ: Math.max(...zs) + reach };
};
const KEPT_WAYS = [
  ...MAP_CHUNKS.flatMap((c) => c.serviceWays ?? []).map((w) => wayRoom(w, w.width / 2 + SERVICE_GAP, Infinity)),
  ...MAP_CHUNKS.flatMap((c) => c.footWays ?? []).map((w) => wayRoom(w, Math.max(FOOT_CLEAR, w.width / 2), FOOT_AT_KERB)),
];

const edges = (poly: readonly Pt[]): [Pt, Pt][] => poly.map((a, i) => [a, poly[(i + 1) % poly.length]!]);
const ringDistance = (q: Pt, ring: readonly Pt[]): number => Math.min(...edges(ring).map(([a, b]) => segmentDistance(q[0], q[1], a, b)));

/** A kerb car park's outline and the street (its axis, and its side of it) whose kerb it runs along. */
export interface KerbStrip {
  readonly ring: readonly Pt[];
  readonly axis: readonly Pt[];
  readonly side: 1 | -1;
}

/**
 * The room a car in a strip keeps from a point beyond its kerb (outside the outline and farther
 * from the street than the outline reaches across it there): as much as the point keeps from the
 * outline, so the car may stand at the kerb but not over it. Infinity for any other point.
 */
const roomBeyond = (q: Pt, strip: KerbStrip | undefined): number => {
  if (!strip || inRing(q[0], q[1], strip.ring)) return Infinity;
  const on = projectOn(strip.axis, q[0], q[1]);
  if (Math.sign(on.side) !== strip.side) return Infinity;
  const p = pointAt(strip.axis, on.s);
  const cut = stripCut(strip.ring, (d) => ({ x: p.x + p.tz * strip.side * d, z: p.z - p.tx * strip.side * d }), on.d);
  return cut && cut.to < on.d ? ringDistance(q, strip.ring) : Infinity;
};

/** The point of segment ab nearest (x, z). */
const nearestOn = (a: Pt, b: Pt, x: number, z: number): Pt => {
  const [dx, dz] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return [a[0] + dx * t, a[1] + dz * t];
};

/**
 * Does a car's footprint at (x, z), facing yaw, keep its room off every service road's and
 * footway's axis? In a kerb car park, a footway past the kerb only asks the room `roomBeyond`
 * gives, and `FOOT_AT_KERB`; a service road there still asks its own (a driveway's mouth).
 */
export const clearOfKeptWays = (x: number, z: number, yaw: number, model: VehicleModel, strip?: KerbStrip): boolean => {
  const corners = footprint(x, z, yaw, model, 0);
  const body = edges(corners);
  const r = Math.hypot(VEHICLE_SIZE[model].width, VEHICLE_SIZE[model].length) / 2;
  const clear = (a: Pt, b: Pt, w: (typeof KEPT_WAYS)[number]) => {
    const gap = Math.min(...body.map(([c, d]) => segmentsGap(a, b, c, d)));
    return gap >= w.reach || gap >= Math.max(w.atKerb, roomBeyond(nearestOn(a, b, x, z), strip));
  };
  return KEPT_WAYS.every(
    (w) =>
      x + r < w.minX ||
      x - r > w.maxX ||
      z + r < w.minZ ||
      z - r > w.maxZ ||
      (!w.pts.some((p) => inside(p, corners)) && w.pts.every((p, i) => i === 0 || clear(w.pts[i - 1]!, p, w))),
  );
};

/**
 * Does a car at (x, z), facing yaw, keep off every piece of solid furniture: its axis (its back,
 * middle and front) half its width and `FURNITURE_GAP` from each, or, in a kerb car park, its body
 * the room `roomBeyond` asks from a piece wholly beyond the strip's kerb?
 */
export const clearOfFurniture = (x: number, z: number, yaw: number, model: VehicleModel, strip?: KerbStrip): boolean => {
  const { width, length } = VEHICLE_SIZE[model];
  const room = width / 2 + FURNITURE_GAP;
  const axis = [-0.5, 0, 0.5].map((t): Pt => [x + Math.sin(yaw) * length * t, z + Math.cos(yaw) * length * t]);
  const body = footprint(x, z, yaw, model, 0);
  return furnitureNear(x, z).every((f) => {
    if (Math.hypot(f.x - x, f.z - z) - f.r >= length / 2 + room || axis.every(([px, pz]) => distanceToPiece(f.item, px, pz) >= room)) return true;
    const kept = roomBeyond([f.x, f.z], strip) - f.r;
    return kept > 0 && !inside([f.x, f.z], body) && ringDistance([f.x, f.z], body) - f.r >= kept;
  });
};
