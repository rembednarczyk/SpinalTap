import { groundY } from "@seki/sim";
import type { MeshSink, Rgba } from "../../mesh-sink";
import { type Wall, trimMeta } from "../facade-frame";
import { type P2, pointInRing } from "../polygon";
import { type Uv, quadUv } from "../sink-ops";
import { SWATCH, archPanel, clearOf, onWall, panel, solid } from "./kit";
import { crownRuns, eavesRuns, gateWall } from "./castle";
import type { LandmarkFrame } from "./landmark-frame";
import type { CastleFront } from "./recipes";

/**
 * A castle's neo-Gothic front (G-841): the pointed portal round the passage's mouth on the gate's
 * wall with the museum's sign on its tympanum, two rose windows over it, a lancet either side, and
 * rows of lancets on the other walls, level round the building from the gate's floor.
 */

/** How high a pointed arch of span `w` (two arcs of radius w) stands over its springing at x from its axis. */
const arcY = (x: number, w: number): number => Math.sqrt(Math.max(0, w * w - (Math.abs(x) + w / 2) ** 2));

/** A quad on the wall over the column [x0, x1] off the axis u, from the bottoms to the tops at its two edges. */
const column = (sink: MeshSink, w: Wall, u: number, x0: number, x1: number, bot: (x: number) => number, top: (x: number) => number, out: number, color: Rgba, meta: Uv): void => {
  if (top(x0) - bot(x0) < 0.01 && top(x1) - bot(x1) < 0.01) return;
  quadUv(sink, [onWall(w, u + x0, bot(x0), out), onWall(w, u + x1, bot(x1), out), onWall(w, u + x1, top(x1), out), onWall(w, u + x0, top(x0), out)], { x: w.nx, y: 0, z: w.nz }, color, [[x0, 0], [x1, 0], [x1, 1], [x0, 1]], meta);
};

/** The portal's frame band and its shaded recess, column by column, leaving the passage's mouth open. */
const portal = (sink: MeshSink, f: LandmarkFrame, gate: NonNullable<ReturnType<typeof gateWall>>, spec: CastleFront["portal"], trim: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const u = (gate.u0 + gate.u1) / 2;
  const half = (gate.u1 - gate.u0) / 2;
  const W = spec.width;
  const Wi = W - 0.9;
  const spring = gate.floor + spec.apex - W * 0.866;
  const outer = (x: number) => spring + arcY(x, W);
  const inner = (x: number) => spring + arcY(x, Wi);
  const edges = [-W / 2, -Wi / 2, -half, half, Wi / 2, W / 2];
  const xs = [...new Set([...edges, ...Array.from({ length: 17 }, (_, k) => -W / 2 + (W * k) / 16)])].sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k++) {
    const x0 = xs[k] as number;
    const x1 = xs[k + 1] as number;
    const xm = (x0 + x1) / 2;
    const open = Math.abs(xm) < Wi / 2;
    column(sink, gate.w, u, x0, x1, open ? inner : () => gate.floor - 0.1, outer, 0.03, trim, meta);
    if (open) column(sink, gate.w, u, x0, x1, () => (Math.abs(xm) < half ? gate.top : gate.floor - 0.1), inner, 0.015, solid(SWATCH.ivoryNiche), meta);
  }
};

/** An annulus on the wall round (u, y) from r0 to r1 in 16 segments, `out` metres in front of it. */
const annulus = (sink: MeshSink, w: Wall, u: number, y: number, r0: number, r1: number, out: number, color: Rgba, meta: Uv): void => {
  for (let k = 0; k < 16; k++) {
    const a0 = (k / 16) * Math.PI * 2;
    const a1 = ((k + 1) / 16) * Math.PI * 2;
    const q = (r: number, a: number) => onWall(w, u + Math.cos(a) * r, y + Math.sin(a) * r, out);
    quadUv(sink, [q(r0, a0), q(r0, a1), q(r1, a1), q(r1, a0)], { x: w.nx, y: 0, z: w.nz }, color, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
  }
};

/** A rose window: a square shaded panel, the dark disc, its moulded ring, eight spokes of tracery and the eye. */
const rose = (sink: MeshSink, w: Wall, u: number, y: number, r: number, trim: Rgba, meta: Uv): void => {
  panel(sink, w, u - r - 0.3, u + r + 0.3, y - r - 0.3, y + r + 0.3, 0.015, solid(SWATCH.ivoryNiche), meta);
  annulus(sink, w, u, y, 0, r, 0.045, solid(SWATCH.rose), meta);
  annulus(sink, w, u, y, r, r + 0.18, 0.06, trim, meta);
  annulus(sink, w, u, y, r * 0.18, r * 0.3, 0.08, trim, meta);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const c = { u: u + Math.cos(a) * r * 0.65, y: y + Math.sin(a) * r * 0.65 };
    const s = { u: -Math.sin(a) * 0.045, y: Math.cos(a) * 0.045 };
    const e = { u: Math.cos(a) * r * 0.35, y: Math.sin(a) * r * 0.35 };
    quadUv(sink, [onWall(w, c.u - e.u - s.u, c.y - e.y - s.y, 0.075), onWall(w, c.u - e.u + s.u, c.y - e.y + s.y, 0.075), onWall(w, c.u + e.u + s.u, c.y + e.y + s.y, 0.075), onWall(w, c.u + e.u - s.u, c.y + e.y - s.y, 0.075)], { x: w.nx, y: 0, z: w.nz }, trim, [[0, 0], [1, 0], [1, 1], [0, 1]], meta);
  }
};

