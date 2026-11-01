import type { MeshSink, Rgba, Vec } from "../../mesh-sink";
import type { FacadeFrame, Wall } from "../facade-frame";
import { spanAt } from "../passage-plan";
import { MAP_SIGN_KIND } from "../sign-plan";
import { type Uv, quadUv } from "../sink-ops";
import { onWall } from "./kit";
import { type LandmarkFrame, clockSpot, clockWalls, litMouths, mouthWall, screenOn, uplights } from "./landmark-plan";
import { passageAxis } from "./layer2077";

/**
 * Lublin 2077's neon on a landmark (ADR-0062) in the cell's additive sign mesh: the screen over
 * the passage and the museum's plaque from the names atlas (in-world signs, ADR-0056), the
 * holographic clock face, the warm beams of the uplights on the Old Town's side and the
 * checkpoint's strobing strips on the passage's jambs (steady with flashes reduced).
 */

const UV: readonly [Uv, Uv, Uv, Uv] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];
/** A beam brightest at its foot: the sign shader's beams brighten towards v = 1. */
const UV_UP: readonly [Uv, Uv, Uv, Uv] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [0, 0],
];

/** Seed of the holo whose style is the ring (`map-signs`: style = floor(fract(seed · 7.13) · 3) = 1). */
export const HOLO_RING_SEED = 0.07;

const tint = (hex: string, a: number): Rgba => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
};

const flat = (sink: MeshSink, w: Wall, u: number, y: number, out: number, width: number, height: number, color: Rgba, uv2: Uv, uv = UV): void => {
  quadUv(sink, [onWall(w, u - width / 2, y - height / 2, out), onWall(w, u + width / 2, y - height / 2, out), onWall(w, u + width / 2, y + height / 2, out), onWall(w, u - width / 2, y + height / 2, out)], { x: w.nx, y: 0, z: w.nz }, color, uv, uv2);
};

/** The strobing strips on both jambs just inside each mouth of the passages. */
const jambStrips = (sink: MeshSink, f: FacadeFrame, color: Rgba): void => {
  for (const p of f.b.passages ?? []) {
    const ax = passageAxis(p);
    if (!ax) continue;
    const floor = Math.max(p.floor[0], p.floor[1]);
    for (const side of [1, -1] as const) {
      const s = side * (p.width / 2 - 0.03);
      const span = spanAt(f.b.ring, ax, s);
      if (!span) continue;
      for (const [t, k] of [
        [span[0] + 0.35, 0],
        [span[1] - 0.35, 1],
      ] as const) {
        const at = (tt: number, y: number): Vec => ({ x: ax.o.x + ax.u.x * tt + ax.n.x * s, y, z: ax.o.z + ax.u.z * tt + ax.n.z * s });
        const n = { x: -ax.n.x * side, y: 0, z: -ax.n.z * side };
        quadUv(sink, [at(t - 0.09, floor + 0.5), at(t + 0.09, floor + 0.5), at(t + 0.09, p.spring - 0.1), at(t - 0.09, p.spring - 0.1)], n, color, UV, [k * 0.5 + (side > 0 ? 0 : 0.25), MAP_SIGN_KIND.strobe]);
      }
    }
  }
};

/** The landmark's signs; `nameSlot` gives a text's row in the names atlas (null: no room). */
export const planLandmarkSigns = (sink: MeshSink, f: LandmarkFrame, nameSlot: (name: string) => number | null): void => {
  const layer = f.landmark.recipe.layer;
  const s = screenOn(f);
  const slot = s && layer.screen ? nameSlot(layer.screen) : null;
  if (s && slot !== null) flat(sink, s.w, s.u, s.y, 0.16, s.width, s.height, tint("#5ce1ff", 1), [slot, MAP_SIGN_KIND.name]);
  const fresh = mouthWall(f, "new");
  if (fresh && layer.plaque) {
    // Beside the mouth, on the side with more room, at eye level.
    const left = fresh.u0 >= fresh.w.length - fresh.u1;
    const width = Math.min(3.6, (left ? fresh.u0 : fresh.w.length - fresh.u1) - 0.6);
    const u = left ? fresh.u0 - 0.4 - width / 2 : fresh.u1 + 0.4 + width / 2;
    const slot = width > 1.5 ? nameSlot(layer.plaque) : null;
    if (slot !== null) flat(sink, fresh.w, u, f.b.base + 2.3, 0.08, width, width / 8, tint("#fff1d6", 1), [slot, MAP_SIGN_KIND.name]);
  }
  for (const m of litMouths(f)) for (const l of uplights(f, m)) flat(sink, m.w, l.u, l.y + 2.6, 0.06, 1.5, 5, tint(layer.warm, 0.9), [l.u, MAP_SIGN_KIND.beam], UV_UP);
  if (f.landmark.part.tier.clock) {
    const best = clockWalls(f).neon;
    if (best) {
      const c = clockSpot(f, best);
      flat(sink, best, best.length / 2, c.y, 0.14, c.r * 2.3, c.r * 2.3, tint("#5ce1ff", 0.9), [HOLO_RING_SEED, MAP_SIGN_KIND.holo]);
    }
  }
  if (layer.checkpoint) jambStrips(sink, f, tint("#ff2e88", 1));
};
