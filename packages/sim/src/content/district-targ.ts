import { SeededRandom } from "../rng/seeded-random";
import type { ContractSiteId, Vec3 } from "@seki/core";
import { type ActorDef, type BlockMaterial, type Rect, type StaticProp, building, crate, lamp, neon, slab, v } from "./builders";

/**
 * Ulica Kanałowa and Targ pod estakadą: the M2 districts north-east of Shinsekai 7.
 *
 * The street leaves Shinsekai through the passage behind the car wash, runs north (segment A,
 * X ∈ [4, 10]) and turns east (segment B, Z ∈ [74, 82]) into the market under the elevated
 * highway (X ∈ [66, 126], Z ∈ [56, 116]). The bend keeps each district out of sight of the
 * other, so streaming one out never shows a hole. Facades, stalls and heights come from a
 * fixed-seed generator: the same tables on every run and every machine.
 */

/** Fixed content seed. Changing it reshuffles the districts (and the golden replay hash). */
const CONTENT_SEED = 0x7a26;

const pick = <T>(rng: SeededRandom, items: readonly [T, ...T[]]): T => items[Math.floor(rng.next() * items.length)] ?? items[0];
const between = (rng: SeededRandom, lo: number, hi: number): number => Math.round((lo + rng.next() * (hi - lo)) * 10) / 10;

/** Buildings side by side along X, covering [x0, x1] exactly. */
const facadeRow = (
  rng: SeededRandom,
  x0: number,
  x1: number,
  z: number,
  depth: number,
  heights: readonly [number, number],
  widths: readonly [number, number] = [12, 18],
): StaticProp[] => {
  const out: StaticProp[] = [];
  let x = x0;
  while (x1 - x > 0.01) {
    let w = between(rng, widths[0], widths[1]);
    // Never leave a sliver narrower than the minimum width at the end of the row.
    if (x1 - x - w < widths[0]) w = x1 - x;
    const material: BlockMaterial = pick(rng, ["concrete", "concrete", "glass", "metal"]);
    out.push(building(x + w / 2, z, w, between(rng, heights[0], heights[1]), depth, material));
    x += w;
  }
  return out;
};

const AWNINGS: readonly [BlockMaterial, ...BlockMaterial[]] = ["glass", "metal", "concrete"];
const STRIPS = ["#ff2e88", "#00e5ff", "#ffb000", "#39ff8a", "#b46cff"] as const;

/** A market stall: counter (solid) and awning (visual). `front` is the side customers stand on. */
const stall = (rng: SeededRandom, x: number, z: number, front: 1 | -1): StaticProp[] => [
  crate(x, z, 2.6, 1.0, 1.3),
  slab(x, 2.55, z + front * 0.4, v(3.2, 0.2, 2.4), pick(rng, AWNINGS)),
];

const rng = new SeededRandom(CONTENT_SEED);

// ---------------------------------------------------------------- Ulica Kanałowa

export const KANAL_BOUNDS: Rect = { minX: -8, maxX: 78, minZ: 52, maxZ: 90 };

export const KANAL_PROPS: readonly StaticProp[] = [
  slab(29, -0.1, 71, v(74, 0.2, 40), "asphalt"),
  // Strip of road under the market gate, a hair lower than the market's own ground.
  slab(72, -0.12, 78, v(12, 0.2, 12), "asphalt"),
  slab(35, 0.04, 81.2, v(62, 0.08, 1.6), "concrete"),
  // West of segment A, closing the bend.
  building(-2, 71, 12, 18, 38),
  // South of segment B: one long block that hides Shinsekai from the eastern half of the street.
  ...facadeRow(rng, 10, 66, 63, 22, [12, 20], [16, 20]),
  // North of segment B.
  ...facadeRow(rng, 4, 66, 86, 8, [10, 22], [13, 17]),
  // Kiosk just inside the market gate: the street's view ends on it, not on the market behind.
  building(74, 78, 6, 3.2, 10, "metal"),
  // Clutter.
  crate(8.7, 58, 1.4, 1.3, 2.6),
  crate(5.2, 70, 0.9, 1.1, 0.9),
  crate(30, 76.4, 6, 2.6, 2.2),
  neon(9.9, 6, 62, v(0.15, 4.5, 1.4), "#ffb000", "SAKE"),
  neon(13, 5.2, 81.9, v(7, 1.3, 0.15), "#ff2e88", "KARAOKE"),
  neon(44, 7, 81.9, v(5, 1.4, 0.15), "#00e5ff", "DENKI"),
  lamp(9.3, 67, "#9ad7ff"),
  lamp(50, 81.2, "#ffcf8a"),
];

