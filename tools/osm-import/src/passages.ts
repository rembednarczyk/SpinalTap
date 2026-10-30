/**
 * Passages through buildings (ADR-0048): the tenements' gateways and the Old Town's covered
 * lanes the map draws as ways with `tunnel=building_passage` running under a building. Each
 * becomes a straight vaulted passage cut through the building's solid, from a little before its
 * facade on one side to a little past the other. A way that only leads into a building (into a
 * courtyard the outline does not cut out) makes none: its far end would open into the solid.
 */
import { parseLength } from "./building-tags.ts";
import { type Area, type Line } from "./features.ts";
import { type Pt, type Rect, lineLength, pointAlong, pointInRing, r1, rectsOverlap, ringBounds } from "./geometry.ts";

export interface PassageOut {
  /** The building it runs through (`w<id>`, `r<id>`). */
  readonly building: string;
  readonly from: { readonly x: number; readonly z: number };
  readonly to: { readonly x: number; readonly z: number };
  readonly width: number;
  /** Clear height under the crown of the vault, and how far the vault rises under it (m). */
  readonly height: number;
  readonly rise: number;
}

/** How far the passage runs on beyond each facade (m), as the gates do. */
const BEYOND = 0.6;
/** Shortest run under a building that makes a passage (m): a way grazing a corner makes none. */
const MIN_RUN = 2;
const STEP = 0.25;

/** Width when the map gives none, by the way's kind (m): a gateway for carts, a lane, a footpath. */
const widthOf = (l: Line): number => parseLength(l.tags.width) ?? (l.tags.highway === "service" ? 3.2 : l.tags.highway === "pedestrian" ? 3.4 : 2.4);

/** The runs of `line` inside `ring`, as arc lengths [enter, leave] that both lie strictly within the line. */
const runsInside = (line: readonly Pt[], ring: readonly Pt[]): [number, number][] => {
  const total = lineLength(line);
  const out: [number, number][] = [];
  let start: number | null = null;
  for (let s = 0; s <= total + 1e-6; s += STEP) {
    const inside = pointInRing(pointAlong(line, Math.min(s, total)), ring);
    if (inside && start === null) start = s;
    if (!inside && start !== null) {
      // Entered from outside (not from the line's own start inside) and left again.
      if (start > 0 && s - start >= MIN_RUN) out.push([start, s]);
      start = null;
    }
  }
  return out;
};

/** The line run on 1.5 m past both ends: a passage way is usually drawn from facade to facade. */
const extended = (line: readonly Pt[]): Pt[] => {
  const on = (a: Pt, b: Pt): Pt => {
    const d = Math.hypot(a.x - b.x, a.z - b.z) || 1;
    return { x: a.x + ((a.x - b.x) / d) * 1.5, z: a.z + ((a.z - b.z) / d) * 1.5 };
  };
  return [on(line[0]!, line[1]!), ...line, on(line[line.length - 1]!, line[line.length - 2]!)];
};

/** The passages of the map's `tunnel=building_passage` ways through the buildings they run under, in the ways' order. */
export const buildingPassages = (lines: readonly Line[], buildings: readonly Area[]): PassageOut[] => {
  const boxes = buildings.map((b) => ({ b, box: ringBounds(b.ring) as Rect }));
  const out: PassageOut[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    if (l.tags.tunnel !== "building_passage" || !l.tags.highway || l.line.length < 2) continue;
    const line = extended(l.line);
    const box = ringBounds(line);
    for (const { b, box: bb } of boxes) {
      if (!rectsOverlap(box, bb)) continue;
      for (const [a, z] of runsInside(line, b.ring)) {
        // Straight from where it goes in to where it comes out, on beyond both facades.
        const enter = pointAlong(line, a);
        const leave = pointAlong(line, z);
        const len = Math.hypot(leave.x - enter.x, leave.z - enter.z) || 1;
        const ux = (leave.x - enter.x) / len;
        const uz = (leave.z - enter.z) / len;
        const from = { x: enter.x - ux * BEYOND, z: enter.z - uz * BEYOND };
        const to = { x: leave.x + ux * BEYOND, z: leave.z + uz * BEYOND };
        const key = `${b.id}:${r1(from.x)},${r1(from.z)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const width = widthOf(l);
        out.push({ building: b.id, from: { x: r1(from.x), z: r1(from.z) }, to: { x: r1(to.x), z: r1(to.z) }, width, height: width >= 3 ? 4 : 3.4, rise: width >= 3 ? 1.1 : 0.9 });
      }
    }
  }
  return out;
};