/** A lancet at u from sill to head: its moulded frame and the dark glass. */
const lancet = (sink: MeshSink, w: Wall, u: number, width: number, sill: number, head: number, trim: Rgba, meta: Uv): void => {
  // The glass well in front of its frame: a centimetre apart they fight in the depth buffer from the plaza.
  archPanel(sink, w, u, width + 0.24, sill - 0.12, head + 0.12, 0.025, trim, meta, true);
  archPanel(sink, w, u, width, sill, head, 0.07, solid(SWATCH.opening), meta, true);
};

/** Whether a strip of the wall from u0 to u1 reaches into a neighbouring building of the data (the Donżon, the chapel). */
const intoNeighbour = (f: LandmarkFrame, w: Wall, u0: number, u1: number): boolean =>
  (f.landmark.nearby ?? []).some((r: readonly P2[]) => [u0, (u0 + u1) / 2, u1].some((u) => [0.05, 0.35].some((o) => pointInRing(onWall(w, u, 0, o), r))));

/**
 * The bays of every shown wall but the gate's, `pitch` apart, off the doorways and the neighbours:
 * lancets on the ground floor and, on the courtyard's walls, a row over them. On the outer walls
 * over the lancets: lesenes between the bays, a small round window in each and a frieze of
 * pointed arcades under the battlements (the photograph's wings).
 */
const bays = (sink: MeshSink, f: LandmarkFrame, spec: CastleFront, floor: number, gate: Wall, trim: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const merlon = f.landmark.part.crown.kind === "crenel" ? f.landmark.part.crown.merlon : 0;
  const { lancets, upper } = spec;
  const walls = [...crownRuns(f).map((r) => ({ ...r, outer: true })), ...eavesRuns(f).flatMap((r) => (r.w.blind ? [] : [{ ...r, outer: false }]))];
  for (const { w, top: crown, outer } of walls) {
    if (w === gate) continue;
    const frieze = crown - merlon - 0.25;
    const top = outer ? crown - merlon : crown;
    const rows = outer ? lancets.rows : [...lancets.rows, ...lancets.courtyard];
    for (const [u0, u1] of clearOf(f, w, 0.6)) {
      const n = Math.floor((u1 - u0) / lancets.pitch);
      for (let k = 0; k < n; k++) {
        const u = u0 + ((u1 - u0) * (k + 0.5)) / n;
        if (intoNeighbour(f, w, u - lancets.width, u + lancets.width)) continue;
        const at = onWall(w, u, 0, 0.3);
        const ground = groundY(at.x, at.z) + 0.4;
        for (const [s, h] of rows) if (floor + h + 0.6 < top && floor + s > ground) lancet(sink, w, u, lancets.width, floor + s, floor + h, trim, meta);
        if (!outer) continue;
        const y = floor + upper.oculus;
        if (y - upper.r > ground && y + upper.r + 0.5 < frieze - upper.frieze) {
          annulus(sink, w, u, y, upper.r, upper.r + 0.14, 0.03, trim, meta);
          annulus(sink, w, u, y, 0, upper.r, 0.05, solid(SWATCH.opening), meta);
        }
        const ul = u0 + ((u1 - u0) * k) / n;
        if (k > 0 && floor + 5 > ground) panel(sink, w, ul - 0.22, ul + 0.22, floor + 5, frieze - upper.frieze - 0.14, 0.03, trim, meta);
      }
    }
    if (!outer || w.length < upper.pitch) continue;
    // The frieze: a moulding and blind pointed arcades over it, the length of the wall.
    panel(sink, w, 0, w.length, frieze - upper.frieze - 0.14, frieze - upper.frieze, 0.035, trim, meta);
    const m = Math.floor(w.length / upper.pitch);
    for (let k = 0; k < m; k++) archPanel(sink, w, (w.length * (k + 0.5)) / m, upper.pitch * 0.62, frieze - upper.frieze, frieze, 0.02, solid(SWATCH.ivoryNiche), meta, true);
  }
};

/** Where the museum's sign stands on the portal's tympanum: the wall, middle, y and size, and its text; null without a gate. */
export const castleSignOn = (f: LandmarkFrame): { w: Wall; u: number; y: number; width: number; height: number; text: string } | null => {
  const spec = f.landmark.part.tier.castle;
  const gate = spec ? gateWall(f, f.landmark.recipe.layer) : null;
  if (!spec || !gate) return null;
  return { w: gate.w, u: (gate.u0 + gate.u1) / 2, y: gate.top + 0.42, width: 1.8, height: 0.36, text: spec.sign };
};

/** The castle's front from its recipe: the portal, the rose windows, the lancets and the wings' bays. */
export const castleFront = (sink: MeshSink, f: LandmarkFrame, spec: CastleFront, trim: Rgba): void => {
  const gate = gateWall(f, f.landmark.recipe.layer);
  if (!gate) return;
  const meta = trimMeta(f.style.seed);
  const mid = (gate.u0 + gate.u1) / 2;
  portal(sink, f, gate, spec.portal, trim);
  for (const s of [-1, 1]) rose(sink, gate.w, mid + s * spec.rose.off, gate.floor + spec.rose.at, spec.rose.r, trim, meta);
  // A lancet either side of the portal, on the ground floor's row.
  const [sill, head] = spec.lancets.rows[0] ?? [1.6, 4.4];
  const off = spec.portal.width / 2 + 1.6;
  for (const s of [-1, 1]) if (mid + s * off > 0.8 && mid + s * off < gate.w.length - 0.8) lancet(sink, gate.w, mid + s * off, spec.lancets.width, gate.floor + sill, gate.floor + head, trim, meta);
  bays(sink, f, spec, gate.floor, gate.w, trim);
};
