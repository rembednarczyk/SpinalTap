import type { ContractSiteId, Vec3 } from "@seki/core";
import { M0_TARGET_TAG } from "@seki/core";
import { TARG_CONTRACT_SITE_SPAWNS } from "./district-targ";
import { DOKI_CONTRACT_SITE_SPAWNS } from "./district-doki";
import { type ActorDef, type ActorSpawn, type GangerSpawn, type Rect, type StaticProp, building, crate, lamp, neon, skin, v } from "./builders";

/** Width of the main street between the facades (X from -7 to 7). */
const STREET = 14;

/**
 * Shinsekai, block 7: the M0 vertical-slice district. Pure data, consumed by the world factory.
 * Coordinates: Y up, +Z north. The main street runs north along X ∈ [-7, 7]. A gap in the
 * north wall behind the car wash (X ∈ [4.8, 9]) leads onto Ulica Kanałowa.
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
  neon(0, 4, 49.9, v(9, 1.2, 0.15), "#ff4040", "MYJNIA 24H"),
  neon(-6.9, 3.4, 2.4, v(0.15, 0.9, 3.4), "#39ffd0", "KLINIKA"),
  // Street lamps (each one is also a point light).
  lamp(-6.4, -22, "#9ad7ff"),
  lamp(6.4, -6, "#ff9ad0"),
  lamp(-6.4, 10, "#9ad7ff"),
  lamp(6.4, 26, "#ffcf8a"),
  lamp(-1, 40, "#ff6a6a"),
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
  east_lot: [v(10.5, 0, -15.5), v(13.5, 0, -8.5), v(16, 0, -14), v(9.5, 0, -9)],
  koi_back: [v(3, 0, 12), v(-3, 0, 14.5), v(5, 0, 17), v(-1, 0, 10)],
  car_wash: [v(1, 0, 43), v(-2.5, 0, 39.5), v(4, 0, 47), v(-4, 0, 47)],
  south_gate: [v(-4, 0, -33), v(4.5, 0, -34.5), v(-1, 0, -35), v(6.5, 0, -33.5)],
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

/** Footprint of the district including its outer walls. */
export const DISTRICT_M0_BOUNDS: Rect = { minX: -23, maxX: 23, minZ: -38, maxZ: 52 };
