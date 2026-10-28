import type { ContractSiteId, Vec3 } from "@seki/core";
import { M0_TARGET_TAG } from "@seki/core";
import { KANAL_CONTRACT_SITE_SPAWNS, type RoofStash, TARG_CONTRACT_SITE_FACING, TARG_CONTRACT_SITE_SPAWNS } from "./district-targ";
import { DOKI_CONTRACT_SITE_SPAWNS } from "./district-doki";
import { type ActorDef, type ActorSpawn, type GangerSpawn, type Rect, type StaticProp, building, crate, lamp, neon, rail, skin, slab, v } from "./builders";

/** Width of the main street between the facades (X from -7 to 7). */
const STREET = 14;

/**
 * MYJNIA 24H (ADR-0026) in the bay of the east row between the tower and the alley block
 * (X ∈ [7, 21], Z ∈ [26, 35]): the machine room against the district wall, a canopy on two
 * posts over the bay, the wash gantry and a car being washed. The sign hangs on the canopy,
 * facing the street. The contract site `car_wash` is the alley behind it, to the north.
 */
const carWash = (): StaticProp[] => [
  building(18, 30.5, 6, 4.6, 9, "concrete", skin("shop", "x-", { signs: false })),
  // Canopy and gantry beam: visual, and thicker than a sidewalk so the minimap skips them.
  slab(11.6, 4.45, 30.5, v(7, 0.36, 8.4), "metal"),
  building(8.4, 26.6, 0.3, 4.3, 0.3, "metal"),
  building(8.4, 34.4, 0.3, 4.3, 0.3, "metal"),
  building(12.5, 27.6, 1.2, 3.4, 0.3, "glass"),
  building(12.5, 33.4, 1.2, 3.4, 0.3, "glass"),
  slab(12.5, 3.5, 30.5, v(1.2, 0.36, 5.5), "metal"),
  crate(11.2, 30.5, 4.2, 1.5, 2, skin("car", "x+")),
  neon(8.2, 5.1, 30.5, v(0.15, 0.9, 6), "#ff4040", "MYJNIA 24H"),
];

/**
 * Shinsekai, block 7: the M0 vertical-slice district. Pure data, consumed by the world factory.
 * Coordinates: Y up, +Z north. The main street runs north along X ∈ [-7, 7]. The car wash
 * stands in the bay of the east row (Z ∈ [26, 35]); the alley behind it runs north to a gap in
 * the north wall (X ∈ [4.8, 9]) that leads onto Ulica Kanałowa.
 */
export const DISTRICT_M0_PROPS: readonly StaticProp[] = [
  { center: v(0, -0.1, 7), view: { kind: "block", size: v(46, 0.2, 88), material: "asphalt" }, solid: false },
  // Sidewalks (visual only).
  { center: v(-7.8, 0.04, -2), view: { kind: "block", size: v(1.6, 0.08, 66), material: "concrete" }, solid: false },
  { center: v(7.8, 0.04, -2), view: { kind: "block", size: v(1.6, 0.08, 66), material: "concrete" }, solid: false },
  // West block. Looks (ADR-0022): the street's own neon hangs on the clinic, ramen bar and
  // pachinko facades, so those get no generic signs.
  building(-14, -26, 14, 18, 14, "concrete", skin("tenement", "x+", { street: STREET })),
  building(-14, -9, 14, 26, 16, "glass", skin("tower", "x+")),
  building(-14, 8, 14, 14, 14, "concrete", skin("shop", "x+", { street: STREET, signs: false })),
  building(-14, 24, 14, 30, 14, "glass", skin("tower", "x+")),
  // East block. E2 is the Neon Koi bar.
  building(14, -25, 14, 22, 16, "glass", skin("tower", "x-")),
  building(14, 2, 14, 10, 18, "concrete", skin("bar", "x-", { signs: false })),
  building(14, 20, 14, 34, 12, "glass", skin("tower", "x-")),
  // Northern alley behind the car wash.
  building(-14, 40, 14, 20, 18, "concrete", skin("tenement", "x+", { street: 14 })),
  building(15, 42, 12, 16, 14, "metal", skin("tenement", "x-", { signs: false })),
  // District bounds.
  building(0, -37, 46, 6, 2, "metal"),
  // North wall, split around the passage to Ulica Kanałowa (X ∈ [4.8, 9]). Under 8 m, so the
  // engine's set dressing does not treat the pieces as buildings.
  building(-9.1, 51, 27.8, 6, 2, "metal"),
  building(16, 51, 14, 6, 2, "metal"),
  building(-22, 7, 2, 8, 88, "metal"),
  building(22, 7, 2, 8, 88, "metal"),
  // The wreck Seki wakes up next to.
  crate(2.6, -31, 2, 1.4, 4.4, skin("wreck", "z-")),
  // Parked van in the east lot.
  crate(12, -12, 2.4, 2.2, 5, skin("van", "z+")),
  // Alley cover: crates, two dumpsters and a parked car.
  crate(-3, 36, 1.6, 1.2, 1.2),
  crate(4, 38.5, 1.2, 1.2, 2.4, skin("dumpster", "x-")),
  crate(-5, 44, 2.4, 1.4, 1.4, skin("dumpster", "z-")),
  crate(5.5, 45.5, 2, 1.5, 4.2, skin("car", "z+")),
  // Neon signage.
  neon(6.9, 6.2, 2, v(0.15, 1.6, 8), "#ff2e88", "NEON KOI"),
  neon(-6.9, 11, -9, v(0.15, 7, 1.6), "#00e5ff", "HOTEL"),
  neon(-6.9, 5, 8, v(0.15, 1.4, 5), "#ffb000", "RAMEN"),
  neon(6.9, 14, 20, v(0.15, 8, 1.6), "#b46cff", "KUSURI"),
  neon(-6.9, 7, 24, v(0.15, 1.2, 6), "#39ff8a", "PACHINKO"),
  neon(-6.9, 3.4, 2.4, v(0.15, 0.9, 3.4), "#39ffd0", "KLINIKA"),
  // Street lamps (each one is also a point light).
  lamp(-6.4, -22, "#9ad7ff"),
  lamp(6.4, -6, "#ff9ad0"),
  lamp(-6.4, 10, "#9ad7ff"),
  lamp(6.4, 26, "#ffcf8a"),
  lamp(-1, 40, "#ff6a6a"),
  // ADR-0026, appended so the props above keep their order.
  ...carWash(),
  // The 2 m slots between the west blocks: the south two are fenced off above a jump, the
  // north one hides a Hebi courier's drop (S7_STASHES). Behind Neon Koi, the bar's bins.
  rail(-7.4, -7.2, -19, -17, 0, 2.7),
  rail(-7.4, -7.2, -1, 1, 0, 2.7),
  crate(19.7, 12.5, 1.2, 1.3, 2.2, skin("dumpster", "x-")),
];

