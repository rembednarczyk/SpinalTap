import { groundY } from "@seki/sim";
import { type Portico, porticoOf } from "@seki/sim/lublin";
import type { MeshSink, Rgba } from "../../mesh-sink";
import { type Wall, trimMeta } from "../facade-frame";
import { quadUv } from "../sink-ops";
import { alongWall } from "./elevation";
import { SWATCH, onWall, panel, shownWalls, solid } from "./kit";
import type { LandmarkFrame } from "./landmark-frame";

/**
 * A landmark's portico (ADR-0062, G-119, Nowy Ratusz): columns with plain shafts and simple heads
 * on square plinths, standing on the ground where the simulation's `PORTICOES` puts them (its
 * solids), an entablature carrying a balcony with a balustrade of balusters over the storeys they span,
 * planters at the foot of the steps, and flags on masts over the balcony. Baked in world space into
 * the cell's sink like the rest of the kit; the steps are the data's own flights.
 */

/** The portico on its wall: the columns' places along it and their ground, and the balcony's heights. */
export interface PorticoOn {
  readonly w: Wall;
  readonly p: Portico;
  /** The columns along the wall, metres from its start, west to east as the data lists them. */
  readonly us: readonly number[];
  /** The ground under each column (world y). */
  readonly feet: readonly number[];
}

/** The entablature's depth under the balcony's floor, and how far the balcony reaches past the columns, metres. */
export const ENTABLATURE = { height: 0.6, over: 0.6 } as const;
/** The balustrade's height and the balusters' spacing, metres. */
export const BALUSTRADE = { rail: 0.95, pitch: 0.24 } as const;

/** The wall of a frame the data's portico stands against (its columns `out` metres off it), or null. */
export const porticoOn = (f: LandmarkFrame): PorticoOn | null => {
  const p = porticoOf(f.landmark.part.osm);
  if (!p) return null;
  for (const w of shownWalls(f)) {
    const dx = (w.b.x - w.a.x) / w.length;
    const dz = (w.b.z - w.a.z) / w.length;
    const at = p.columns.map((c) => ({ u: (c.x - w.a.x) * dx + (c.z - w.a.z) * dz, out: (c.x - w.a.x) * w.nx + (c.z - w.a.z) * w.nz }));
    if (at.every((a) => Math.abs(a.out - p.out) < 0.5 && a.u > 0 && a.u < w.length)) return { w, p, us: at.map((a) => a.u), feet: p.columns.map((c) => groundY(c.x, c.z)) };
  }
  return null;
};

/** The risalit over the portico along its wall: from the first column to the last, 0.9 m past them. */
export const risalitOf = (po: PorticoOn): [number, number] => [Math.min(...po.us) - 0.9, Math.max(...po.us) + 0.9];

/** The balcony's span along the wall, 0.7 m past the outer columns. */
const spanOf = (po: PorticoOn): [number, number] => [Math.min(...po.us) - 0.7, Math.max(...po.us) + 0.7];

/** A column at u: plinth, base, plain shaft and a simple head (echinus and abacus) up to y1. */
const column = (sink: MeshSink, po: PorticoOn, u: number, foot: number, y1: number, stone: Rgba, cream: Rgba): void => {
  const c = onWall(po.w, u, foot, po.p.out);
  const rotY = alongWall(po.w);
  const r = po.p.radius;
  sink.box({ x: c.x, y: foot + 0.15, z: c.z }, r * 2.7, 0.5, r * 2.7, stone, { rotY, bottom: false });
  sink.prism({ x: c.x, y: foot + 0.4, z: c.z }, r * 1.25, 0.14, 12, cream);
  sink.prism({ x: c.x, y: foot + 0.54, z: c.z }, r, y1 - 0.32 - foot - 0.54, 12, cream, false, r * 0.9);
  sink.prism({ x: c.x, y: y1 - 0.32, z: c.z }, r * 0.9, 0.16, 12, cream, false, r * 1.3);
  sink.box({ x: c.x, y: y1 - 0.08, z: c.z }, r * 2.9, 0.16, r * 2.9, cream, { rotY });
};

