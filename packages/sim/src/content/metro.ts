import type { MetroStationId, Vec3, ViewDescriptor } from "@seki/core";
import { type StaticProp, neon, slab, v } from "./builders";
/** District ids as world-map.ts names them (kept local: world-map imports this table). */
type DistrictId = "shinsekai-7" | "kanal" | "targ" | "doki";

/**
 * Metro platforms (ADR-0034): one per district, each a ticket kiosk against a wall with a
 * canopy over the stairs down, and the point where a rider comes up again. Kept apart from the
 * district tables (one entry in world-map.ts hooks them up), like the devices of wave 1. Every
 * place stands in a dead end or against a facade, off the streets, the NPC routes and the level
 * graph (checked by test/metro.test.ts): the kiosk is the only solid, everything else is drawn.
 */
export interface MetroStationDef {
  readonly id: MetroStationId;
  readonly name: string;
  readonly district: DistrictId;
  readonly chunk: string;
  /** Centre of the kiosk's foot; it faces `yaw` (0 faces +Z), its back to the wall. */
  readonly kiosk: Vec3;
  readonly yaw: number;
  /** Where a rider comes up, and the way they face. */
  readonly arrival: Vec3;
  readonly arrivalYaw: number;
  /** The drawn platform: canopy, the stairwell's edge, a sign. */
  readonly props: readonly StaticProp[];
}

/** The kiosk: 0.8 m wide, 0.6 m deep, as tall as a person. */
export const KIOSK_SIZE: Vec3 = v(0.8, 1.9, 0.6);

/** The ticket can be bought this close to the kiosk (horizontally). */
export const KIOSK_REACH = 2.2;

export const kioskView: ViewDescriptor = { kind: "block", size: KIOSK_SIZE, material: "glass" };

/** Canopy and stairwell next to a kiosk with its back to a wall on the south (`side` 1) or north (-1) side. */
const platform = (x: number, wallZ: number, side: 1 | -1, dx: number): StaticProp[] => [
  // Over the stairs down: high enough to walk under, drawn only.
  slab(x + dx, 2.9, wallZ + side * 1.0, v(4.4, 0.15, 2.0), "glass"),
  // The stairwell's edge on the pavement, flush with the ground.
  slab(x + dx * 1.6, 0.02, wallZ + side * 0.9, v(2.6, 0.04, 1.6), "metal"),
];

export const METRO_STATIONS: readonly MetroStationDef[] = [
  // Shinsekai 7: the dead end south of the west tenement, by the district's south wall.
  {
    id: "shinsekai",
    name: "Shinsekai 7",
    district: "shinsekai-7",
    chunk: "shinsekai-7",
    kiosk: v(-15, 0, -35.65),
    yaw: 0,
    arrival: v(-15, 0, -34.2),
    arrivalYaw: Math.PI / 2,
    props: platform(-15, -36, 1, 2.2),
  },
  // Ulica Kanałowa: against the south row, across the street from the passage to the docks.
  {
    id: "kanal",
    name: "Kanałowa",
    district: "kanal",
    chunk: "kanal",
    kiosk: v(20, 0, 74.35),
    yaw: 0,
    arrival: v(20, 0, 75.9),
    arrivalYaw: Math.PI / 2,
    props: platform(20, 74, 1, -2.2),
  },
  // The market: under the north wall, east of the stalls.
  {
    id: "targ",
    name: "Targ pod estakadą",
    district: "targ",
    chunk: "targ-north",
    kiosk: v(118, 0, 105.65),
    yaw: Math.PI,
    arrival: v(118, 0, 104.1),
    arrivalYaw: -Math.PI / 2,
    props: [...platform(118, 106, -1, -2.2), neon(115, 3.6, 105.9, v(2.4, 0.6, 0.12), "#36c5ff", "METRO")],
  },
  // Doki: the yard's south edge, the far west end of the strip by the boundary wall.
  {
    id: "doki",
    name: "Doki Tessen",
    district: "doki",
    chunk: "doki-yard",
    kiosk: v(-33, 0, 91.55),
    yaw: 0,
    arrival: v(-33, 0, 92.9),
    arrivalYaw: Math.PI / 2,
    props: platform(-33, 91.2, 1, 2.2),
  },
];

export const metroStation = (id: MetroStationId): MetroStationDef => {
  const s = METRO_STATIONS.find((m) => m.id === id);
  if (!s) throw new Error(`no metro station ${id}`);
  return s;
};

/** The station whose kiosk is within reach of `p` (and on its level), or null. */
export const kioskAt = (p: Vec3, stations: readonly MetroStationDef[] = METRO_STATIONS): MetroStationDef | null =>
  stations.find((s) => Math.hypot(p.x - s.kiosk.x, p.z - s.kiosk.z) <= KIOSK_REACH && Math.abs(p.y - s.kiosk.y) <= 1.6) ?? null;