// ---------------------------------------------------------------- Targ pod estakadą

export const TARG_SOUTH_BOUNDS: Rect = { minX: 66, maxX: 126, minZ: 56, maxZ: 84 };
export const TARG_NORTH_BOUNDS: Rect = { minX: 66, maxX: 126, minZ: 82, maxZ: 116 };

/** Oyaji keeps the first stall of the southern row. */
const OYAJI_STALL = { x: 80, z: 68 } as const;

/** Hana sells parts from a handcart in the middle of the market, facing the gate. */
const HANA_SPOT = { x: 92, z: 74 } as const;

const southStalls = (): StaticProp[] => {
  const out = stall(rng, OYAJI_STALL.x, OYAJI_STALL.z, 1);
  for (let x = OYAJI_STALL.x + between(rng, 7, 9); x < 108; x += between(rng, 7, 9)) out.push(...stall(rng, x, OYAJI_STALL.z, 1));
  return out;
};

export const TARG_SOUTH_PROPS: readonly StaticProp[] = [
  slab(96, -0.1, 70, v(60, 0.2, 28), "asphalt"),
  // Outer walls; the gap in the west wall (Z ∈ [74, 82]) is the gate from Ulica Kanałowa.
  building(67, 65, 2, 8, 18, "metal"),
  building(96, 57, 60, 6, 2, "metal"),
  building(125, 70, 2, 8, 28, "metal"),
  ...facadeRow(rng, 68, 114, 61, 6, [8, 16], [10, 16]),
  ...facadeRow(rng, 114, 124, 64, 12, [12, 20], [10, 10]),
  ...facadeRow(rng, 114, 124, 77, 14, [12, 20], [10, 10]),
  ...southStalls(),
  // Hana's handcart, just east of where she stands.
  crate(HANA_SPOT.x + 1.3, HANA_SPOT.z, 0.9, 1.0, 1.8),
  neon(113.9, 7, 66, v(0.15, 6, 1.4), "#ff2e88", "TAKO"),
  neon(113.9, 5.5, 78, v(0.15, 5.4, 1.2), "#39ff8a", "PACHI"),
  neon(OYAJI_STALL.x, 2.2, OYAJI_STALL.z + 0.7, v(2.4, 0.18, 0.1), pick(rng, STRIPS)),
  lamp(110, 73, "#ff9ad0"),
  lamp(88, 72.5, "#9ad7ff"),
];

const STALL_SIGNS = [
  ["RAMEN", "#ffb000"],
  ["DENKI", "#00e5ff"],
  ["SUSHI", "#ff4040"],
  ["OKONOMI", "#b46cff"],
] as const;

const northStalls = (): StaticProp[] => {
  const out: StaticProp[] = [];
  let signs = 0;
  for (let x = 76 + between(rng, 0, 2); x < 112; x += between(rng, 8, 10)) {
    out.push(...stall(rng, x, 102, -1));
    // Two lit signs; the rest of the row stays dark (point lights are a scarce resource).
    if (signs < 2 && rng.next() < 0.7) {
      const [label, color] = STALL_SIGNS[Math.floor(rng.next() * STALL_SIGNS.length)] ?? STALL_SIGNS[0];
      out.push(neon(x, 3.2, 100.5, v(2.6, 0.6, 0.15), color, label));
      signs += 1;
    }
  }
  return out;
};

