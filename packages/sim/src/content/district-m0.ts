import type { ContractSiteId, Vec3 } from "@seki/core";
import { M0_TARGET_TAG } from "@seki/core";
import { KANAL_CONTRACT_SITE_SPAWNS } from "./district-kanal";
import { type RoofStash, TARG_CONTRACT_SITE_FACING, TARG_CONTRACT_SITE_SPAWNS } from "./district-targ";
import { CAR_WASH_PROPS } from "./district-car-wash";
import { DOKI_CONTRACT_SITE_SPAWNS } from "./district-doki";
import {
  type ActorDef,
  type ActorSpawn,
  type GangerSpawn,
  type Placement,
  type StaticProp,
  crate,
  lamp,
  neon,
  placeAt,
  placeProps,
  skin,
  v,
} from "./builders";
import { BARMAN_SPAWN, CLINIC_WAKE_SPOT, CLINIC_WAKE_YAW, FIXER_BAR_SPAWN, KOI_REGULAR_SPAWNS, MORI_SPAWN, S7_INTERIORS } from "./interiors";
import { CAR_WASH_PLACE } from "./lublin/sites";
import { ground, groundY, onPaving } from "./lublin/terrain";

/**
 * Krakowskie Przedmieście (district `shinsekai-7`, ADR-0045): the deptak from Plac Litewski to
 * Brama Krakowska. The clinic and Neon Koi face each other across the deptak at x ≈ 320 (the
 * rooms in `interiors.ts`), the wreck Seki was pulled out of lies at the corner of Plac
 * Litewski, the van of the east lot is parked on the square, the car wash and the yard behind it
 * stand in a yard behind Plac Łokietka at the end of the deptak. The buildings are the map's
 * (`lublin/world.ts`); this table holds what the game adds. World coordinates, y on the
 * terrain.
 */

/** A group of props moved as one: drawn around its own origin, put on the ground at (x, z). */
const group = (x: number, z: number): Placement => ({ x, y: groundY(x, z), z });

/** The wreck and the old south gate of Shinsekai, at the corner of Plac Litewski (old origin near (0, -30)). */
const WRECK = group(150, -20);
/** The east lot with Tetsuo's van, on Plac Litewski (old origin (0, 0)). */
const EAST_LOT = group(100, -30);
/** Behind Neon Koi: the courtyard south of the bar (old origin (0, 0) of the street north of the bar). */
const KOI_BACK = group(300, -132);

/** A point of a group in the world, on the terrain under it. */
const on = (g: Placement, x: number, z: number): Vec3 => {
  const p = placeAt(g, v(x, 0, z));
  return v(p.x, groundY(p.x, p.z), p.z);
};

/** Signs and lamps of the deptak around the clinic and the bar. */
const deptak = (): StaticProp[] => [
  { ...neon(314, 3.2, -72.75, v(5, 1.1, 0.15), "#ffb000", "RAMEN"), center: ground(314, -72.75, 3.2) },
  { ...neon(306.5, 4.6, -71.95, v(6, 1.2, 0.15), "#39ff8a", "PACHINKO"), center: ground(306.5, -71.95, 4.6) },
  { ...neon(296.5, 5.5, -93.9, v(0.15, 5, 1.4), "#b46cff", "KUSURI"), center: ground(298.4, -93.4, 5.5), view: { kind: "neon", size: v(1.4, 5, 0.15), color: "#b46cff", label: "KUSURI", facing: "z+" } },
  { ...lamp(0, 0, "#9ad7ff"), center: ground(304, -76.4), view: { kind: "lamp", color: "#9ad7ff", facing: "z-" } },
  { ...lamp(0, 0, "#ff9ad0"), center: ground(334, -80.2), view: { kind: "lamp", color: "#ff9ad0", facing: "z-" } },
  { ...lamp(0, 0, "#ffcf8a"), center: ground(297, -90.4), view: { kind: "lamp", color: "#ffcf8a", facing: "z+" } },
  { ...lamp(0, 0, "#9ad7ff"), center: ground(326, -92.6), view: { kind: "lamp", color: "#9ad7ff", facing: "z+" } },
  // Plac Litewski: the lamp Shiro reads his poems under, one by the wreck.
  { ...lamp(0, 0, "#ffcf8a"), center: ground(100, -21), view: { kind: "lamp", color: "#ffcf8a", facing: "x+" } },
  { ...lamp(0, 0, "#9ad7ff"), center: ground(160, -48), view: { kind: "lamp", color: "#9ad7ff", facing: "x-" } },
];

