import type { MeshSink, Rgba } from "../../mesh-sink";
import { trimMeta } from "../facade-frame";
import { type Uv, quadUv } from "../sink-ops";
import { coveredRanges } from "./elevation";
import { SWATCH, archPanel, clearOf, revolve, shownWalls, solid, spireCross } from "./kit";
import type { LandmarkFrame } from "./landmark-frame";
import { facing } from "./layer2077";
import type { ChurchRoof, SideWindows } from "./recipe-types";

/**
 * The Archikatedra's sides and roofs (T-349 stage K3), after the user's photograph in the snow and
 * NMPT: round-headed windows along the walls that do not face the plaza, small gabled dormers on the
 * nave's dark roof, the ridge turret over the crossing of the nave (NMPT y 35 at u 3-5), and the two
 * chapels' copper domes with lanterns either side of it (NMPT 22-23 at u ≈ 5). Pattern: a Baroque
 * church's roofscape as a table of elements in world metres (as the castle's pinnacles,
 * `castle-front.ts`), the windows as a row at a pitch along each side wall's free stretches.
 */

/** Round-headed windows `pitch` metres apart along each shown wall facing away from the plaza, clear of the parts on it and of its doors. */
export const sideWindows = (sink: MeshSink, f: LandmarkFrame, spec: SideWindows, trim: Rgba): void => {
  const meta = trimMeta(f.style.seed);
  const dark = solid(SWATCH.opening);
  const plaza = f.landmark.recipe.layer.newTown;
  for (const w of shownWalls(f)) {
    if (facing(w, plaza) > 0.5 || w.length < spec.pitch) continue;
    const free = coveredRanges(f, w).free.flatMap(([a, b]) => clearOf(f, w, 0.5).flatMap(([c, d]): [number, number][] => (Math.min(b, d) - Math.max(a, c) > spec.pitch ? [[Math.max(a, c), Math.min(b, d)]] : [])));
    for (const [u0, u1] of free) {
      const n = Math.floor((u1 - u0) / spec.pitch);
      const start = u0 + (u1 - u0 - (n - 1) * spec.pitch) / 2;
      for (let k = 0; k < n; k++) {
        const u = start + k * spec.pitch;
        archPanel(sink, w, u, spec.width + 0.36, spec.y0 - 0.12, spec.y1 + 0.18, 0.1, trim, meta, false);
        archPanel(sink, w, u, spec.width, spec.y0, spec.y1, 0.2, dark, meta, false);
      }
    }
  }
};

const UV: [[number, number], [number, number], [number, number], [number, number]] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** A dormer facing (fx, fz) at (x, z): plaster cheeks and front to y1 over its sill at y0, a dark window, a small metal gable roof. */
const dormer = (sink: MeshSink, d: ChurchRoof["dormers"][number], wall: Rgba, roof: Rgba, meta: Uv): void => {
  const rotY = Math.atan2(-d.fz, d.fx) + Math.PI / 2;
  const [w, h, depth] = [1.5, d.y1 - d.y0, 2.2];
  const c = { x: d.x - (d.fx * depth) / 2, y: d.y0 + h / 2, z: d.z - (d.fz * depth) / 2 };
  sink.box(c, w, h, depth, wall, { rotY, bottom: false });
  // The window on its front, the front's normal outwards.
  const t = { x: -d.fz, z: d.fx };
  const n = { x: d.fx, y: 0, z: d.fz };
  const at = (s: number, y: number, out: number) => ({ x: d.x + t.x * s + d.fx * out, y, z: d.z + t.z * s + d.fz * out });
  quadUv(sink, [at(-0.45, d.y0 + 0.25, 0.04), at(0.45, d.y0 + 0.25, 0.04), at(0.45, d.y1 - 0.15, 0.04), at(-0.45, d.y1 - 0.15, 0.04)], n, solid(SWATCH.opening), UV, meta);
  // The gable roof over it: two slopes from its eaves to a ridge along its depth.
  const ridge = d.y1 + 0.55;
  for (const s of [-1, 1]) {
    const e = (out: number) => ({ x: d.x + t.x * s * (w / 2 + 0.12) + d.fx * out, y: d.y1, z: d.z + t.z * s * (w / 2 + 0.12) + d.fz * out });
    const r = (out: number) => ({ x: d.x + d.fx * out, y: ridge, z: d.z + d.fz * out });
    const up = { x: t.x * s * 0.55, y: w / 2, z: t.z * s * 0.55 };
    const l = Math.hypot(up.x, up.y, up.z);
    quadUv(sink, s > 0 ? [e(0.15), e(-depth), r(-depth), r(0.15)] : [e(-depth), e(0.15), r(0.15), r(-depth)], { x: up.x / l, y: up.y / l, z: up.z / l }, roof, UV, meta);
  }
};

/** A chapel's dome: a drum with its cornice, the copper dome, an open lantern with its own small dome, a ball and a cross. */
const dome = (sink: MeshSink, d: ChurchRoof["domes"][number], wall: Rgba, trim: Rgba, copper: Rgba, meta: Uv): void => {
  const r = d.r;
  revolve(sink, { x: d.x, y: d.y, z: d.z }, [[r, 0], [r, d.drum]], 8, Math.PI / 8, wall, meta);
  revolve(sink, { x: d.x, y: d.y + d.drum - 0.3, z: d.z }, [[r + 0.15, 0], [r + 0.15, 0.3]], 8, Math.PI / 8, trim, meta);
  const top = d.y + d.drum;
  const h = d.top - top - 1.6;
  revolve(sink, { x: d.x, y: top, z: d.z }, [[r, 0], [r * 0.95, h * 0.3], [r * 0.75, h * 0.62], [r * 0.4, h * 0.88], [r * 0.24, h]], 8, Math.PI / 8, copper, meta);
  revolve(sink, { x: d.x, y: top + h, z: d.z }, [[r * 0.22, 0], [r * 0.22, 0.75]], 8, Math.PI / 8, wall, meta);
  revolve(sink, { x: d.x, y: top + h + 0.75, z: d.z }, [[r * 0.3, 0], [r * 0.12, 0.35], [0.03, 0.6]], 8, Math.PI / 8, copper, meta);
  spireCross(sink, { x: d.x, z: d.z }, d.top - 0.25, d.top + 0.5, 0);
};

/** The roofscape of a church's part: its dormers, its ridge turret and the chapels' domes round it. */
export const churchRoof = (sink: MeshSink, f: LandmarkFrame, spec: ChurchRoof): void => {
  const meta = trimMeta(f.style.seed);
  const wall = solid(f.style.plaster);
  const trim = solid(SWATCH.plasterTrim);
  const copper = solid(SWATCH.patina);
  for (const d of spec.dormers) dormer(sink, d, wall, solid(SWATCH.roofMetal), meta);
  for (const d of spec.domes) dome(sink, d, wall, trim, copper, meta);
  const t = spec.turret;
  if (t) {
    revolve(sink, { x: t.x, y: t.y, z: t.z }, [[0.8, 0], [0.8, 1.6]], 8, Math.PI / 8, wall, meta);
    revolve(sink, { x: t.x, y: t.y + 1.6, z: t.z }, [[0.95, 0], [0.7, 0.6], [0.35, 1.4], [0.06, t.top - t.y - 2.2]], 8, Math.PI / 8, copper, meta);
    spireCross(sink, { x: t.x, z: t.z }, t.top - 0.6, t.top + 0.3, 0);
  }
};
