import type { GroundPoint } from "@seki/core";

/** A street passage through a map building at ground level (a city gate), along `from`..`to`. */
export interface PassageSite {
  readonly building: string;
  readonly from: GroundPoint;
  readonly to: GroundPoint;
  readonly width: number;
  /** Clear height over the higher end of the passage: the crown of its vault (ADR-0048). */
  readonly height: number;
  /** How far the vault rises under the crown; the straight walls stop there. */
  readonly rise: number;
  /** The floor at both ends, when it is not the terrain there (a vestibule onto stairs). */
  readonly floor?: number;
}

/**
 * The Old Town's two gates, which the map has as solid buildings: Bramowa through Brama
 * Krakowska (OSM relation 7224409, the tower with its neighbours) and Grodzka through Brama
 * Grodzka (OSM way 232362876). Each axis runs on along the street 4.6 to 8.7 m past both fronts
 * (Krakowska's 31.15 m long, under the gate 6.45..26.55 m along; Grodzka's 35.75 m, under it
 * 8.15..27.1 m), so a check of the vault takes its stretch under the building. Under a round-ish vault
 * that springs about 3 m up (ADR-0048). Grodzka's runs through the middles of both fronts as the
 * street sees them (the walls less the neighbours standing in front of them), about 1.4 m north of
 * the way OSM maps through the gate (w293488528), as the arch stands on the photographs (G-136).
 * A module with nothing to load, so the street furniture generator (plain Node, `pnpm osm:props`)
 * keeps its wall lanterns out of the gates too (G-183).
 */
export const GATE_PASSAGES: readonly PassageSite[] = [
  { building: "r7224409", from: { x: 457, z: -95.6 }, to: { x: 487, z: -87.2 }, width: 3.6, height: 4.2, rise: 1.25 },
  { building: "w232362876", from: { x: 700.8, z: 129.7 }, to: { x: 727.3, z: 153.7 }, width: 3.4, height: 4.2, rise: 1.2 },
];