/** Props of a group, each standing on the terrain under its own middle (the group's ground slopes away from its origin). */
const standing = (g: Placement, props: readonly StaticProp[]): StaticProp[] =>
  placeProps(g, props).map((p) => ({ ...p, center: { ...p.center, y: p.center.y - g.y + groundY(p.center.x, p.center.z) } }));

/**
 * What the game adds to Krakowskie Przedmieście: the wreck, the van, the car wash, the bins
 * behind Neon Koi, the signs and lamps, and the interiors with their doors.
 */
export const DISTRICT_M0_PROPS: readonly StaticProp[] = [
  // The wreck Seki was pulled out of; she comes round in Mori's clinic (ADR-0038).
  ...onPaving(placeProps(WRECK, [crate(2.6, -31, 2, 1.4, 4.4, skin("wreck", "z-"))])),
  // The van of the east lot.
  ...onPaving(placeProps(EAST_LOT, [crate(12, -12, 2.4, 2.2, 5, skin("van", "z+"))])),
  ...CAR_WASH_PROPS,
  // Behind Neon Koi, the bar's bins; a body fits in (ADR-0065).
  ...standing(KOI_BACK, [{ ...crate(6.5, 19.2, 1.2, 1.3, 2.2, skin("dumpster", "x-")), hide: "dumpster" }]),
  ...deptak(),
  // ADR-0038: the clinic, the bar and their doors.
  ...S7_INTERIORS,
];

/**
 * Where steam rises (the renderer's particles and the ambience's hiss): a manhole on the deptak
 * in front of the clinic and the vent behind the car wash.
 */
export const STEAM_VENTS: readonly Vec3[] = [ground(312, -83, 0.05), placeAt(CAR_WASH_PLACE, v(-5.2, 1.45, 44))];

/** A new game: Seki comes round on the treatment chair in Mori's clinic (ADR-0038). */
export const PLAYER_SPAWN: ActorSpawn = { key: "player", position: CLINIC_WAKE_SPOT, yaw: CLINIC_WAKE_YAW };

/** Kaito's place from the start: at the counter of Neon Koi, where Seki first meets him (G-034). */
export const FIXER_SPAWN: ActorSpawn = FIXER_BAR_SPAWN;

/** Babcia Ume sweeps the deptak in front of the clinic. */
export const CIVILIAN_SPAWN: ActorSpawn = { key: "ume", position: ground(328.5, -76.8), yaw: -Math.PI / 2 };
/** Her doorway for the night, by the clinic's building, and the corner on the way there. */
export const UME_HOME: Vec3 = ground(329.2, -73.4);
export const UME_CORNER: Vec3 = ground(329, -75.2);

/** Doktor Mori, the ripperdoc, in his clinic on the north side. */
export const RIPPERDOC_SPAWN: ActorSpawn = MORI_SPAWN;

/** Spawn points for procedural contracts (up to four gangers per site), the other districts' included. */
export const CONTRACT_SITE_SPAWNS: Readonly<Record<ContractSiteId, readonly Vec3[]>> = {
  ...TARG_CONTRACT_SITE_SPAWNS,
  ...DOKI_CONTRACT_SITE_SPAWNS,
  ...KANAL_CONTRACT_SITE_SPAWNS,
  east_lot: [on(EAST_LOT, 10.5, -15.5), on(EAST_LOT, 13.5, -8.5), on(EAST_LOT, 16, -14), on(EAST_LOT, 9.5, -9)],
  koi_back: [on(KOI_BACK, 3, 12), on(KOI_BACK, -3, 14.5), on(KOI_BACK, 5, 17), on(KOI_BACK, -1, 10)],
  car_wash: [on(CAR_WASH_PLACE, 1, 43), on(CAR_WASH_PLACE, -2.5, 39.5), on(CAR_WASH_PLACE, 4, 47), on(CAR_WASH_PLACE, -4, 47)],
  south_gate: [on(WRECK, -4, -33), on(WRECK, 4.5, -34.5), on(WRECK, -1, -35), on(WRECK, 6.5, -33.5)],
};

/** Points of the contract variations (ADR-0034) of Kaito's sites, by the same groups. */
export const KRAKOWSKIE_SITE_POINTS = {
  east_lot: (x: number, z: number) => on(EAST_LOT, x, z),
  koi_back: (x: number, z: number) => on(KOI_BACK, x, z),
  car_wash: (x: number, z: number) => on(CAR_WASH_PLACE, x, z),
  south_gate: (x: number, z: number) => on(WRECK, x, z),
} as const;

