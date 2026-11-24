import type { MeshSink, Rgba } from "../../mesh-sink";
import { type Wall, trimMeta } from "../facade-frame";
import { quadUv } from "../sink-ops";
import { gableOver } from "./classicist";
import { alongWall } from "./elevation";
import { SWATCH, archPanel, onWall, panel, shownWalls, solid } from "./kit";
import type { LandmarkFrame } from "./landmark-frame";
import { facing } from "./layer2077";
import type { WestFront } from "./recipe-types";

/**
 * A church's front in its bays (the Archikatedra, T-349 stage K2): pilasters, round-headed windows
 * and doors on the wall of each part facing the plaza, placed by their offsets from where the
 * church's axis meets that wall, so the bays of the vestibule, the nave's west wall, the screen
 * front and its pediment line up one over another as on the photograph; in the pediment's
 * tympanum a gilded sun with the monogram's disc (IHS). Pattern: a classical order's bays as a
 * table of offsets from the axis (the tripartite front of Il Gesù), applied to each storey's wall.
 */

/** The shown wall that faces the plaza most squarely and is long enough for bays, or null. */
export const frontWall = (
  f: LandmarkFrame,
  dir: { readonly x: number; readonly z: number },
): Wall | null => {
  let best: Wall | null = null;
  for (const w of shownWalls(f))
    if (
      w.length > 4 &&
      facing(w, dir) > 0.8 &&
      (!best || facing(w, dir) > facing(best, dir))
    )
      best = w;
  return best;
};

/** Where the axis through `axis` (a point on it, world) meets the wall, metres along it. */
export const axisOn = (
  w: Wall,
  axis: { readonly x: number; readonly z: number },
): number =>
  ((axis.x - w.a.x) * (w.b.x - w.a.x) + (axis.z - w.a.z) * (w.b.z - w.a.z)) /
  w.length;

/** A pilaster at u from y0 to y1: a flat shaft and a moulded capital, 0.7 m wide. */
const pilaster = (
  sink: MeshSink,
  w: Wall,
  u: number,
  y0: number,
  y1: number,
  white: Rgba,
): void => {
  const rotY = alongWall(w);
  sink.box(
    onWall(w, u, (y0 + y1 - 0.3) / 2, 0.1),
    0.7,
    y1 - y0 - 0.3,
    0.2,
    white,
    { rotY, bottom: false },
  );
  sink.box(onWall(w, u, y1 - 0.15, 0.15), 0.9, 0.3, 0.3, white, {
    rotY,
    bottom: false,
  });
};

/** A round-headed opening in a moulded frame with a sill: dark glass or a door's wood. */
const opening = (
  sink: MeshSink,
  w: Wall,
  u: number,
  width: number,
  y0: number,
  y1: number,
  fill: Rgba,
  trim: Rgba,
  sill: boolean,
  meta: [number, number],
): void => {
  archPanel(
    sink,
    w,
    u,
    width + 0.36,
    y0 - (sill ? 0.1 : 0),
    y1 + 0.18,
    0.1,
    trim,
    meta,
    false,
  );
  archPanel(sink, w, u, width, y0, y1, 0.2, fill, meta, false);
  if (sill)
    sink.box(onWall(w, u, y0 - 0.12, 0.17), width + 0.5, 0.14, 0.34, trim, {
      rotY: alongWall(w),
      bottom: false,
    });
};

/** The gilded sun in the gable over the wall: a disc with its monogram's dark ring and sixteen rays. */
const sun = (
  sink: MeshSink,
  f: LandmarkFrame,
  w: Wall,
  u: number,
  gold: Rgba,
  meta: [number, number],
): void => {
  const g = gableOver(f, w);
  if (!g) return;
  const r = Math.min(0.75, g.h * 0.3);
  const y = g.y0 + g.h * 0.42;
  const n = { x: w.nx, y: 0, z: w.nz };
  const ring = (
    r0: number,
    r1: number,
    out: number,
    color: Rgba,
    k: number,
  ): void => {
    for (let i = 0; i < k; i++) {
      const [a0, a1] = [(i / k) * Math.PI * 2, ((i + 1) / k) * Math.PI * 2];
      const q = (rr: number, a: number) =>
        onWall(w, u + Math.cos(a) * rr, y + Math.sin(a) * rr, out);
      quadUv(
        sink,
        [q(r0, a0), q(r0, a1), q(r1, a1), q(r1, a0)],
        n,
        color,
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        meta,
      );
    }
  };
  ring(0, r * 0.62, 0.16, gold, 16);
  ring(r * 0.36, r * 0.46, 0.2, solid(SWATCH.opening), 16);
  // The rays, long and short by turns, from the disc's rim.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const len = i % 2 === 0 ? r : r * 0.8;
    const t = { u: -Math.sin(a) * 0.05, y: Math.cos(a) * 0.05 };
    const p = (rr: number, s: number) =>
      onWall(
        w,
        u + Math.cos(a) * rr + t.u * s,
        y + Math.sin(a) * rr + t.y * s,
        0.18,
      );
    quadUv(
      sink,
      [p(r * 0.6, -1), p(r * 0.6, 1), p(len, 1), p(len, -1)],
      n,
      gold,
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      meta,
    );
  }
};

/** The front's bays on the part's wall facing the plaza: pilasters to the cornice, windows, doors and the pediment's sun. */
export const westFront = (
  sink: MeshSink,
  f: LandmarkFrame,
  spec: WestFront,
  trim: Rgba,
): void => {
  const w = frontWall(f, f.landmark.recipe.layer.newTown);
  if (!w) return;
  const meta = trimMeta(f.style.seed);
  const mid = axisOn(w, spec.axis);
  const inside = (u: number, half: number) =>
    u - half > 0.2 && u + half < w.length - 0.2;
  const [y0, y1] = [
    f.b.lifted ? f.b.foot : f.b.base,
    f.top - (f.landmark.part.tier.cornice ? 0.55 : 0),
  ];
  for (const d of spec.pilasters ?? [])
    if (inside(mid + d, 0.45)) pilaster(sink, w, mid + d, y0, y1, trim);
  for (const o of spec.windows ?? [])
    if (inside(mid + o.at, o.width / 2 + 0.2))
      opening(
        sink,
        w,
        mid + o.at,
        o.width,
        o.y0,
        o.y1,
        solid(SWATCH.opening),
        trim,
        true,
        meta,
      );
  for (const o of spec.doors ?? [])
    if (inside(mid + o.at, o.width / 2 + 0.2))
      opening(
        sink,
        w,
        mid + o.at,
        o.width,
        o.y0,
        o.y1,
        solid(SWATCH.door),
        trim,
        false,
        meta,
      );
  if (spec.sun) sun(sink, f, w, mid, solid(SWATCH.gold), meta);
  // A plain frieze band between the shafts' capitals and the cornice.
  if (spec.frieze)
    panel(
      sink,
      w,
      0.1,
      w.length - 0.1,
      spec.frieze - 0.25,
      spec.frieze + 0.25,
      0.06,
      trim,
      meta,
    );
};
