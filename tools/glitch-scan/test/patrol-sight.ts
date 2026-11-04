import { readFileSync } from "node:fs";
import type { Vec3, ViewDescriptor } from "../../../packages/core/src";
import { parseCityKit } from "../../../packages/engine/src/renderer/city-kit-data";
import { parseCityProps } from "../../../packages/engine/src/renderer/city-props";
import { type PatrolLane, patrolFade } from "../../../packages/engine/src/renderer/drones/patrol-flight";
import { patrolTemplates } from "../../../packages/engine/src/renderer/drones/patrol-models";
import { type P2, boundsOf, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { patrolPoints } from "./patrol-pieces";

/**
 * How large the low patrols of ADR-0058 stage 7b are where they come into sight and go
 * (`drone-low-pop`), seen from anywhere on any street or square, whatever way the camera looks:
 * every moment a patrol is drawn smaller than it is or next to a moment it is away, the patrol's
 * model at its full size (the size it pops to) from the nearest eye on any street surface of the
 * scenery (roads, pavements, squares, cobbles, footways, steps, crossings), in pixels on the
 * reference screen at its worst place in the frame (the corner, where a small thing is drawn
 * largest), shrunk as the renderer shrinks it with the distance (`patrolFade`). No walls, no
 * terrain in the way, no angle of the camera: from 2 px on it is a finding. The model's size is
 * read off `drone-props.glb` here, not from the constants the flight is planned with (G-216).
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };

/** The surfaces someone may stand on in the street. */
const STREET: ReadonlySet<string> = new Set(["road", "sidewalk", "square", "cobble", "footway", "steps", "crossing"]);
/** The eyes over the street's surface (m): a standing player's 1.7 m and some for a jump or a step. */
const EYE = 2.2;
/** Metres between the eyes sampled on the street surfaces. */
const EYE_STEP = 4;
/** Smaller than this a patrol is not seen (px). */
export const POP_PIXELS = 2;
/** The reference screen: 1920 px across at 80 degrees across (the default field of view), 16:9. */
const FOCAL = 960 / Math.tan((40 * Math.PI) / 180);
const CORNER = Math.hypot(960, 540);
/** Pixels per radian of a small thing in the frame's corner, along the ray: f (1 + tan^2) there. */
export const PIXELS_PER_RADIAN = (FOCAL * FOCAL + CORNER * CORNER) / FOCAL;

const file = (name: string): ArrayBuffer => {
  const b = readFileSync(new URL(`../../../packages/app/public/city/${name}`, import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

/** The patrol's model as the renderer draws it (`patrolTemplates`, its pool left out): its box's diagonal (m), the most it spans seen from anywhere. */
export const patrolModelSpan = (): number => {
  const t = patrolTemplates(parseCityKit(file("city-kit.glb")), parseCityProps(file("drone-props.glb"))).near;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.beam * 3; i++) {
    const v = t.positions[i] as number;
    min[i % 3] = Math.min(min[i % 3]!, v);
    max[i % 3] = Math.max(max[i % 3]!, v);
  }
  return Math.hypot(max[0]! - min[0]!, max[1]! - min[1]!, max[2]! - min[2]!);
};

/** How many pixels a thing `span` metres across takes `d` metres off, drawn at full size, at worst in the frame. */
export const popPixels = (span: number, d: number): number => (span * patrolFade(d) * PIXELS_PER_RADIAN) / Math.max(d, 1e-6);

/** An eye on the street. */
export interface Eye {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const CELL = 32;
const cellOf = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

/** Eyes every `EYE_STEP` metres over every street surface of the scenery, by their 32 m cells: the nearest within `r` of a point. */
export const streetEyes = (items: readonly Item[], surfaceAt: (x: number, z: number) => number) => {
  const cells = new Map<string, Eye[]>();
  const seen = new Set<string>();
  for (const { view, at } of items) {
    if (view.kind !== "ground" || !STREET.has(view.surface)) continue;
    const ring = cleanRing(view.outline.map((p) => ({ x: p.x + at.x, z: p.z + at.z })));
    if (ring.length < 3) continue;
    const b = boundsOf(ring);
    for (let x = Math.ceil(b.minX / EYE_STEP) * EYE_STEP; x <= b.maxX; x += EYE_STEP) {
      for (let z = Math.ceil(b.minZ / EYE_STEP) * EYE_STEP; z <= b.maxZ; z += EYE_STEP) {
        const k = `${x},${z}`;
        if (seen.has(k) || !pointInRing({ x, z }, ring)) continue;
        seen.add(k);
        const c = cellOf(x, z);
        const list = cells.get(c) ?? [];
        list.push({ x, y: surfaceAt(x, z) + EYE, z });
        cells.set(c, list);
      }
    }
  }
  /** The eye nearest to a point within `r` metres across, or null. */
  return (p: Vec3, r: number): { eye: Eye; d: number } | null => {
    let best: { eye: Eye; d: number } | null = null;
    for (let cx = Math.floor((p.x - r) / CELL); cx <= Math.floor((p.x + r) / CELL); cx++) {
      for (let cz = Math.floor((p.z - r) / CELL); cz <= Math.floor((p.z + r) / CELL); cz++) {
        for (const e of cells.get(`${cx},${cz}`) ?? []) {
          const d = Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z);
          if (!best || d < best.d) best = { eye: e, d };
        }
      }
    }
    return best;
  };
};

/** How far round a point the nearest eye is looked for (m): past it the patrol is drawn at no size (`patrolFade`). */
const REACH = ((): number => {
  let d = 1;
  while (patrolFade(d) > 0) d += 1;
  return d;
})();

/**
 * `drone-low-pop`: one finding per lane whose patrol, where it comes into sight or goes, takes
 * `POP_PIXELS` or more from the nearest eye on a street; the most pixels it takes in the finding.
 */
export const popSight = (lanes: readonly PatrolLane[], nearest: ReturnType<typeof streetEyes>, span: number): Finding[] =>
  lanes.flatMap((lane) => {
    let worst: { px: number; at: Vec3; eye: Eye; d: number } | null = null;
    const tried = new Set<string>();
    for (const f of patrolPoints(lane)) {
      if (!f.edge) continue;
      const at = { x: f.p.x, y: (f.bottom + f.top) / 2, z: f.p.z };
      const k = `${at.x.toFixed(0)},${at.z.toFixed(0)},${at.y.toFixed(0)}`;
      if (tried.has(k)) continue;
      tried.add(k);
      const n = nearest(at, REACH);
      if (!n) continue;
      const px = popPixels(span, n.d);
      if (!worst || px > worst.px) worst = { px, at, eye: n.eye, d: n.d };
    }
    if (!worst || worst.px < POP_PIXELS) return [];
    const w = worst;
    const first = lane.points[0] as P2;
    return [{ at: `patrol lane from ${first.x.toFixed(0)},${first.z.toFixed(0)} at ${w.at.x.toFixed(0)},${w.at.z.toFixed(0)} y ${w.at.y.toFixed(1)}`, what: `comes or goes ${w.px.toFixed(1)} px large from the street at ${w.eye.x.toFixed(0)},${w.eye.z.toFixed(0)}, ${w.d.toFixed(0)} m off` }];
  });
