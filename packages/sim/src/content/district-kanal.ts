import type { Vec3, ViewDescriptor } from "@seki/core";
import { type ActorDef, type StaticProp, crate, v } from "./builders";
import type { RoofStash } from "./district-targ";
import { KANAL_PATROL_ACTORS } from "./kanal-patrols";
import { againstWall, spotNear } from "./lublin/places";
import { TRASA_PODZIEMNA } from "./lublin/sites";
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

/** Height of the covered footbridge's floor over Grodzka (drawn only: it joins two houses). */
export const FOOTBRIDGE_TOP = 4.6;
/**
 * The covered footbridge over Grodzka (ADR-0048): a one-storey house on a soffit between the
 * hotel at Grodzka 20 and the "Pod Akacją" house across the street, drawn by the map city with
 * the Old Town's plaster, windows, cornice and a tiled hipped roof. Its ends stand 0.4 m into
 * the houses; across Grodzka it is 3.2 m deep. Out of reach, so only scenery.
 */
const FOOTBRIDGE = (() => {
  const hotel = { x: 652.36, z: 79.52 };
  const akacja = { x: 666.37, z: 72.24 };
  const len = Math.hypot(akacja.x - hotel.x, akacja.z - hotel.z);
  const n = { x: (akacja.x - hotel.x) / len, z: (akacja.z - hotel.z) / len };
  const u = { x: -n.z, z: n.x };
  const c = { x: (hotel.x + akacja.x) / 2, z: (hotel.z + akacja.z) / 2 };
  const half = len / 2 + 0.4;
  const depth = 1.6;
  const corner = (a: number, b: number) => ({ x: n.x * half * a + u.x * depth * b, z: n.z * half * a + u.z * depth * b });
  return { center: c, outline: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)] };
})();

/** The footbridge as a building of the map city (ADR-0048), drawn for good like the city. */
export const KANAL_SCENERY: readonly { readonly view: ViewDescriptor; readonly at: Vec3 }[] = [
  {
    at: ground(FOOTBRIDGE.center.x, FOOTBRIDGE.center.z),
    view: { kind: "building", outline: FOOTBRIDGE.outline, height: FOOTBRIDGE_TOP + 3.4, levels: 2, use: "residential", roof: 1.4, look: 0x6b1ad6e, soffit: FOOTBRIDGE_TOP },
  },
];

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
  // Over the Trybunał's door into Trasa Podziemna (ADR-0048), clear of the slanting facade.
  { center: v(566.8, TRASA_PODZIEMNA.door + 4.35, -57), view: { kind: "neon", size: v(0.15, 0.5, 1.8), color: "#ffcf8a", label: "TRASA PODZIEMNA", facing: "x-" }, solid: false },
  streetLamp(552, -48, "#9ad7ff", "x+"),
  streetLamp(598, -28, "#ffcf8a", "x-"),
  streetLamp(652, 70, "#ffcf8a", "x+"),
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
    interactable: { kind: "dialogue", dialogueId: "hideo", prompt: "prompt.talk.hideo", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: { key: "tetsu", position: KANAL_SPOTS.tetsu, yaw: againstWall(571.5, -31).yaw },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "tetsu", prompt: "prompt.talk.tetsu", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: { key: "mei", position: KANAL_SPOTS.meiKaraoke, yaw: againstWall(556, -38.5).yaw },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    interactable: { kind: "dialogue", dialogueId: "mei", prompt: "prompt.talk.mei", radius: 2.4 },
  },
  ...KANAL_PATROL_ACTORS,
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