export const PLAYER_SPAWN: ActorSpawn = { key: "player", position: v(0, 0, -28), yaw: 0 };

export const FIXER_SPAWN: ActorSpawn = { key: "fixer", position: v(6.2, 0, 1.5), yaw: -Math.PI / 2 };

export const CIVILIAN_SPAWN: ActorSpawn = { key: "ume", position: v(-5.4, 0, -13), yaw: Math.PI / 2 };

/** Doktor Mori, the ripperdoc, in front of the clinic on the west side. */
export const RIPPERDOC_SPAWN: ActorSpawn = { key: "mori", position: v(-6.2, 0, 2.4), yaw: Math.PI / 2 };

/** Spawn points for procedural contracts (up to four gangers per site), the market's included. */
export const CONTRACT_SITE_SPAWNS: Readonly<Record<ContractSiteId, readonly Vec3[]>> = {
  ...TARG_CONTRACT_SITE_SPAWNS,
  ...DOKI_CONTRACT_SITE_SPAWNS,
  ...KANAL_CONTRACT_SITE_SPAWNS,
  east_lot: [v(10.5, 0, -15.5), v(13.5, 0, -8.5), v(16, 0, -14), v(9.5, 0, -9)],
  koi_back: [v(3, 0, 12), v(-3, 0, 14.5), v(5, 0, 17), v(-1, 0, 10)],
  car_wash: [v(1, 0, 43), v(-2.5, 0, 39.5), v(4, 0, 47), v(-4, 0, 47)],
  south_gate: [v(-4, 0, -33), v(4.5, 0, -34.5), v(-1, 0, -35), v(6.5, 0, -33.5)],
};

/**
 * The point each contract crew faces when it spawns (audit W11): the way trouble comes from.
 * Kaito's sites look onto the main street or towards Kaito's corner; the market's are in
 * `TARG_CONTRACT_SITE_FACING`. The docks posts carry their own yaw (ADR-0024).
 */
export const CONTRACT_SITE_FACING: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  ...TARG_CONTRACT_SITE_FACING,
  east_lot: v(0, 0, -12),
  koi_back: v(FIXER_SPAWN.position.x, 0, FIXER_SPAWN.position.z),
  car_wash: v(0, 0, 30),
  south_gate: v(0, 0, -20),
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

export const GANGER_SPAWNS: readonly GangerSpawn[] = [
  { key: "courier", position: v(1, 0, 43), yaw: Math.PI, tag: M0_TARGET_TAG },
  { key: "guard", position: v(-2.5, 0, 39.5), yaw: Math.PI, tag: null },
];

/** Every keyed character of the district, in creation order. */
export const DISTRICT_M0_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: FIXER_SPAWN,
    preset: "fixer",
    faction: "fixers",
    interactable: { kind: "dialogue", dialogueId: "fixer", prompt: "Rozmawiaj z Kaito", radius: 2.6 },
  },
  {
    kind: "npc",
    spawn: CIVILIAN_SPAWN,
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "ume", prompt: "Rozmawiaj z babcią Ume", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: RIPPERDOC_SPAWN,
    preset: "ripperdoc",
    faction: "clinic",
    interactable: { kind: "shop", dialogueId: "mori", prompt: "Klinika doktora Mori", radius: 2.4 },
  },
  ...GANGER_SPAWNS.map((spawn): ActorDef => ({ kind: "ganger", spawn })),
];

/**
 * Small finds in Shinsekai's dead ends (ADR-0026): what a Hebi courier stuffed into the slot
 * behind PACHINKO, and the bins behind Neon Koi. Both lie more than 40 m from the player's
 * spawn, so a new game places them only once Seki walks up the street.
 */
export const S7_STASHES: readonly RoofStash[] = [
  {
    key: "stash:s7-pachinko",
    at: v(-19.6, 0, 16),
    lines: [
      { kind: "eddies", qty: 80 },
      { kind: "ammo", ammo: "9mm", qty: 18 },
      { kind: "stack", item: "datachip", qty: 1 },
    ],
  },
  {
    key: "stash:s7-koi-back",
    at: v(18.2, 0, 12.5),
    lines: [
      { kind: "eddies", qty: 30 },
      { kind: "stack", item: "bandage", qty: 1 },
      { kind: "stack", item: "scrap", qty: 3 },
    ],
  },
];

/** Footprint of the district including its outer walls. */
export const DISTRICT_M0_BOUNDS: Rect = { minX: -23, maxX: 23, minZ: -38, maxZ: 52 };
