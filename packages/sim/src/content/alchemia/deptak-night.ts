import { type ActivityId, type StreetPropItem, type Vec3, figureVariant } from "@seki/core";
import type { CrowdSpot } from "../crowd-spot";
import { groundY } from "../lublin/terrain";
import { PAVILION_CORNERS } from "./pavilion";
import { type Piece, box, piece } from "./plan";

/*
 * The deptak's south end by Bajkowskiego at night (user's notes of 22.11: "the climate of neo-Tokyo
 * and nightlife"): behind the bollards that close it, between Alchemia's corner pavilion and the
 * corner tenement Lubartowska 11 (OSM w66286394).
 * Pattern: the yokochō, Tokyo's alley of small bars (Omoide Yokochō in Shinjuku, Golden Gai), with
 * its chōchin, the red paper lanterns strung over the way, and the yatai, the food cart of a street
 * stall (Fukuoka's Nakasu), with its noren, the split cloth over the counter, its stools and its
 * standing lightbox sign; J. Gehl's soft edge ("Cities for People", 2010): people eating at the
 * street's edge keep it alive at night. As `docs/zasady-lokacji.md` has it: three layers (the
 * lanterns' strings over the way, the cart with its stools and sign, the cans, flyers and a bowl
 * still steaming before an empty stool: someone left a moment ago, §5), technique against poverty
 * (a holo price over a cart on crates of beer, its power a cable off the tenement's wall, §3) and
 * the warm light of food (§4). Its differences from the pattern: one cart, not an alley of bars,
 * on the deptak's open end, and the lanterns hang over a way of 20 m, not of 3.
 * The posts are `mast`s and the roof a `roof` (Alchemia's kinds the engine draws here as timber).
 * Every piece but the lanterns, the sign and the cart's body, stools and crates is drawn only; the
 * engine draws them by their kind (`deptak-night-geometry.ts`) in Alchemia's tiers, as the deptak's
 * stalls (C7): no mesh or draw call of its own. Pure data, built once.
 */

const CHUNK = "krakowskie-2-1";
const cm = (v: number): number => Math.round(v * 100) / 100;
const floor = (x: number, z: number): number => cm(groundY(x, z));
/** The ground's lowest point under a footprint (its corners and middle): a solid stands on it, nowhere off the ground. */
const floorUnder = (x0: number, x1: number, z0: number, z1: number): number =>
  Math.min(floor(x0, z0), floor(x1, z0), floor(x0, z1), floor(x1, z1), floor((x0 + x1) / 2, (z0 + z1) / 2));

/** The pavilion's east face (`PAVILION_CORNERS`): its attic's outer face at `z`. */
const pavilionEast = (z: number): number => {
  const [, a, b] = PAVILION_CORNERS;
  return a.x + ((b.x - a.x) * (z - a.z)) / (b.z - a.z);
};
/** The tenement w66286394's west wall south of its bay (OSM, world metres), and its bay's front. */
const tenementWest = (z: number): number => (z <= -4 ? 452.7 + (1.5 * (z + 11.6)) / 7.6 : 454.1);

/** A string of lanterns over the deptak: from the pavilion's attic to the tenement's wall, sagging `sag` at its middle. */
export interface LanternString {
  readonly a: Vec3;
  readonly b: Vec3;
  readonly sag: number;
}

/** The strings' lines across the deptak (z), their ends' height (world y) and sag (m). */
const STRING_Z = [-7.2, -4.2, -1.2] as const;
const PAVILION_Y = 4.4;
const TENEMENT_Y = 4.6;
const SAG = 0.7;

export const DEPTAK_NIGHT_STRINGS: readonly LanternString[] = STRING_Z.map((z) => ({
  a: { x: cm(pavilionEast(z) + 0.05), y: PAVILION_Y, z },
  b: { x: cm(tenementWest(z) - 0.05), y: TENEMENT_Y, z },
  sag: SAG,
}));

