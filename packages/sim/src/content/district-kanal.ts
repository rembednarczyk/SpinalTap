import type { Vec3 } from "@seki/core";
import { type ActorDef, type StaticProp, crate, v } from "./builders";
import type { RoofStash } from "./district-targ";
import { againstWall, spotNear } from "./lublin/places";
import { ground, groundY } from "./lublin/terrain";

/**
 * Stare Miasto (district `kanal`, ADR-0045): Hebi's ground from Brama Krakowska over the Rynek
 * round the Trybunał down Grodzka to Brama Grodzka. The people of the old Ulica Kanałowa keep
 * their trades here: Hideo drinks at SAKE on the Rynek and walks down Grodzka to the Tessen bus
 * at the market, Mei sings at KARAOKE on the Rynek, Tetsu keeps DENKI on its corner. Hebi deal
 * under the covered footbridge over Grodzka. The buildings are the map's; these are the game's
 * additions, in world coordinates.
 */

/** A neon sign on the facade nearest to (x, z), facing out of it. */
const facadeNeon = (x: number, z: number, y: number, width: number, height: number, color: string, label: string): StaticProp => {
  const w = againstWall(x, z, 0.12);
  const alongX = Math.abs(Math.sin(w.yaw)) < 0.5;
  const facing = alongX ? (Math.cos(w.yaw) > 0 ? "z+" : "z-") : Math.sin(w.yaw) > 0 ? "x+" : "x-";
  return {
    center: { x: w.at.x, y: w.at.y + y, z: w.at.z },
    view: { kind: "neon", size: alongX ? v(width, height, 0.15) : v(0.15, height, width), color, label, facing },
    solid: false,
  };
};

/** A street lamp at (x, z), its arm towards `facing`. */
const streetLamp = (x: number, z: number, color: string, facing: "x+" | "x-" | "z+" | "z-"): StaticProp => ({
  center: ground(x, z),
  view: { kind: "lamp", color, facing },
  solid: false,
});

/** Height of the covered footbridge's walkway over Grodzka (drawn only: it joins two houses). */
export const FOOTBRIDGE_TOP = 5;
/** The middle of Grodzka under the footbridge. */
const BRIDGE = { x: 659, z: 74 } as const;

/** The covered footbridge over Grodzka: a glazed box between the houses on either side, out of reach. */
const footbridge = (): StaticProp[] => {
  const y = groundY(BRIDGE.x, BRIDGE.z) + FOOTBRIDGE_TOP;
  return [
    { center: v(BRIDGE.x, y - 0.15, BRIDGE.z), view: { kind: "block", size: v(16, 0.3, 2.4), material: "metal" }, solid: false },
    { center: v(BRIDGE.x, y + 1.25, BRIDGE.z), view: { kind: "block", size: v(16, 2.5, 2.2), material: "glass" }, solid: false },
    { center: v(BRIDGE.x, y + 2.6, BRIDGE.z), view: { kind: "block", size: v(16.4, 0.2, 2.6), material: "metal" }, solid: false },
  ];
};

/**
 * Where the people of Stare Miasto stand (ADR-0026). Hideo, a clerk of the Tessen office,
 * walks down Grodzka to the Tessen bus at the market and back to SAKE on the Rynek; Mei sings
 * at KARAOKE by night; Tetsu keeps DENKI on the corner of the Rynek and Grodzka.
 */
export const KANAL_SPOTS = {
  hideoSake: spotNear(547.5, -71.5),
  hideoHome: spotNear(492, -80),
  meiKaraoke: spotNear(556, -38.5),
  meiHome: spotNear(533, -50),
  tetsu: spotNear(571.5, -31),
} as const;

/**
 * Hideo's way from the Rynek down Grodzka, under the footbridge and through Brama Grodzka, to
 * the bus stop on Zamkowa below the gate (along the streets' middle lines). A minute of play is
 * an hour of the day (ADR-0017), so a walk of 300 m takes him four hours (ADR-0045).
 */
export const GRODZKA_WALK: readonly Vec3[] = [
  [561, -40],
  [573, -28],
  [577, -23],
  [610, 14],
  [637, 47],
  [708, 134],
  [722, 147],
].map(([x, z]) => ground(x as number, z as number));

export const KANAL_PROPS: readonly StaticProp[] = [
  facadeNeon(546, -73, 3.2, 0.9 * 1.4, 3.6, "#ffb000", "SAKE"),
  facadeNeon(556, -36.5, 4.2, 6, 1.2, "#ff2e88", "KARAOKE"),
  facadeNeon(571, -29.5, 4.6, 5, 1.2, "#00e5ff", "DENKI"),
  streetLamp(552, -48, "#9ad7ff", "x+"),
  streetLamp(598, -28, "#ffcf8a", "x-"),
  streetLamp(652, 70, "#ffcf8a", "x+"),
  ...footbridge(),
  // Tetsu's table of gadgets in front of DENKI, and crates under the footbridge where Hebi meet
  // (Kaito's site `kanal_bridge`).
  { ...crate(0, 0, 1.4, 0.9, 0.7), center: { ...ground(KANAL_SPOTS.tetsu.x + 0.8, KANAL_SPOTS.tetsu.z - 1), y: groundY(KANAL_SPOTS.tetsu.x + 0.8, KANAL_SPOTS.tetsu.z - 1) + 0.45 } },
  { ...crate(0, 0, 1.2, 0.9, 1.0), center: { ...ground(655.5, 76.5), y: groundY(655.5, 76.5) + 0.45 } },
  { ...crate(0, 0, 0.9, 0.8, 0.9), center: { ...ground(663, 71.5), y: groundY(663, 71.5) + 0.4 } },
];

export const KANAL_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: { key: "hideo", position: KANAL_SPOTS.hideoSake, yaw: againstWall(547.5, -71.5).yaw },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "hideo", prompt: "Rozmawiaj z Hideo", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: { key: "tetsu", position: KANAL_SPOTS.tetsu, yaw: againstWall(571.5, -31).yaw },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "tetsu", prompt: "Rozmawiaj z Tetsu (DENKI)", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: { key: "mei", position: KANAL_SPOTS.meiKaraoke, yaw: againstWall(556, -38.5).yaw },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "mei", prompt: "Rozmawiaj z Mei", radius: 2.4 },
  },
];

/** Kaito's job under the footbridge (ADR-0026): Hebi trading chips on Grodzka in its shadow. */
export const KANAL_CONTRACT_SITE_SPAWNS: Readonly<Record<"kanal_bridge", readonly Vec3[]>> = {
  kanal_bridge: [spotNear(659.5, 74.5), spotNear(656.5, 71.5), spotNear(662, 77.5), spotNear(657.5, 76)],
};

/** A bag left behind the dumpster under Brama Krakowska, on the deptak's side (ADR-0026). */
export const KANAL_ALLEY_STASH: RoofStash = {
  key: "stash:kanal-alley",
  at: spotNear(459.5, -99),
  lines: [
    { kind: "eddies", qty: 60 },
    { kind: "stack", item: "bandage", qty: 1 },
    { kind: "stack", item: "yakitori", qty: 2 },
    { kind: "stack", item: "scrap", qty: 2 },
  ],
};
