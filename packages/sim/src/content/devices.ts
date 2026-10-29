import type { ContractKind, FactionId, Vec3, ViewDescriptor } from "@seki/core";
import type { DeviceKind } from "../world/components";
import { type Rect, placeAt, placeRect, v } from "./builders";
import { DOCKS_PLACE, MARKET_PLACE } from "./lublin/sites";
import { ground } from "./lublin/terrain";

/**
 * Cameras and hackable devices (ADR-0029), and the ways the district's security comes in when
 * the heat is up. Kept apart from the district tables (one entry in world-map.ts hooks them up),
 * so the districts' own content stays where it is. Every device names its chunk; streaming
 * spawns it with that chunk. None is solid: they hang on walls and stand against them, so the
 * collision and the AI's ground raster stay as they were.
 */
export interface DeviceDef {
  readonly key: string;
  readonly chunk: string;
  readonly kind: DeviceKind;
  /** Centre of the device. */
  readonly position: Vec3;
  /** A camera looks along this yaw (0 faces +Z). */
  readonly yaw: number;
  readonly network: string;
  readonly faction: FactionId;
  /** A camera watching a no-go zone; with `during`, only while a contract of that kind runs. */
  readonly restricted?: Rect & { readonly during?: ContractKind };
}

const VIEWS: Readonly<Record<DeviceKind, ViewDescriptor>> = {
  camera: { kind: "block", size: v(0.3, 0.25, 0.45), material: "metal" },
  vending: { kind: "block", size: v(0.9, 1.9, 0.8), material: "glass" },
  speaker: { kind: "block", size: v(0.5, 0.6, 0.35), material: "metal" },
  neon: { kind: "neon", size: v(2.2, 0.6, 0.12), color: "#ff3b8d", label: "HEBI" },
};

export const deviceView = (kind: DeviceKind): ViewDescriptor => VIEWS[kind];

/** Tessen's office on the quay, inside its walls (the infiltration's no-go zone). */
const TESSEN_OFFICE: Rect = placeRect(DOCKS_PLACE, { minX: -29.7, maxX: -18.3, minZ: 128.3, maxZ: 137.7 });
/** Hebi's stash under the overpass at the east end of the market (the retrieval's no-go zone). */
const HEBI_STASH: Rect = placeRect(MARKET_PLACE, { minX: 114, maxX: 124, minZ: 86, maxZ: 98 });

/** Chunks of the docks and the market in Lublin's table. */
const DOCKS_CHUNK = "nabrzeze-1-1";
const MARKET_CHUNK = "podzamcze-1-0";
const docks = (x: number, y: number, z: number) => placeAt(DOCKS_PLACE, v(x, y, z));
const market = (x: number, y: number, z: number) => placeAt(MARKET_PLACE, v(x, y, z));

export const DEVICES: readonly DeviceDef[] = [
  // Doki: the office, its door onto the quay, the yard.
  {
    key: "dev:doki-office-cam",
    chunk: DOCKS_CHUNK,
    kind: "camera",
    position: docks(-29.2, 3, 137.2),
    // Into the room, towards the door.
    yaw: 2.02,
    network: "tessen-office",
    faction: "tessen",
    restricted: { ...TESSEN_OFFICE, during: "infiltrate" },
  },
  { key: "dev:doki-quay-cam", chunk: DOCKS_CHUNK, kind: "camera", position: docks(-17.7, 3, 127.8), yaw: 1.2, network: "tessen-office", faction: "tessen" },
  { key: "dev:doki-yard-cam", chunk: DOCKS_CHUNK, kind: "camera", position: docks(-15.5, 3.5, 95.5), yaw: Math.PI / 2, network: "tessen-yard", faction: "tessen" },
  { key: "dev:doki-vending", chunk: DOCKS_CHUNK, kind: "vending", position: docks(-24, 0.95, 127.6), yaw: Math.PI, network: "tessen-office", faction: "tessen" },
  { key: "dev:doki-speaker", chunk: DOCKS_CHUNK, kind: "speaker", position: docks(12, 2.6, 95.8), yaw: 0, network: "tessen-yard", faction: "tessen" },
  // The market: Hebi's stash.
  {
    key: "dev:targ-stash-cam",
    chunk: MARKET_CHUNK,
    kind: "camera",
    position: market(123.6, 3.2, 99.5),
    yaw: -2.69,
    network: "hebi-stash",
    faction: "hebi",
    restricted: { ...HEBI_STASH, during: "retrieve" },
  },
  { key: "dev:targ-neon", chunk: MARKET_CHUNK, kind: "neon", position: market(116.5, 3.4, 98.6), yaw: Math.PI, network: "hebi-stash", faction: "hebi" },
  { key: "dev:targ-speaker", chunk: MARKET_CHUNK, kind: "speaker", position: market(118, 2.6, 97), yaw: Math.PI, network: "hebi-stash", faction: "hebi" },
];

/**
 * Where the security's reinforcements come in (ADR-0029): ends of the streets, alleys between
 * blocks, the passage into the docks. The heat system picks one out of the player's sight.
 */
export const SECURITY_ENTRIES: readonly Vec3[] = [
  // Krakowskie Przedmieście: both ends of the deptak, the side streets and the courtyard by Neon Koi.
  ground(150, -55),
  ground(450, -96),
  ground(284, -86),
  ground(338, -95),
  ground(283, -112),
  ground(425, -100),
  ground(278, -68),
  // Stare Miasto: Bramowa, the Rynek, Grodzka.
  ground(482, -88),
  ground(560, -45),
  ground(600, -8),
  ground(640, 50),
  ground(700, 125),
  // The market.
  market(110, 0, 74),
  market(100, 0, 90),
  market(80, 0, 100),
  market(72, 0, 92),
  market(118, 0, 100),
  // The docks.
  docks(27, 0, 94),
  docks(-12, 0, 96),
  docks(14, 0, 106),
  docks(16, 0, 122),
  docks(-4, 0, 124),
  docks(28, 0, 128),
  docks(-16, 0, 130),
  docks(2, 0, 149),
];