/** A string's height at x: the line between its ends, less a parabola's sag (zero at the ends, `sag` at the middle). */
export const stringY = (s: LanternString, x: number): number => {
  const t = (x - s.a.x) / (s.b.x - s.a.x);
  return s.a.y + (s.b.y - s.a.y) * t - 4 * s.sag * t * (1 - t);
};

/** A chōchin: 0.34 m across, 0.46 tall, hung 0.22 under its string; one every `LANTERN_EVERY` along, none within `LANTERN_END` of an end. */
const LANTERN = { r: 0.17, h: 0.46, hang: 0.22 } as const;
const LANTERN_EVERY = 1.6;
const LANTERN_END = 1.4;

const lantern = (x: number, top: number, z: number): Piece =>
  piece(box(cm(x - LANTERN.r), cm(x + LANTERN.r), cm(z - LANTERN.r), cm(z + LANTERN.r), cm(top - LANTERN.h), cm(top)), "lantern", false, false);

const stringLanterns = (s: LanternString): Piece[] => {
  const len = s.b.x - s.a.x;
  const n = Math.floor((len - 2 * LANTERN_END) / LANTERN_EVERY);
  const first = s.a.x + (len - n * LANTERN_EVERY) / 2;
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = first + i * LANTERN_EVERY;
    return lantern(x, stringY(s, x) - LANTERN.hang, s.a.z);
  });
};

/**
 * The yatai: a wooden cart 2.1 m long along the deptak by its east edge, its counter to the west
 * (to the deptak), on two wheels, a roof on four posts over it with the noren hanging off its
 * west edge and a lantern at each of its west corners, the menu's lightbox on the roof and the holo
 * price over it, the pot steaming on the counter.
 */
/** The cart's body is drawn this far over the ground, on its wheels and legs. */
export const CART_CLEAR = 0.22;

export const YATAI = { x0: 449.6, x1: 450.5, z0: -7.05, z1: -4.95, top: 0.88, overhang: 0.35, roof: 2.2 } as const;

