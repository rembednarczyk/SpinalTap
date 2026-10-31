import type { MeshSink, Vec } from "../../mesh-sink";
import { type FacadeFrame, type Wall, type WorldPassage, trimMeta } from "../facade-frame";
import { type P2 } from "../polygon";
import { spanAt } from "../passage-plan";
import { type Uv, quadUv } from "../sink-ops";
import { type HelmBase, SWATCH, helmProfile, lit, onWall, panel, shownWalls, solid } from "./kit";
import type { HelmProfile, Layer2077 } from "./recipes";

/**
 * Lublin 2077 on a landmark (ADR-0062), the geometry part baked into the facade mesh: lit
 * through the existing glow (self-lit vertices), never a superstructure. Neon lines on the
 * cornices towards the new town and thin warm ones on the Old Town's side, LED strips on the
 * helmet's ribs, a mast with aerials and a warning light as the spire's top, a screen's frame,
 * a camera, uplights at the foot and the checkpoint's scanner in a gate's vault.
 */

const UNIT: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/** How squarely a wall faces a direction (1 straight at it, -1 away). */
export const facing = (w: Wall, dir: { readonly x: number; readonly z: number }): number => w.nx * dir.x + w.nz * dir.z;

/** The new town's side, the Old Town's side, or neither (a wall along the axis). */
export const sideOf = (w: Wall, layer: Layer2077): "new" | "old" | "edge" => {
  const k = facing(w, layer.newTown);
  return k > 0.35 ? "new" : k < -0.35 ? "old" : "edge";
};

/** Lines of light along a cornice at y: a neon tube towards the new town, thin warm lines elsewhere. */
export const corniceLights = (sink: MeshSink, f: FacadeFrame, y: number, out: number, layer: Layer2077): void => {
  const meta = trimMeta(f.style.seed);
  for (const w of shownWalls(f)) {
    const neon = !layer.subdued && sideOf(w, layer) === "new";
    const h = neon ? 0.11 : 0.04;
    panel(sink, w, 0, w.length, y - h / 2, y + h / 2, out, lit(neon ? layer.neon : layer.warm), meta);
  }
};

/** LED strips down the helmet's ribs that face the new town. */
export const helmLeds = (sink: MeshSink, f: FacadeFrame, base: HelmBase, h: HelmProfile, roof: number, layer: Layer2077): void => {
  const shell = helmProfile(h, base.r, roof).shell;
  const color = lit(layer.neon);
  const meta = trimMeta(f.style.seed);
  for (let j = 0; j < 8; j++) {
    const a = base.phase + (j / 8) * Math.PI * 2;
    const d = { x: Math.cos(a), z: Math.sin(a) };
    if (d.x * layer.newTown.x + d.z * layer.newTown.z < -0.05) continue;
    const t = { x: -d.z * 0.05, z: d.x * 0.05 };
    const p = (r: number, y: number, s: number): Vec => ({ x: base.c.x + d.x * (r + 0.04) + t.x * s, y: f.top + y, z: base.c.z + d.z * (r + 0.04) + t.z * s });
    for (let k = 0; k + 1 < shell.length; k++) {
      const [r0, y0] = shell[k] as [number, number];
      const [r1, y1] = shell[k + 1] as [number, number];
      quadUv(sink, [p(r0, y0, -1), p(r0, y0, 1), p(r1, y1, 1), p(r1, y1, -1)], { x: d.x, y: 0.4, z: d.z }, color, UNIT, meta);
    }
  }
};

/** The spire's top as a mast from y0 to y1: a pole, two cross-arms of aerials, a red warning light at the tip. */
export const mast = (sink: MeshSink, c: P2, y0: number, y1: number, phase: number): void => {
  const metal = solid(SWATCH.metal);
  const red = lit("#ff2a2a");
  const h = y1 - y0;
  sink.prism({ x: c.x, y: y0, z: c.z }, 0.05, h - 0.2, 6, metal, true, 0.03);
  // Arms no wider than the mast is tall: it tops the spire, it does not outgrow it (T-034).
  for (const [k, wide] of [
    [0.3, 1.1],
    [0.58, 0.7],
  ] as const) {
    const w = Math.min(wide, h * (k < 0.5 ? 0.9 : 0.6));
    const y = y0 + h * k;
    sink.box({ x: c.x, y, z: c.z }, w, 0.04, 0.04, metal, { rotY: phase });
    sink.box({ x: c.x, y, z: c.z }, 0.04, 0.04, w * 0.6, metal, { rotY: phase });
    for (const s of [-1, 1]) sink.box({ x: c.x + Math.cos(phase) * s * (w / 2), y: y + 0.05, z: c.z - Math.sin(phase) * s * (w / 2) }, 0.07, 0.07, 0.07, red);
  }
  sink.box({ x: c.x, y: y1 - 0.1, z: c.z }, 0.18, 0.18, 0.18, red);
};

