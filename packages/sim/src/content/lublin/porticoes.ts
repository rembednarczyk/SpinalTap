import type { GroundPoint } from "@seki/core";
import type { PrismDef } from "../../world/prism";

/**
 * Porticoes standing in front of a landmark's wall (ADR-0062, G-119): the columns a body walks
 * round, one table for the simulation's solids and the renderer's recipe, so the drawn shafts and
 * the solids never part. World metres around `LUBLIN_ANCHOR`; the columns stand on the ground
 * under them, the balcony they carry is the renderer's (out of reach overhead).
 */
export interface Portico {
  /** OSM id of the building the portico stands against. */
  readonly building: string;
  /** The columns' axes, along the wall, world (x, z). */
  readonly columns: readonly GroundPoint[];
  /** The shaft's radius, metres. */
  readonly radius: number;
  /** How far the columns stand off the wall (their axes), metres. */
  readonly out: number;
}

/**
 * Nowy Ratusz, Plac Łokietka 1 (w66264120, T-067): four columns with plain shafts across the
 * risalit under the tower's block (w619138853), 3.9 m apart and 1.6 m off the south front, centred
 * on the risalit's axis. The two inner ones stand in the gaps between the three flights of steps
 * from the plaza (w1095048695-97), the outer ones at the flights' outer ends, as on the photographs
 * (Lublin360 2017, Street View 2025).
 */
export const PORTICOES: readonly Portico[] = [
  {
    building: "w66264120",
    columns: [
      { x: 409.91, z: -87.24 },
      { x: 413.78, z: -86.73 },
      { x: 417.65, z: -86.23 },
      { x: 421.52, z: -85.73 },
    ],
    radius: 0.45,
    out: 1.6,
  },
];

/** The portico against a building of the data, or null. */
export const porticoOf = (building: string): Portico | null => PORTICOES.find((p) => p.building === building) ?? null;

/**
 * Height of a column's solid over the building's centre: up to the balcony, which a giant order
 * of two storeys carries in front of the second floor's windows (NMPT 9.6-11.0 m before the front,
 * Lublin360 2017: the heads level with the first floor's arches); the renderer's balcony floor.
 */
export const COLUMN_TOP = 10.2;

/**
 * The columns of a building's portico as solids relative to its centre (an octagon round each
 * axis, counter-clockwise on the map), from a little under the foot up past a jump; none without one.
 */
export const porticoPrisms = (building: string, centre: GroundPoint): PrismDef[] =>
  (porticoOf(building)?.columns ?? []).map((c) => {
    const r = (porticoOf(building) as Portico).radius / Math.cos(Math.PI / 8);
    const points = Array.from({ length: 8 }, (_, k) => {
      const a = ((k + 0.5) / 8) * Math.PI * 2;
      return { x: c.x - centre.x + Math.cos(a) * r, z: c.z - centre.z + Math.sin(a) * r };
    });
    return { points, bottom: -1, top: COLUMN_TOP };
  });
