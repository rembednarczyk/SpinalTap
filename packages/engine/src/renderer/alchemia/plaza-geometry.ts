import type { GroundPoint, Vec3 } from "@seki/core";
import type { AlchemiaPiece } from "@seki/sim";
import { type CityKitData, type GeometrySink, swatchUv } from "../city-kit-data";
import { band, lid } from "./storey-facade";

/*
 * The square before Alchemia's front (C5 of the board 1:1, 19.11) as the board draws what the
 * simulation gives as flat outlines: an umbrella's canopy (an octagon) as a low cone over its rim with
 * a hanging valance, a kiosk's awning (a quad, its first edge against the kiosk) as a sheet sloping
 * down and out from under the roof. Pure data, no Babylon.
 */

type P2 = GroundPoint;

const at = (p: P2, y: number): Vec3 => ({ x: p.x, y, z: p.z });

const cross = (a: Vec3, b: Vec3, c: Vec3): Vec3 => {
  const [ux, uy, uz] = [b.x - a.x, b.y - a.y, b.z - a.z];
  const [vx, vy, vz] = [c.x - a.x, c.y - a.y, c.z - a.z];
  const n = { x: uy * vz - uz * vy, y: uz * vx - ux * vz, z: ux * vy - uy * vx };
  const len = Math.hypot(n.x, n.y, n.z) || 1;
  return { x: n.x / len, y: n.y / len, z: n.z / len };
};

const flip = (n: Vec3): Vec3 => ({ x: -n.x, y: -n.y, z: -n.z });

/** The valance hanging round an umbrella's rim, its depth. */
const VALANCE = 0.12;

/** An umbrella's canopy over its outline: a cone from the rim at y0 to the apex at y1 over the middle, its underside, a valance round the rim. */
const canopy = (sink: GeometrySink, data: CityKitData, pts: readonly P2[], y0: number, y1: number): void => {
  const uv = swatchUv(data, "paint");
  const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
  const apex = at(c, y1);
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    const [a, b] = [at(p, y0), at(q, y0)];
    const n = cross(a, b, apex);
    sink.quad(a, b, apex, apex, n.y > 0 ? n : flip(n), uv);
  });
  lid(sink, pts, y0, -1, swatchUv(data, "trim-light"));
  band(sink, pts, y0 - VALANCE, y0, uv);
};

/** A kiosk's awning: its outline's first edge at y1 against the kiosk, the opposite one at y0 out over the paving; both sides drawn. */
const awning = (sink: GeometrySink, data: CityKitData, pts: readonly P2[], y0: number, y1: number): void => {
  if (pts.length !== 4) return;
  const [p0, p1, p2, p3] = [at(pts[0]!, y1), at(pts[1]!, y1), at(pts[2]!, y0), at(pts[3]!, y0)];
  const up = cross(p0, p1, p2);
  const n = up.y >= 0 ? up : flip(up);
  sink.quad(p0, p1, p2, p3, n, swatchUv(data, "trim-light"));
  sink.quad(p3, p2, p1, p0, flip(n), swatchUv(data, "win-white"));
  // A strip of light along its low edge, as under the board's awnings.
  sink.quad(at(pts[3]!, y0 - 0.06), at(pts[2]!, y0 - 0.06), p2, p3, { x: 0, y: -1, z: 0 }, swatchUv(data, "win-warm"));
};

/** Draws a piece of the square the way only the eye needs it; false when it is not one. */
export const plazaPiece = (sink: GeometrySink, data: CityKitData, p: AlchemiaPiece): boolean => {
  const pts = p.outline;
  if (!pts) return false;
  if (p.kind === "umbrella") canopy(sink, data, pts, p.box.y0, p.box.y1);
  else if (p.kind === "awning") awning(sink, data, pts, p.box.y0, p.box.y1);
  else return false;
  return true;
};