/**
 * The point each contract crew faces when it spawns (audit W11): the way trouble comes from.
 * Kaito's sites look onto the deptak or the square; the market's are in
 * `TARG_CONTRACT_SITE_FACING`. The docks posts carry their own yaw (ADR-0024).
 */
export const CONTRACT_SITE_FACING: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  ...TARG_CONTRACT_SITE_FACING,
  east_lot: on(EAST_LOT, 0, -12),
  koi_back: on(KOI_BACK, 0, 0),
  car_wash: on(CAR_WASH_PLACE, 0, 30),
  south_gate: on(WRECK, 0, -20),
};

/**
 * Yaw of a contract ganger spawned at `position` on `site`: towards the site's facing point, or,
 * for a site without one, towards the middle of its spawn points (the crew faces each other).
 */
export const contractSpawnYaw = (site: ContractSiteId, position: Vec3): number => {
  const points = CONTRACT_SITE_SPAWNS[site];
  const centre = CONTRACT_SITE_FACING[site] ?? {
    x: points.reduce((sum, p) => sum + p.x, 0) / Math.max(1, points.length),
    y: 0,
    z: points.reduce((sum, p) => sum + p.z, 0) / Math.max(1, points.length),
  };
  const dx = centre.x - position.x;
  const dz = centre.z - position.z;
  return Math.hypot(dx, dz) < 1e-6 ? 0 : Math.atan2(dx, dz);
};

/** The M0 courier and his guard, in the yard behind the car wash. */
export const GANGER_SPAWNS: readonly GangerSpawn[] = [
  { key: "courier", position: on(CAR_WASH_PLACE, 1, 43), yaw: Math.PI, tag: M0_TARGET_TAG },
  { key: "guard", position: on(CAR_WASH_PLACE, -2.5, 39.5), yaw: Math.PI, tag: null },
];

/** Every keyed character of the district, in creation order. */
export const DISTRICT_M0_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: FIXER_SPAWN,
    preset: "fixer",
    faction: "fixers",
    interactable: { kind: "dialogue", dialogueId: "fixer", prompt: "prompt.talk.kaito", radius: 2.6 },
  },
  {
    kind: "npc",
    spawn: CIVILIAN_SPAWN,
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "ume", prompt: "prompt.talk.ume", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: RIPPERDOC_SPAWN,
    preset: "ripperdoc",
    faction: "clinic",
    interactable: { kind: "shop", dialogueId: "mori", prompt: "prompt.shop.mori", radius: 2.4 },
  },
  ...GANGER_SPAWNS.map((spawn): ActorDef => ({ kind: "ganger", spawn })),
  // Neon Koi's barman and regulars (ADR-0038).
  {
    kind: "npc",
    spawn: BARMAN_SPAWN,
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    indoor: true,
    interactable: { kind: "dialogue", dialogueId: "koi_barman", prompt: "prompt.talk.barman", radius: 2.6 },
  },
  ...KOI_REGULAR_SPAWNS.map(
    (spawn): ActorDef => ({
      kind: "npc",
      spawn,
      preset: "civilian",
      faction: "civilians",
      bystander: true,
      indoor: true,
      interactable: { kind: "dialogue", dialogueId: "koi_regular", prompt: "prompt.chat", radius: 2 },
    }),
  ),
];

/**
 * Small finds in the dead ends of the deptak (ADR-0026): what a Hebi courier stuffed behind the
 * PACHINKO block, and the bins behind Neon Koi. Both lie more than 40 m from the clinic, so a
 * new game places them only once Seki walks along the deptak.
 */
export const S7_STASHES: readonly RoofStash[] = [
  {
    key: "stash:s7-pachinko",
    at: ground(272.5, -67),
    lines: [
      { kind: "eddies", qty: 80 },
      { kind: "ammo", ammo: "9mm", qty: 18 },
      { kind: "stack", item: "datachip", qty: 1 },
    ],
  },
  {
    key: "stash:s7-koi-back",
    at: on(KOI_BACK, 5, 19.2),
    lines: [
      { kind: "eddies", qty: 30 },
      { kind: "stack", item: "bandage", qty: 1 },
      { kind: "stack", item: "scrap", qty: 3 },
    ],
  },
];
