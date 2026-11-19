import { offsetPolylineRight, segmentDistance } from "../../../packages/core/src";
import type { CarFreeWay } from "../../osm-import/src/corrections-car-free.ts";
import type { Line } from "../../osm-import/src/features.ts";

/**
 * The deptaki the game makes of car streets (ADR-0074, T-324, `CAR_FREE_WAYS` of the import):
 * - `deptak-car-lane`: a car route (not a trolleybus's, not a delivery van's) with a point on a
 *   deptak's old carriageway, its way across a junction's mouth at its ends aside;
 * - `road-retag-row`: a way of the list without its row in `docs/topografia.md` (the row its `ref`
 *   names, with the way's id in it), as `cut-on-road` asks of the replaced ways;
 * - `deptak-stall-clear`: a solid piece on a deptak (a kiosk, a stall, a machine, a game block)
 *   closer than `TROLLEY_ROOM` to the trolleybus's line (1.6 m right of the axis, the line's lane
 *   of a one-way street) or in the way from metro B's exit across the pavement onto the deptak.
 */

type Finding = { readonly at: string; readonly what: string };
type Pt = { readonly x: number; readonly z: number };

export interface Deptak {
  readonly id: string;
  readonly line: readonly Pt[];
  /** How far its old carriageway reaches either side of the axis (m). */
  readonly half: number;
}

/** A trolleybus's line under the wires, right of a one-way street's axis (m): its lane `:0` (`traffic.ts`). */
export const TROLLEY_OFF = 1.6;
/** A solid piece keeps this clear of the trolleybus's line (m), its own reach aside: the bus's half and a hand. */
export const TROLLEY_ROOM = 1.4;
/** The way from metro B's exit (431.95; 28) across the pavement onto the deptak, kept free of stalls (the curator's plan, §4). */
export const METRO_B_WAY = { minX: 431.6, maxX: 447, minZ: 26, maxZ: 30 } as const;

const near = (x: number, z: number): string => `${x.toFixed(0)},${z.toFixed(0)}`;

/** Where (x, z) projects on a polyline strictly between its ends, and how far off it; null past an end. */
const across = (line: readonly Pt[], x: number, z: number): number | null => {
  let best: number | null = null;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1]!, line[i]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const len2 = dx * dx + dz * dz;
    if (len2 < 1e-12) continue;
    const t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
    // Past the street's first or last point: the junction there, not the deptak.
    if ((i === 1 && t <= 0) || (i === line.length - 1 && t >= 1)) continue;
    const d = segmentDistance(x, z, a.x, a.z, b.x, b.z);
    if (best === null || d < best) best = d;
  }
  return best;
};

/** Is (x, z) on a deptak's old carriageway? */
export const onDeptak = (d: Deptak, x: number, z: number): boolean => {
  const off = across(d.line, x, z);
  return off !== null && off < d.half;
};

/** The ways of the list as the map draws them, with their carriageway's half width. */
export const deptaksOf = (ways: readonly CarFreeWay[], lines: readonly Line[], width: (l: Line) => number): Deptak[] =>
  ways.flatMap((w) => {
    const l = lines.find((o) => o.id === w.id);
    return l ? [{ id: w.id, line: l.line, half: width(l) / 2 }] : [];
  });

/** `deptak-car-lane`: one finding per car route and deptak, at its first point on it. */
export const deptakCarLanes = (deptaks: readonly Deptak[], routes: readonly { readonly id: string; readonly use: string; readonly points: readonly (readonly [number, number])[] }[]): Finding[] =>
  routes
    .filter((r) => r.use === "cars")
    .flatMap((r) =>
      deptaks.flatMap((d) => {
        for (let i = 1; i < r.points.length; i++) {
          const [a, b] = [r.points[i - 1]!, r.points[i]!];
          const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
          for (let k = 0; k <= n; k++) {
            const [x, z] = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n];
            if (onDeptak(d, x, z)) return [{ at: near(x, z), what: `${r.id} on ${d.id}` }];
          }
        }
        return [];
      }),
    );

/** `road-retag-row`: a way of the list whose register row (its `ref`) is missing or does not name it. */
export const roadRetagRows = (ways: readonly CarFreeWay[], lines: readonly Line[], register: string): Finding[] => {
  const rows = register.split("\n").filter((l) => l.startsWith("| T-"));
  return ways.flatMap((w) => {
    const row = rows.find((l) => l.startsWith(`| ${w.ref} |`));
    if (row && /^T-\d{3}$/.test(w.ref) && row.includes(w.id)) return [];
    const at = lines.find((l) => l.id === w.id)?.line[0] ?? { x: 0, z: 0 };
    return [{ at: near(at.x, at.z), what: `${w.id}: ${row ? `${w.ref} does not name it` : `no row ${w.ref}`}` }];
  });
};

/** A solid piece of the street: its middle and reach. */
export interface Solid {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly what: string;
}

const inBox = (s: Solid, b: typeof METRO_B_WAY): boolean => s.x + s.r > b.minX && s.x - s.r < b.maxX && s.z + s.r > b.minZ && s.z - s.r < b.maxZ;

/** `deptak-stall-clear`: a solid on a deptak too near the trolleybus's line, or in metro B's way onto it. */
export const deptakStallClear = (deptaks: readonly Deptak[], solids: readonly Solid[], way = METRO_B_WAY): Finding[] =>
  deptaks.flatMap((d) => {
    const wire = offsetPolylineRight(
      d.line.map((p) => [p.x, p.z] as const),
      TROLLEY_OFF,
    ).map(([x, z]) => ({ x, z }));
    return solids.flatMap((s) => {
      if (!onDeptak(d, s.x, s.z)) return [];
      const gap = Math.min(...wire.slice(1).map((b, i) => segmentDistance(s.x, s.z, wire[i]!.x, wire[i]!.z, b.x, b.z))) - s.r;
      if (gap < TROLLEY_ROOM) return [{ at: near(s.x, s.z), what: `${s.what} ${gap.toFixed(2)} m from the trolleybus's line on ${d.id}` }];
      return inBox(s, way) ? [{ at: near(s.x, s.z), what: `${s.what} in metro B's way onto ${d.id}` }] : [];
    });
  });
