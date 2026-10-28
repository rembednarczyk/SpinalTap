import type { ContractKind, FactionId, Vec3, ViewDescriptor } from "@seki/core";
import type { DeviceKind } from "../world/components";
import { type Rect, v } from "./builders";

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
const TESSEN_OFFICE: Rect = { minX: -29.7, maxX: -18.3, minZ: 128.3, maxZ: 137.7 };
/** Hebi's stash under the overpass at the east end of the market (the retrieval's no-go zone). */
const HEBI_STASH: Rect = { minX: 114, maxX: 124, minZ: 86, maxZ: 98 };

export const DEVICES: readonly DeviceDef[] = [
  // Doki: the office, its door onto the quay, the yard.
  {
    key: "dev:doki-office-cam",
    chunk: "doki-quay",
    kind: "camera",
    position: v(-29.2, 3, 137.2),
    // Into the room, towards the door.
    yaw: 2.02,
    network: "tessen-office",
    faction: "tessen",
    restricted: { ...TESSEN_OFFICE, during: "infiltrate" },
  },
  { key: "dev:doki-quay-cam", chunk: "doki-quay", kind: "camera", position: v(-17.7, 3, 127.8), yaw: 1.2, network: "tessen-office", faction: "tessen" },
  { key: "dev:doki-yard-cam", chunk: "doki-yard", kind: "camera", position: v(-15.5, 3.5, 95.5), yaw: Math.PI / 2, network: "tessen-yard", faction: "tessen" },
  { key: "dev:doki-vending", chunk: "doki-quay", kind: "vending", position: v(-24, 0.95, 127.6), yaw: Math.PI, network: "tessen-office", faction: "tessen" },
  { key: "dev:doki-speaker", chunk: "doki-yard", kind: "speaker", position: v(12, 2.6, 95.8), yaw: 0, network: "tessen-yard", faction: "tessen" },
  // The market: Hebi's stash.
  {
    key: "dev:targ-stash-cam",
    chunk: "targ-north",
    kind: "camera",
    position: v(123.6, 3.2, 99.5),
    yaw: -2.69,
    network: "hebi-stash",
    faction: "hebi",
    restricted: { ...HEBI_STASH, during: "retrieve" },
  },
  { key: "dev:targ-neon", chunk: "targ-north", kind: "neon", position: v(116.5, 3.4, 98.6), yaw: Math.PI, network: "hebi-stash", faction: "hebi" },
  { key: "dev:targ-speaker", chunk: "targ-north", kind: "speaker", position: v(118, 2.6, 97), yaw: Math.PI, network: "hebi-stash", faction: "hebi" },
];

/**
 * Where the security's reinforcements come in (ADR-0029): ends of the streets, alleys between
 * blocks, the passage into the docks. The heat system picks one out of the player's sight.
 */
export const SECURITY_ENTRIES: readonly Vec3[] = [
  // Shinsekai 7: both ends of the street and the gaps between the blocks.
  v(0, 0, -35),
  v(7, 0, 49),
  v(-10, 0, -18),
  v(17, 0, -9),
  v(-10, 0, 16),
  v(12, 0, 12.5),
  v(12, 0, 30),
  // Ulica Kanałowa.
  v(10, 0, 78),
  v(40, 0, 78),
  v(64, 0, 78),
  v(27, 0, 88),
  // The market.
  v(110, 0, 74),
  v(100, 0, 90),
  v(80, 0, 100),
  v(72, 0, 92),
  v(118, 0, 100),
  // Doki.
  v(27, 0, 94),
  v(-12, 0, 96),
  v(14, 0, 106),
  v(16, 0, 122),
  v(-4, 0, 124),
  v(28, 0, 128),
  v(-16, 0, 130),
  v(2, 0, 149),
];