/** The balustrade on the balcony at y: a plinth rail, balusters, a top rail, pedestals over the columns, along the front and both ends. */
const balustrade = (sink: MeshSink, po: PorticoOn, y: number, white: Rgba): void => {
  const [u0, u1] = spanOf(po);
  const rotY = alongWall(po.w);
  const front = po.p.out + ENTABLATURE.over - 0.15;
  const run = (a: { u: number; out: number }, b: { u: number; out: number }): void => {
    const len = Math.hypot(b.u - a.u, b.out - a.out);
    const along = Math.abs(b.u - a.u) > Math.abs(b.out - a.out);
    const mid = onWall(po.w, (a.u + b.u) / 2, 0, (a.out + b.out) / 2);
    const [w, d] = along ? [len, 0.18] : [0.18, len];
    sink.box({ x: mid.x, y: y + 0.08, z: mid.z }, w, 0.16, d, white, { rotY, bottom: false });
    sink.box({ x: mid.x, y: y + BALUSTRADE.rail - 0.06, z: mid.z }, w + 0.04, 0.12, d + 0.04, white, { rotY });
    const n = Math.max(1, Math.round(len / BALUSTRADE.pitch));
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const p = onWall(po.w, a.u + (b.u - a.u) * t, 0, a.out + (b.out - a.out) * t);
      sink.box({ x: p.x, y: y + BALUSTRADE.rail / 2, z: p.z }, 0.09, BALUSTRADE.rail - 0.28, 0.09, white, { rotY, bottom: false });
    }
  };
  run({ u: u0 + 0.1, out: 0.05 }, { u: u0 + 0.1, out: front });
  run({ u: u0 + 0.1, out: front }, { u: u1 - 0.1, out: front });
  run({ u: u1 - 0.1, out: front }, { u: u1 - 0.1, out: 0.05 });
  for (const u of po.us) {
    const p = onWall(po.w, u, 0, front);
    sink.box({ x: p.x, y: y + BALUSTRADE.rail / 2, z: p.z }, 0.36, BALUSTRADE.rail, 0.3, white, { rotY, bottom: false });
  }
};

/** The data's name on the entablature's front over the middle bay: its middle along the wall, world y, out from the wall and size. */
export const nameplateOn = (f: LandmarkFrame, floor: number): { w: Wall; u: number; y: number; out: number; width: number; height: number } | null => {
  const po = porticoOn(f);
  if (!po || !f.b.name || !f.landmark.recipe.layer.nameplate) return null;
  const [u0, u1] = spanOf(po);
  // On the entablature's face under the balcony's lip (0.14 m), its tablet's margin within it.
  const height = ENTABLATURE.height - 0.24;
  const width = Math.min(u1 - u0 - 0.6, height * 8);
  return { w: po.w, u: (u0 + u1) / 2, y: floor - 0.14 - (ENTABLATURE.height - 0.14) / 2, out: po.p.out + ENTABLATURE.over + 0.02, width, height };
};

/** A round planter of concrete with a clipped shrub at (u, out) off the wall, on the ground there. */
const planter = (sink: MeshSink, w: Wall, u: number, out: number): void => {
  const c = onWall(w, u, 0, out);
  const y = groundY(c.x, c.z);
  sink.prism({ x: c.x, y: y - 0.1, z: c.z }, 0.62, 0.8, 12, solid(SWATCH.concrete));
  sink.prism({ x: c.x, y: y + 0.7, z: c.z }, 0.5, 0.55, 8, solid(SWATCH.shrub), false, 0.62);
  sink.prism({ x: c.x, y: y + 1.25, z: c.z }, 0.62, 0.5, 8, solid(SWATCH.shrub), true, 0.2);
};

