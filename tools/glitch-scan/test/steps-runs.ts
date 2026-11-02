/**
 * Flights of steps drawn across their run (G-213): the renderer takes a steps band's long side
 * for the run (`planSteps`), so a band laid on a run of `highway=steps` shorter than the band is
 * wide gets its treads along the run, a walker climbing them sideways.
 */
import { STEP_DEPTH } from "../../../packages/engine/src/renderer/mapcity/steps-plan";
import { orientedBox } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { type MapWay } from "./steps-walls";

type Pt = { readonly x: number; readonly z: number };

/** A straight run of a map steps way: its ends, its way's id and the band's width (m). */
interface Run {
  readonly a: Pt;
  readonly b: Pt;
  readonly id: string;
  readonly width: number;
}

/** How far a band's middle may lie past a run's band and still be on it (m): the import rounds to 0.1 m. */
const SLACK = 0.2;
/** A band's long side turned further than this from its run (cosine of 45°) lies across it. */
const ALONG = Math.SQRT1_2;

/** Whether `m` lies on the band of the run, and whether the run's direction is along `u`. */
const onRun = (m: Pt, u: Pt, r: Run): { readonly on: boolean; readonly along: boolean } => {
  const len = Math.hypot(r.b.x - r.a.x, r.b.z - r.a.z);
  const [dx, dz] = [(r.b.x - r.a.x) / len, (r.b.z - r.a.z) / len];
  const s = (m.x - r.a.x) * dx + (m.z - r.a.z) * dz;
  const off = Math.abs((m.z - r.a.z) * dx - (m.x - r.a.x) * dz);
  return { on: s >= -SLACK && s <= len + SLACK && off <= r.width / 2 + SLACK, along: Math.abs(u.x * dx + u.z * dz) >= ALONG };
};

/**
 * Each steps band (world ring) the renderer draws as a flight whose long side lies across every
 * run of `ways` (`width` m wide each) whose band holds its middle. Where two runs' bands overlap
 * (a turn of the flight), a band along either is drawn right.
 */
export const stepsAcross = (ways: readonly MapWay[], width: (w: MapWay) => number, bands: readonly (readonly Pt[])[]): { readonly at: string; readonly what: string }[] => {
  const runs: Run[] = ways
    .filter((w) => w.tags.highway === "steps")
    .flatMap((w) => w.line.slice(1).flatMap((b, i) => (Math.hypot(b.x - w.line[i]!.x, b.z - w.line[i]!.z) >= 0.1 ? [{ a: w.line[i]!, b, id: w.id, width: width(w) }] : [])));
  return bands.flatMap((ring) => {
    if (ring.length < 3) return [];
    const box = orientedBox(ring);
    // A sliver the renderer draws no flight on (`planSteps`).
    if (box.halfLong * 2 < STEP_DEPTH || box.halfShort < 0.2) return [];
    const m = { x: box.cx, z: box.cz };
    const under = runs.map((r) => ({ r, ...onRun(m, { x: box.ux, z: box.uz }, r) })).filter((o) => o.on);
    if (under.length === 0 || under.some((o) => o.along)) return [];
    const { a, b, id } = under[0]!.r;
    return [{ at: `${box.cx.toFixed(0)},${box.cz.toFixed(0)}`, what: `${id} run ${Math.hypot(b.x - a.x, b.z - a.z).toFixed(1)} m drawn across, band ${(box.halfLong * 2).toFixed(1)} × ${(box.halfShort * 2).toFixed(1)} m` }];
  });
};

/**
 * Each run of `ways` (`width` m wide) with a point of its middle cross-section, a quarter of the
 * width either side of the axis and on it, on no steps band (`onSteps`): the steps the map has
 * and the game leaves out, like a strip dropped as a sliver. A run off the map's chunks (`onMap`)
 * or under the ground, which the game draws no band for, is not one.
 */
export const stepsRunsBare = (ways: readonly MapWay[], width: (w: MapWay) => number, onSteps: (p: Pt) => boolean, onMap: (p: Pt) => boolean): { readonly at: string; readonly what: string }[] =>
  ways
    .filter((w) => w.tags.highway === "steps" && w.tags.tunnel === undefined && w.tags.indoor !== "yes" && Number(w.tags.layer ?? 0) >= 0)
    .flatMap((w) =>
      w.line.slice(1).flatMap((b, i) => {
        const a = w.line[i]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.1) return [];
        const m = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        const n = { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
        // Just off the axis, where the strips of an even cut meet.
        const pts = [-0.25, 0.01, 0.25].map((f) => ({ x: m.x + n.x * f * width(w), z: m.z + n.z * f * width(w) }));
        if (!pts.every(onMap) || pts.every(onSteps)) return [];
        return [{ at: `${m.x.toFixed(0)},${m.z.toFixed(0)}`, what: `${w.id} run ${len.toFixed(1)} m without steps` }];
      }),
    );