const cartPieces = (): Piece[] => {
  const { x0, x1, z0, z1, top, overhang, roof } = YATAI;
  const y = floorUnder(x0, x1, z0, z1);
  const zm = (z0 + z1) / 2;
  const out: Piece[] = [
    // Its body, solid from the ground (its wheels and legs under it, `CART_CLEAR`, drawn), and the counter's board over it, sticking out to the west.
    piece(box(x0, x1, z0, z1, y, cm(y + top - 0.04)), "counter", false),
    piece(box(cm(x0 - overhang), cm(x1 + 0.05), cm(z0 - 0.05), cm(z1 + 0.05), cm(y + top - 0.04), cm(y + top)), "bench", false, false),
    // The wheels on the axle across it (x), 0.6 m.
    piece(box(cm(x0 - 0.06), x0, cm(zm - 0.3), cm(zm + 0.3), y, cm(y + 0.6)), "machine", false, false),
    piece(box(x1, cm(x1 + 0.06), cm(zm - 0.3), cm(zm + 0.3), y, cm(y + 0.6)), "machine", false, false),
    // The legs that hold it level, and the roof on four posts.
    piece(box(cm(x0 + 0.05), cm(x0 + 0.1), cm(z0 + 0.05), cm(z0 + 0.1), y, cm(y + CART_CLEAR)), "frame", false, false),
    piece(box(cm(x0 + 0.05), cm(x0 + 0.1), cm(z1 - 0.1), cm(z1 - 0.05), y, cm(y + CART_CLEAR)), "frame", false, false),
    ...[x0 + 0.03, x1 - 0.08].flatMap((x) =>
      [z0 + 0.03, z1 - 0.08].map((z) => piece(box(cm(x), cm(x + 0.05), cm(z), cm(z + 0.05), cm(y + top), cm(y + roof)), "mast", false, false)),
    ),
    piece(box(cm(x0 - overhang - 0.05), cm(x1 + 0.15), cm(z0 - 0.15), cm(z1 + 0.15), cm(y + roof), cm(y + roof + 0.06)), "roof", false, false),
    // The noren: four cloths off the roof's west edge, a hand apart.
    ...[0, 1, 2, 3].map((k) => {
      const w = (z1 - z0 + 0.3 - 0.15) / 4;
      const za = z0 - 0.15 + k * (w + 0.05);
      return piece(box(cm(x0 - overhang - 0.04), cm(x0 - overhang - 0.02), cm(za), cm(za + w - 0.05), cm(y + roof - 0.5), cm(y + roof)), "awning", false, false);
    }),
    // A lantern at each west corner, under the roof.
    lantern(x0 - overhang + 0.05, y + roof - 0.04, z0 - 0.02),
    lantern(x0 - overhang + 0.05, y + roof - 0.04, z1 + 0.02),
    // The menu's lightbox along the roof, the holo price over it.
    piece(box(cm(x0 + 0.3), cm(x0 + 0.38), cm(z0 + 0.25), cm(z1 - 0.25), cm(y + roof + 0.06), cm(y + roof + 0.46)), "lightbox", false, false),
    piece(box(cm(x0 + 0.32), cm(x0 + 0.34), cm(zm - 0.35), cm(zm + 0.35), cm(y + roof + 0.55), cm(y + roof + 0.8)), "holo", false, false),
    // The pot and its steam, the lit tray of food under glass, two bowls by the stools (one still steaming).
    piece(box(cm(x0 + 0.35), cm(x0 + 0.7), cm(z1 - 0.6), cm(z1 - 0.25), cm(y + top), cm(y + top + 0.28)), "pipe", false, false),
    piece(box(cm(x0 + 0.45), cm(x0 + 0.6), cm(z1 - 0.5), cm(z1 - 0.35), cm(y + top + 0.28), cm(y + top + 0.75)), "steam", false, false),
    piece(box(cm(x0 + 0.1), cm(x1 - 0.1), cm(z0 + 0.1), cm(z0 + 0.65), cm(y + top), cm(y + top + 0.12)), "food", false, false),
    piece(box(cm(x0 - 0.3), cm(x0 - 0.14), cm(-6.68), cm(-6.52), cm(y + top), cm(y + top + 0.07)), "cup", false, false),
    piece(box(cm(x0 - 0.27), cm(x0 - 0.17), cm(-6.65), cm(-6.55), cm(y + top + 0.08), cm(y + top + 0.4)), "steam", false, false),
    piece(box(cm(x0 - 0.3), cm(x0 - 0.14), cm(-5.98), cm(-5.82), cm(y + top), cm(y + top + 0.07)), "cup", false, false),
  ];
  return out;
};

/** The stools before the counter (0.34 m across, 0.5 high), the standing lightbox sign at its south end. */
const STOOLS_X = 448.95;
const STOOLS_Z = [-6.6, -5.9] as const;

