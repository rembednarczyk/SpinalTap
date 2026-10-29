import type { MetroStationId, Vec3, ViewDescriptor } from "@seki/core";
import { type StaticProp, placeAt, v } from "./builders";
import { againstWall } from "./lublin/places";
import { DOCKS_PLACE } from "./lublin/sites";
import { groundY } from "./lublin/terrain";
/** District ids as world-map.ts names them (kept local: world-map imports this table). */
type DistrictId = "shinsekai-7" | "kanal" | "targ" | "doki";

/**
 * Metro platforms (ADR-0034, moved into Lublin by ADR-0045): one per district, each a ticket
 * kiosk against a facade with a canopy over the stairs down, and the point where a rider comes
 * up again. Kept apart from the district tables (one entry in world-map.ts hooks them up), like
 * the devices of wave 1. The kiosk is the only solid, everything else is drawn.
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

/**
 * A platform against the facade nearest to (x, z) (ADR-0045): the kiosk with its back to the
 * wall, the canopy over the stairs down beside it (to the kiosk's right), the rider coming up in
 * front of it. The canopy and the stairwell's edge are drawn only.
 */
const station = (id: MetroStationId, name: string, district: DistrictId, chunk: string, x: number, z: number, sign?: string): MetroStationDef => {
  const wall = againstWall(x, z, 0.36);
  const yaw = wall.yaw;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  // The kiosk's right, seen from the street: the facing turned a quarter clockwise on the map.
  const rx = fz;
  const rz = -fx;
  const k = wall.at;
  const along = Math.abs(fx) > Math.abs(fz) ? "z" : "x";
  const canopy = v(along === "x" ? 4.4 : 2, 0.15, along === "x" ? 2 : 4.4);
  const edge = v(along === "x" ? 2.6 : 1.6, 0.04, along === "x" ? 1.6 : 2.6);
  const props: StaticProp[] = [
    // Over the stairs down: high enough to walk under.
    { center: v(k.x + rx * 2.2 + fx * 0.65, k.y + 2.9, k.z + rz * 2.2 + fz * 0.65), view: { kind: "block", size: canopy, material: "glass" }, solid: false },
    // The stairwell's edge on the pavement, flush with the ground.
    { center: v(k.x + rx * 3.5 + fx * 0.55, k.y + 0.02, k.z + rz * 3.5 + fz * 0.55), view: { kind: "block", size: edge, material: "metal" }, solid: false },
  ];
  if (sign) {
    const facing = along === "x" ? (fz > 0 ? "z+" : "z-") : fx > 0 ? "x+" : "x-";
    props.push({ center: v(k.x - rx * 1.6 - fx * 0.2, k.y + 3.6, k.z - rz * 1.6 - fz * 0.2), view: { kind: "neon", size: along === "x" ? v(2.4, 0.6, 0.12) : v(0.12, 0.6, 2.4), color: "#36c5ff", label: sign, facing }, solid: false });
  }
  const ax = k.x + fx * 1.5;
  const az = k.z + fz * 1.5;
  return { id, name, district, chunk, kiosk: k, yaw, arrival: v(ax, groundY(ax, az), az), arrivalYaw: yaw, props };
};

/** The docks' platform stays where the set piece had it: the yard's south edge by its wall. */
const docksStation = (): MetroStationDef => {
  const local = (x: number, y: number, z: number) => placeAt(DOCKS_PLACE, v(x, y, z));
  const props: StaticProp[] = [
    { center: local(-33 + 2.2, 2.9, 91.2 + 1.0), view: { kind: "block", size: v(4.4, 0.15, 2.0), material: "glass" }, solid: false },
    { center: local(-33 + 2.2 * 1.6, 0.02, 91.2 + 0.9), view: { kind: "block", size: v(2.6, 0.04, 1.6), material: "metal" }, solid: false },
  ];
  return { id: "doki", name: "Nabrzeże Bystrzycy", district: "doki", chunk: "nabrzeze-1-1", kiosk: local(-33, 0, 91.55), yaw: 0, arrival: local(-33, 0, 92.9), arrivalYaw: Math.PI / 2, props };
};

export const METRO_STATIONS: readonly MetroStationDef[] = [
  // Plac Litewski: against the house on the corner of the square and the deptak.
  station("shinsekai", "Plac Litewski", "shinsekai-7", "krakowskie-1-0", 158, -58.5, "METRO"),
  // Brama Krakowska: on Bramowa, inside the gate, on the Old Town's side.
  station("kanal", "Brama Krakowska", "kanal", "stare-miasto-0-0", 492, -80, "METRO"),
  // Plac Zamkowy: against the houses on the west side of the square, by the market.
  station("targ", "Plac Zamkowy", "targ", "podzamcze-0-0", 705, 289.5, "METRO"),
  docksStation(),
];

export const metroStation = (id: MetroStationId): MetroStationDef => {
  const s = METRO_STATIONS.find((m) => m.id === id);
  if (!s) throw new Error(`no metro station ${id}`);
  return s;
};

/** The station whose kiosk is within reach of `p` (and on its level), or null. */
export const kioskAt = (p: Vec3, stations: readonly MetroStationDef[] = METRO_STATIONS): MetroStationDef | null =>
  stations.find((s) => Math.hypot(p.x - s.kiosk.x, p.z - s.kiosk.z) <= KIOSK_REACH && Math.abs(p.y - s.kiosk.y) <= 1.6) ?? null;
