import { DRESS_FLAG, type MeshSink, hexColor } from "../mesh-sink";
import { type HeightAt, drape } from "./ground-plan";
import { type P2, orientedBox } from "./polygon";
import { quadUv } from "./sink-ops";

const TREAD = hexColor("#77736c", DRESS_FLAG.solid);
const RISER = hexColor("#4f4b46", DRESS_FLAG.solid);

/** Depth of one step along the flight, metres (a granite step outdoors). */
export const STEP_DEPTH = 0.33;
/** Treads stand this far above the terrain they follow, like a sidewalk over the road. */
const LIFT = 0.05;
/**
 * The least mean riser of a flight, metres. The terrain model is smoothed (steps and kerbs
 * removed), so a run whose ground climbs less than this per tread has no flight to draw: its
 * risers would be a row of dark lines a centimetre or two high on level paving (G-018).
 */
export const MIN_RISER = 0.045;

/**
 * A flight of outdoor steps (ADR-0044) on one straight run of a map's `highway=steps`: the band's
 * long side is the run, cut into treads `STEP_DEPTH` deep. Each tread is level at the terrain
 * height at its higher end and a riser joins it to the next, so the flight follows the slope in
 * steps instead of lying on it as a ramp or sinking into it. A run on ground too gentle for
 * `MIN_RISER` lies on it as paving instead.
 */
export const planSteps = (sink: MeshSink, ring: readonly P2[], h: HeightAt): void => {
  if (ring.length < 3) return;
  const box = orientedBox(ring);
  const length = box.halfLong * 2;
  if (length < STEP_DEPTH || box.halfShort < 0.2) return;
  const count = Math.max(1, Math.round(length / STEP_DEPTH));
  const depth = length / count;
  const at = (u: number, v: number): P2 => ({ x: box.cx + box.ux * u - box.uz * v, z: box.cz + box.uz * u + box.ux * v });
  const w = box.halfShort;
  // A tread is level with the ground at its higher end, so the slope never rises through it;
  // the riser before it closes the gap down to the tread below.
  const ground = (u: number) => {
    const p = at(u, 0);
    return h(p.x, p.z);
  };
  const levels: number[] = [];
  for (let k = 0; k < count; k++) levels.push(Math.max(ground(-box.halfLong + k * depth), ground(-box.halfLong + (k + 1) * depth)) + LIFT);
  // A level run keeps its treads: it draws no riser between them, only the kerbs at its ends.
  const rise = Math.max(...levels) - Math.min(...levels);
  if (rise >= 0.01 && rise / count < MIN_RISER) {
    drape(sink, ring, h, LIFT, TREAD, (p) => [p.x, p.z], [0, 0]);
    return;
  }
  const up = { x: 0, y: 1, z: 0 };
  const uv = (p: P2): [number, number] => [p.x, p.z];
  const riser = (u: number, from: number, to: number) => {
    if (Math.abs(to - from) < 0.01) return;
    const l = at(u, -w);
    const r = at(u, w);
    // A riser faces down the flight, towards the lower of its two levels.
    const n = to > from ? { x: -box.ux, y: 0, z: -box.uz } : { x: box.ux, y: 0, z: box.uz };
    quadUv(sink, [{ x: l.x, y: from, z: l.z }, { x: r.x, y: from, z: r.z }, { x: r.x, y: to, z: r.z }, { x: l.x, y: to, z: l.z }], n, RISER, [uv(l), uv(r), uv(r), uv(l)]);
  };
  // The ends: from the ground up to the first and last treads.
  riser(-box.halfLong, ground(-box.halfLong), levels[0] as number);
  riser(box.halfLong, ground(box.halfLong), levels[count - 1] as number);
  for (let k = 0; k < count; k++) {
    const u0 = -box.halfLong + k * depth;
    const u1 = u0 + depth;
    const y = levels[k] as number;
    const a = at(u0, -w);
    const b = at(u1, -w);
    const c = at(u1, w);
    const d = at(u0, w);
    quadUv(sink, [{ x: a.x, y, z: a.z }, { x: b.x, y, z: b.z }, { x: c.x, y, z: c.z }, { x: d.x, y, z: d.z }], up, TREAD, [uv(a), uv(b), uv(c), uv(d)]);
    if (k + 1 < count) riser(u1, y, levels[k + 1] as number);
  }
};