const streetPieces = (): Piece[] => {
  const stools = STOOLS_Z.map((z) => {
    const y = floorUnder(STOOLS_X - 0.17, STOOLS_X + 0.17, z - 0.17, z + 0.17);
    return piece(box(cm(STOOLS_X - 0.17), cm(STOOLS_X + 0.17), cm(z - 0.17), cm(z + 0.17), y, cm(y + 0.5)), "chair", false);
  });
  const [sx, sz] = [449.05, -7.55];
  const sy = floorUnder(sx - 0.15, sx + 0.15, sz - 0.12, sz + 0.12);
  const crate = (z: number, k: number): Piece[] => {
    const y = floorUnder(450.7, 451.2, z - 0.18, z + 0.18);
    return [
      piece(box(450.7, 451.2, cm(z - 0.18), cm(z + 0.18), cm(y + k * 0.3), cm(y + (k + 1) * 0.3)), "crate", false),
      piece(box(450.74, 451.16, cm(z - 0.14), cm(z + 0.14), cm(y + (k + 1) * 0.3), cm(y + (k + 1) * 0.3 + 0.03)), "can", false, false),
    ];
  };
  const can = (x: number, z: number, lying: boolean): Piece => {
    const y = floor(x, z);
    return lying
      ? piece(box(cm(x - 0.06), cm(x + 0.06), cm(z - 0.035), cm(z + 0.035), y, cm(y + 0.07)), "can", false, false)
      : piece(box(cm(x - 0.035), cm(x + 0.035), cm(z - 0.035), cm(z + 0.035), y, cm(y + 0.12)), "can", false, false);
  };
  const flyer = (x: number, z: number): Piece => {
    const y = floor(x, z);
    return piece(box(cm(x - 0.1), cm(x + 0.1), cm(z - 0.15), cm(z + 0.15), cm(y + 0.003), cm(y + 0.008)), "paper", false, false);
  };
  return [
    ...stools,
    // The standing sign: a lightbox 1.3 m on its foot, a red band at its head.
    piece(box(cm(sx - 0.15), cm(sx + 0.15), cm(sz - 0.12), cm(sz + 0.12), sy, cm(sy + 1.15)), "lightbox", false),
    piece(box(cm(sx - 0.16), cm(sx + 0.16), cm(sz - 0.13), cm(sz + 0.13), cm(sy + 1.15), cm(sy + 1.3)), "sign-red", false, false),
    // The crates of beer behind the cart, by its south end: two stacked, one beside them.
    ...crate(-7.3, 0),
    ...crate(-7.3, 1),
    ...crate(-6.85, 0),
    // The power off the tenement's wall to the cart's roof: its cable is a string (`DEPTAK_NIGHT_CABLES`).
    // The cans and flyers on the setts by the stools and the sign.
    can(448.6, -6.95, false),
    can(448.75, -7.1, true),
    can(448.4, -5.55, true),
    flyer(448.2, -6.3),
    flyer(449.4, -8.1),
  ];
};

/** The cart's power: a cable off the tenement's wall to its roof's east edge, sagging (the engine draws it as the strings). */
export const DEPTAK_NIGHT_CABLES: readonly LanternString[] = [
  {
    a: { x: cm(YATAI.x1 + 0.15), y: cm(floor(450, -6) + YATAI.roof + 0.06), z: -5.2 },
    b: { x: cm(tenementWest(-5.2) - 0.05), y: 3.1, z: -5.2 },
    sag: 0.25,
  },
];

/** Every drawn piece of the deptak's south end at night, the lanterns first. */
export const deptakNightPieces = (): Piece[] => [...DEPTAK_NIGHT_STRINGS.flatMap(stringLanterns), ...cartPieces(), ...streetPieces()];

/** The cook behind the cart, facing over it to the west: one of the game's still figures (ADR-0058). */
export const DEPTAK_NIGHT_PROPS: readonly StreetPropItem[] = [
  { prop: "figure", x: 451.05, y: floor(451.05, -6.1), z: -6.1, yaw: -Math.PI / 2, variant: figureVariant({ pose: "stand", body: "a", seat: 0, look: 41 }) },
];

const spot = (x: number, z: number, yaw: number, does: readonly [ActivityId, ...ActivityId[]], group: string): CrowdSpot => ({
  chunk: CHUNK,
  at: { x, y: floor(x, z), z },
  yaw,
  does,
  group,
});

/** Two of the crowd at the cart (ADR-0060): one eating at its counter's north end, one drinking by its south corner. */
export const DEPTAK_NIGHT_CROWD: readonly CrowdSpot[] = [
  spot(448.6, -5.25, Math.PI / 2, ["eat", "drink"], "deptak-yatai-0"),
  spot(448.3, -7.25, Math.PI / 3, ["drink", "smoke"], "deptak-yatai-1"),
];