export const TARG_NORTH_PROPS: readonly StaticProp[] = [
  slab(96, -0.1, 100, v(60, 0.2, 32), "asphalt"),
  building(67, 99, 2, 8, 34, "metal"),
  building(96, 115, 60, 6, 2, "metal"),
  building(125, 100, 2, 8, 32, "metal"),
  // The elevated highway: a deck on six pillars, walkable underneath.
  slab(96, 9.2, 92, v(60, 1.4, 10), "concrete"),
  slab(96, 10.3, 87.1, v(60, 0.8, 0.2), "metal"),
  slab(96, 10.3, 96.9, v(60, 0.8, 0.2), "metal"),
  ...[78, 96, 114].flatMap((x) => [building(x, 88.5, 1.4, 8.5, 1.4), building(x, 95.5, 1.4, 8.5, 1.4)]),
  neon(96, 7.4, 86.9, v(8, 1.4, 0.15), "#ffb000", "TARG"),
  ...northStalls(),
  // Hebi stash in the east corner under the highway: cover in front of the crate.
  crate(119.8, 92, 1.0, 1.1, 2.4),
  crate(122.5, 96.6, 1.6, 1.4, 1.4),
  ...facadeRow(rng, 68, 124, 110, 8, [10, 18]),
  lamp(116, 99, "#ffcf8a"),
];

/** Oyaji can be hurt: Hebi come for him in Hana's protection jobs. */
export const OYAJI_MAX_HP = 120;

export const TARG_SOUTH_ACTORS: readonly ActorDef[] = [
  {
    kind: "npc",
    spawn: { key: "oyaji", position: v(OYAJI_STALL.x, 0, OYAJI_STALL.z - 1.4), yaw: 0 },
    preset: "civilian",
    faction: "civilians",
    bystander: true,
    maxHp: OYAJI_MAX_HP,
    // By day the stall (plan §6); from 22:00 the schedule swaps in `oyaji_closed`.
    interactable: { kind: "shop", shopId: "oyaji", dialogueId: "oyaji", prompt: "Stragan Oyajiego", radius: 2.4 },
  },
  {
    kind: "npc",
    spawn: { key: "hana", position: v(HANA_SPOT.x, 0, HANA_SPOT.z), yaw: -Math.PI / 2 },
    preset: "civilian",
    faction: "civilians",
    interactable: { kind: "dialogue", dialogueId: "hana", prompt: "Rozmawiaj z Haną", radius: 2.4 },
  },
];

export const TARG_NORTH_ACTORS: readonly ActorDef[] = [
  { kind: "ganger", spawn: { key: "hebi-lookout", position: v(104, 0, 92), yaw: Math.PI, tag: null } },
];

/**
 * Spawn points of the market jobs, four per site like the M1 sites. A delivery spawns nobody;
 * its points are around Hana's cart, kept for symmetry.
 */
export const TARG_CONTRACT_SITE_SPAWNS: Readonly<Record<"hana_stall" | "hebi_stash" | "raid_north" | "raid_east", readonly Vec3[]>> = {
  hana_stall: [v(90.5, 0, 74), v(90.5, 0, 75.5), v(90.5, 0, 72.5), v(89, 0, 74)],
  hebi_stash: [v(118, 0, 89), v(119.5, 0, 95.5), v(116.5, 0, 92.5), v(121.5, 0, 88)],
  raid_north: [v(90, 0, 91), v(94, 0, 93), v(98, 0, 90.5), v(86, 0, 92.5)],
  raid_east: [v(110, 0, 74), v(111.5, 0, 78), v(108.5, 0, 71.5), v(112, 0, 81)],
};

/** Where the crate of a retrieval job lies (centre of the box). */
export const CONTRACT_ITEM_SPOTS: Readonly<Partial<Record<ContractSiteId, Vec3>>> = {
  hebi_stash: v(122.2, 0.3, 92),
};