/** Flags on masts standing on the balcony behind the balustrade, centred on the risalit, each in its stripes. */
const flags = (sink: MeshSink, f: LandmarkFrame, po: PorticoOn, floor: number): void => {
  const list = f.landmark.recipe.layer.flags ?? [];
  if (list.length === 0) return;
  const meta = trimMeta(f.style.seed);
  const [u0, u1] = spanOf(po);
  const mid = (u0 + u1) / 2;
  const step = Math.min(1.9, (u1 - u0 - 1.6) / Math.max(list.length - 1, 1));
  const out = 0.7;
  // Up to about the crowning cornice (NMPT 15.2 m over the plaza at Nowy Ratusz).
  const top = floor + 5.2;
  const back = { x: -po.w.nx, y: 0, z: -po.w.nz };
  list.forEach((stripes, k) => {
    const u = mid + (k - (list.length - 1) / 2) * step;
    const base = onWall(po.w, u, floor, out);
    sink.prism(base, 0.035, top - floor, 6, solid(SWATCH.metal));
    sink.box({ x: base.x, y: top + 0.05, z: base.z }, 0.1, 0.1, 0.1, solid("#d8b04a"));
    const h = 0.85 / stripes.length;
    stripes.forEach((hex, s) => {
      const y1 = top - 0.12 - h * s;
      const y0 = y1 - h;
      const c = solid(hex);
      // Both faces: the flag is seen from the plaza and from the balcony.
      panel(sink, po.w, u + 0.05, u + 1.35, y0, y1, out + 0.01, c, meta);
      quadUv(sink, [onWall(po.w, u + 0.05, y0, out - 0.01), onWall(po.w, u + 1.35, y0, out - 0.01), onWall(po.w, u + 1.35, y1, out - 0.01), onWall(po.w, u + 0.05, y1, out - 0.01)], back, c, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
    });
  });
};

/** The portico on its wall: the columns up to the entablature under the balcony's `floor` (world y), the balcony, planters and flags. */
export const planPortico = (sink: MeshSink, f: LandmarkFrame, floor: number): void => {
  const po = porticoOn(f);
  if (!po) return;
  const stone = solid(SWATCH.stone);
  const cream = solid(SWATCH.cream);
  const y0 = floor - ENTABLATURE.height;
  po.us.forEach((u, k) => column(sink, po, u, po.feet[k] as number, y0, stone, cream));
  const [u0, u1] = spanOf(po);
  const depth = po.p.out + ENTABLATURE.over;
  const mid = onWall(po.w, (u0 + u1) / 2, 0, depth / 2);
  const rotY = alongWall(po.w);
  sink.box({ x: mid.x, y: y0 + ENTABLATURE.height / 2, z: mid.z }, u1 - u0, ENTABLATURE.height, depth, cream, { rotY });
  // The balcony's floor slab over it, a little proud: the cornice of the entablature.
  const lip = onWall(po.w, (u0 + u1) / 2, 0, (depth + 0.12) / 2);
  sink.box({ x: lip.x, y: floor - 0.07, z: lip.z }, u1 - u0 + 0.12, 0.14, depth + 0.12, solid(SWATCH.plasterTrim), { rotY });
  balustrade(sink, po, floor, solid(SWATCH.plasterTrim));
  // The dark stone tablet the name's light letters (a sign) stand on: they add light, so a cream ground would swallow them.
  const plate = nameplateOn(f, floor);
  if (plate) panel(sink, plate.w, plate.u - plate.width / 2 - 0.1, plate.u + plate.width / 2 + 0.1, plate.y - plate.height / 2 - 0.03, plate.y + plate.height / 2 + 0.03, plate.out - 0.01, solid(SWATCH.tablet), trimMeta(f.style.seed));
  // At the foot of the steps, either side of them, as on the photographs.
  const foot = po.p.out + 2.9;
  planter(sink, po.w, Math.min(...po.us) - 0.5, foot);
  planter(sink, po.w, Math.max(...po.us) + 0.5, foot);
  flags(sink, f, po, floor);
};
