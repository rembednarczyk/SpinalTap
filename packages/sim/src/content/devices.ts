import type { ContractKind, FactionId, Vec3, ViewDescriptor } from "@seki/core";
import type { DeviceKind } from "../world/components";
import { type Rect, v } from "./builders";
import { W3_OFFICE, W3_SERVER_CAMERA, W3_SERVER_N, w3 } from "./tessen-w3";

import { spotNear } from "./lublin/places";
import { ground } from "./lublin/terrain";
import { arkadySpanMid } from "./alchemia/arkady";
import { ARKADY_OUT_YAW, HEBI_STASH_ZONE, byArkady } from "./alchemia/market";

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

/** Tessen's pass office in W-3's tower, inside its walls (the infiltration's no-go zone, ADR-0082). */
const TESSEN_OFFICE: Rect = { minX: W3_OFFICE.minX, maxX: W3_OFFICE.maxX, minZ: W3_OFFICE.minZ, maxZ: W3_OFFICE.maxZ };
/** Hebi's stash on T2 before the Arkady (the retrieval's no-go zone). */
const HEBI_STASH: Rect = HEBI_STASH_ZONE;

/** Chunks of W-3's tower and of its hall (ADR-0082), and of Alchemia (the market, ADR-0063) in Lublin's table. */
const TOWER_CHUNK = "nabrzeze-0-1";
const HALL_CHUNK = "nabrzeze-1-1";
const MARKET_CHUNK = "krakowskie-2-1";

export const DEVICES: readonly DeviceDef[] = [
  // W-3 (the docks' keys): the pass office in the tower, the tower's corner over the quay, the chamber's wall over the east yard.
  {
    key: "dev:doki-office-cam",
    chunk: TOWER_CHUNK,
    kind: "camera",
    position: w3(2486.6, 3, 445.4),
    // Into the room, towards the door.
    yaw: 1.82,
    network: "tessen-office",
    faction: "tessen",
    restricted: { ...TESSEN_OFFICE, during: "infiltrate" },
  },
  // Server room N in the hall: the sabotage's no-go zone round the calibration core (ADR-0082), shut off by `reboot_optics`.
  {
    key: "dev:w3-server-cam",
    chunk: HALL_CHUNK,
    kind: "camera",
    position: W3_SERVER_CAMERA.position,
    yaw: W3_SERVER_CAMERA.yaw,
    network: "tessen-yard",
    faction: "tessen",
    restricted: { ...W3_SERVER_N, during: "sabotage" },
  },
  { key: "dev:doki-quay-cam", chunk: TOWER_CHUNK, kind: "camera", position: w3(2485.7, 3, 437), yaw: -1.9, network: "tessen-office", faction: "tessen" },
  { key: "dev:doki-yard-cam", chunk: HALL_CHUNK, kind: "camera", position: w3(2572.3, 3.5, 410), yaw: Math.PI / 2, network: "tessen-yard", faction: "tessen" },
  { key: "dev:doki-vending", chunk: TOWER_CHUNK, kind: "vending", position: w3(2496.5, 0.95, 440), yaw: Math.PI / 2, network: "tessen-office", faction: "tessen" },
  { key: "dev:doki-speaker", chunk: HALL_CHUNK, kind: "speaker", position: w3(2572.3, 2.6, 425), yaw: Math.PI / 2, network: "tessen-yard", faction: "tessen" },
  // The market in Alchemia: Hebi's stash before the Arkady, the camera on their arches looking back along them; each in a span (`ARKADY_PIERS`).
  {
    key: "dev:targ-stash-cam",
    chunk: MARKET_CHUNK,
    kind: "camera",
    position: byArkady(arkadySpanMid(4), 0.4, 3.2),
    yaw: -2.3,
    network: "hebi-stash",
    faction: "hebi",
    restricted: { ...HEBI_STASH, during: "retrieve" },
  },
  { key: "dev:targ-neon", chunk: MARKET_CHUNK, kind: "neon", position: byArkady(arkadySpanMid(2), 0.1, 4.4), yaw: ARKADY_OUT_YAW, network: "hebi-stash", faction: "hebi" },
  { key: "dev:targ-speaker", chunk: MARKET_CHUNK, kind: "speaker", position: byArkady(arkadySpanMid(3), 0.25, 3.0), yaw: ARKADY_OUT_YAW, network: "hebi-stash", faction: "hebi" },
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
  // Podzamcze round the old market's place on Aleja Tysiąclecia, and the ends of Alchemia's square.
  spotNear(730, 295),
  spotNear(775, 366),
  spotNear(805, 360),
  ground(431, 121),
  ground(447, 58),
  // W-3 and the public strip by it (ADR-0082).
  ground(2527, 384),
  ground(2470, 384),
  ground(2550, 389.5),
  w3(2591, 0, 396),
  w3(2589, 0, 430),
  w3(2540, 0, 447),
  w3(2483, 0, 424),
  ground(2441, 440),
];