/** A frame of dark metal on the wall round a screen centred at (u, y). */
export const screenFrame = (sink: MeshSink, w: Wall, u: number, y: number, width: number, height: number, meta: Uv): void => {
  panel(sink, w, u - width / 2 - 0.12, u + width / 2 + 0.12, y - height / 2 - 0.12, y + height / 2 + 0.12, 0.1, solid(SWATCH.metal), meta);
};

/** A small camera on a bracket off the wall at (u, y), its red light on. */
export const camera = (sink: MeshSink, w: Wall, u: number, y: number): void => {
  const dx = (w.b.x - w.a.x) / w.length;
  const dz = (w.b.z - w.a.z) / w.length;
  const rotY = Math.atan2(w.nx, w.nz);
  const at = (out: number, yy: number) => onWall(w, u, yy, out);
  // Within a cornice's depth of the wall (0.3 m, T-034): bracket, body and lens.
  sink.box(at(0.07, y + 0.15), 0.06, 0.06, 0.14, solid(SWATCH.metal), { rotY });
  sink.box(at(0.16, y), 0.18, 0.16, 0.2, solid("#3a3f47"), { rotY });
  const lens = at(0.27, y);
  sink.box({ x: lens.x + dx * 0.05, y: y + 0.03, z: lens.z + dz * 0.05 }, 0.04, 0.04, 0.04, lit("#ff3030"));
};

/** Uplights on the ground (world y) at the foot of a wall: warm lit fittings (their beams are signs). */
export const uplightFittings = (sink: MeshSink, w: Wall, ground: number, us: readonly number[], color: string, meta: Uv): void => {
  for (const u of us) {
    // Against the wall, within a cornice's depth of it (0.3 m, T-034).
    sink.box(onWall(w, u, ground + 0.08, 0.16), 0.34, 0.16, 0.22, solid(SWATCH.metal), { rotY: Math.atan2(-(w.b.z - w.a.z), w.b.x - w.a.x) });
    quadUv(sink, [onWall(w, u - 0.13, ground + 0.165, 0.07), onWall(w, u + 0.13, ground + 0.165, 0.07), onWall(w, u + 0.13, ground + 0.165, 0.25), onWall(w, u - 0.13, ground + 0.165, 0.25)], { x: 0, y: 1, z: 0 }, lit(color), UNIT, meta);
  }
};

/** The passage's axis frame (`passage-plan`'s): origin, along, across to the left, length. */
export const passageAxis = (p: WorldPassage): { o: P2; u: P2; n: P2; length: number } | null => {
  const dx = p.to.x - p.from.x;
  const dz = p.to.z - p.from.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.1) return null;
  const u = { x: dx / length, z: dz / length };
  return { o: p.from, u, n: { x: -u.z, z: u.x }, length };
};

/** The checkpoint's scanner: a lit arch hugging the vault and the walls at the middle of the passage under the building. */
export const scanner = (sink: MeshSink, f: FacadeFrame, p: WorldPassage, color: string): void => {
  const ax = passageAxis(p);
  const span = ax ? spanAt(f.b.ring, ax, 0) : null;
  if (!ax || !span) return;
  const t = (span[0] + span[1]) / 2;
  const meta = trimMeta(f.style.seed);
  const half = p.width / 2 - 0.06;
  const rise = Math.max(p.crown - p.spring, 0) - 0.06;
  const floor = Math.max(p.floor[0], p.floor[1]);
  const pts: { s: number; y: number }[] = [{ s: half, y: floor + 0.4 }];
  for (let k = 0; k <= 10; k++) pts.push({ s: half * Math.cos((Math.PI * k) / 10), y: p.spring + rise * Math.sin((Math.PI * k) / 10) });
  pts.push({ s: -half, y: floor + 0.4 });
  const at = (tt: number, s: number, y: number): Vec => ({ x: ax.o.x + ax.u.x * tt + ax.n.x * s, y, z: ax.o.z + ax.u.z * tt + ax.n.z * s });
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k] as { s: number; y: number };
    const b = pts[k + 1] as { s: number; y: number };
    const mid = { s: (a.s + b.s) / 2, y: (a.y + b.y) / 2 };
    // Facing into the passage: towards its axis at the springing.
    const n = { x: -ax.n.x * mid.s, y: p.spring - mid.y, z: -ax.n.z * mid.s };
    const l = Math.hypot(n.x, n.y, n.z) || 1;
    quadUv(sink, [at(t - 0.07, a.s, a.y), at(t + 0.07, a.s, a.y), at(t + 0.07, b.s, b.y), at(t - 0.07, b.s, b.y)], { x: n.x / l, y: n.y / l, z: n.z / l }, lit(color), UNIT, meta);
  }
};
