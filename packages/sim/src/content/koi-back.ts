import { CLUTTER, type StreetPropItem, type Vec3, roomDetailShape } from "@seki/core";
import { type StaticProp, crate, skin, v } from "./builders";
import { KOI_BACK_DOOR, koiPoint } from "./interiors";
import { groundY, surfaceY } from "./lublin/terrain";

/*
 * The yard behind Neon Koi after its card (`docs/lokacje/koi-podworko.md`, ADR-0102 point 5, the user's order of 23.11):
 * the scene of Kaito's contract `koi_back` and of the stash behind the bar's bin. Pattern: environmental storytelling
 * (Smith and Worch, GDC 2010) and the one-page level design of the card's scenario (Librande, GDC 2010): the quiet way in
 * from the deptak's gap with the second bin and the scooter for cover, the back door from the bar lit by its bulkhead,
 * the loud way across the open middle, the ways out west, south-west and south-east past the annex's batten.
 *
 * World coordinates on the map's walls round the yard (OSM w66330644, the bar's tenement; w66330640 west of it; the
 * annex south-east): every thing stands where its rule puts it, a wall's thing on that wall facing out of it, the rest
 * on the ground under it. No randomness: the mix and the turns are fixed here. Pure data.
 */

/** A wall of the map's outlines round the yard, from `a` to `b`, its outside on the left of the way from `a` to `b` (seen from above, +x east, +z north). */
interface Wall {
  readonly a: { readonly x: number; readonly z: number };
  readonly b: { readonly x: number; readonly z: number };
}

/** The bar's back wall east of its jog (OSM w66330644: (308.5, -109.8) to (322.4, -110.4)), facing the yard. */
const KOI_WALL: Wall = { a: { x: 322.4, z: -110.4 }, b: { x: 308.5, z: -109.8 } };
/** The jog's south wall west of it ((303, -111.2) to (308.4, -111.4)), over the bar's bin. */
const JOG_WALL: Wall = { a: { x: 308.4, z: -111.4 }, b: { x: 303, z: -111.2 } };
/** The back wall of the tenement west of the bar ((289.9, -106.4) to (303.2, -109.2)), where the Hebi meet. */
const WEST_WALL: Wall = { a: { x: 303.2, z: -109.2 }, b: { x: 289.9, z: -106.4 } };
/** That tenement's west wall along the gap from the deptak ((293.3, -91.2) to (289.9, -106.4)). */
const GAP_WALL: Wall = { a: { x: 289.9, z: -106.4 }, b: { x: 293.3, z: -91.2 } };
/** The annex's west wall over the yard's south-east ((315.2, -117.3) to (314.2, -124.2)). */
const ANNEX_WALL: Wall = { a: { x: 314.2, z: -124.2 }, b: { x: 315.2, z: -117.3 } };

/** The point of a wall at x (or at z for one running north-south), `out` metres in front of it. */
const onWall = (w: Wall, along: number, out = 0, byZ = false): { x: number; z: number; yaw: number } => {
  const dx = w.b.x - w.a.x;
  const dz = w.b.z - w.a.z;
  const t = byZ ? (along - w.a.z) / dz : (along - w.a.x) / dx;
  const len = Math.hypot(dx, dz);
  // The outside: the way from a to b turned a quarter to the left (the yaw faces +z at 0, +x at a quarter).
  const nx = -dz / len;
  const nz = dx / len;
  return { x: w.a.x + dx * t + nx * out, z: w.a.z + dz * t + nz * out, yaw: Math.atan2(nx, nz) };
};

const detail = (key: string, at: { x: number; z: number; yaw: number }, up = 0, y?: number): StreetPropItem => ({
  prop: "room-detail",
  x: at.x,
  y: (y ?? surfaceY(at.x, at.z)) + up,
  z: at.z,
  yaw: at.yaw,
  variant: roomDetailShape(key),
});

const clutter = (shape: number, x: number, z: number, yaw: number): StreetPropItem => ({ prop: "clutter", x, y: surfaceY(x, z), z, yaw, variant: shape });

/** A block standing on the ground under its middle (its view the model's, `scenery`), solid where it stops a body. */
const standing = (p: StaticProp): StaticProp => ({ ...p, center: { ...p.center, y: p.center.y + groundY(p.center.x, p.center.z) } });
const drawnBlock = (x: number, z: number, w: number, h: number, d: number): StaticProp => ({ ...standing(crate(x, z, w, h, d)), scenery: true });

/** A round thing's solid: an upright octagon of radius `r` and height `h`, drawn by its model. */
const drawnRound = (x: number, z: number, r: number, h: number): StaticProp => {
  const points = Array.from({ length: 8 }, (_, k) => ({ x: r * Math.cos((k * Math.PI) / 4), z: r * Math.sin((k * Math.PI) / 4) }));
  return { center: v(x, groundY(x, z) + h / 2, z), view: { kind: "block", size: v(2 * r, h, 2 * r), material: "metal" }, solid: true, prisms: [{ points, bottom: -h / 2, top: h / 2 }], scenery: true };
};

/** Where things stand: the door's bulkhead, the extract, the smoke, the meters, the empties, the downpipe. */
const DOOR = onWall(KOI_WALL, KOI_BACK_DOOR.at.x);
const EXTRACT = onWall(KOI_WALL, 311.6);
const SMOKE = onWall(KOI_WALL, 311.3, 0.55);
const METERS = onWall(KOI_WALL, 312.7);
const CRATES = onWall(KOI_WALL, 313.75, 0.32);
const DOWNPIPE = onWall(KOI_WALL, 314.6);
const CAMERA = onWall(JOG_WALL, 305.6);
const TAG = onWall(WEST_WALL, 299.6);
const LANTERN = onWall(GAP_WALL, -97, 0, true);
const BATTEN = onWall(ANNEX_WALL, -121, 0, true);
/** The second bin against the west tenement's back wall, the bottle bank by the shed on the west, the scooter in the middle. */
const BIN = { x: 295.5, z: -108.55 };
const BANK = { x: 291.9, z: -113.25, yaw: 0.35 };
const SCOOTER = { x: 300.9, z: -114.6, yaw: Math.PI / 2 };

/** A point of a thing's own frame (x across, z out of its front) in the world, `up` over the ground under the thing. */
const local = (at: { x: number; z: number; yaw: number }, x: number, z: number, up = 0): Vec3 => {
  const c = Math.cos(at.yaw);
  const s = Math.sin(at.yaw);
  return { x: at.x + x * c + z * s, y: groundY(at.x, at.z) + up, z: at.z - x * s + z * c };
};

/** The steam of the kitchen's extract: in front of its fan's grille (`STEAM_VENTS`). */
export const KOI_KITCHEN_VENT: Vec3 = local(EXTRACT, 0, 0.5, 2.6);

/** A lamp's light in its fitting (`neon`: a small lit face and its point light), facing `facing`. */
const light = (at: Vec3, size: Vec3, color: string, facing: "x-" | "z-"): StaticProp => ({ center: at, view: { kind: "neon", size, color, facing }, solid: false });

/** The keg by the empties: its middle in their frame. */
const KEG = local(CRATES, 0.85, 0.05);

/**
 * The yard's models (`tools/blender/rooms/koi_back.py`) and the odds and ends of ADR-0096 in clusters (§14) where
 * somebody does something: the cook's smoke by the door, the bags and cartons by the bin, the bottles by the bank; the
 * bulb of the back room's corridor and the exit sign over its door.
 */
export const KOI_BACK_DETAIL: readonly StreetPropItem[] = [
  detail("rd-kb-canopy", DOOR, 0, KOI_BACK_DOOR.at.y),
  detail("rd-kb-extract", EXTRACT),
  detail("rd-kb-smoke", SMOKE),
  detail("rd-c-fusebox", METERS),
  detail("rd-kb-crates", CRATES),
  detail("rd-kb-downpipe", DOWNPIPE),
  detail("rd-c-puddle", onWall(KOI_WALL, 314.6, 0.75)),
  detail("rd-c-puddle", { ...onWall(KOI_WALL, KOI_BACK_DOOR.at.x + 0.3, 2.1), yaw: 0.9 }),
  detail("rd-kb-camera", CAMERA),
  detail("rd-kb-tag", TAG),
  detail("rd-kb-lantern", LANTERN),
  detail("rd-kb-batten", BATTEN),
  detail("rd-kb-glass-bin", BANK),
  detail("rd-c-bottles", { x: BANK.x + 1, z: BANK.z + 0.45, yaw: 2.1 }),
  detail("rd-kb-scooter", SCOOTER),
  // By the bar's bin (its lid to the west): two bags and a box at its south end, the cartons the delivery came in.
  clutter(CLUTTER.bags[0], 305.35, -114.45, 0.4),
  clutter(CLUTTER.bags[1], 306.25, -114.7, -0.7),
  clutter(CLUTTER.boxes[1], 307.0, -114.45, 0.2),
  detail("rd-c-cartons", { x: 305.1, z: -115.15, yaw: 1.2 }),
  // The back room's bare bulb under its ceiling, halfway down the corridor; the green exit sign hung from the ceiling
  // before the back door, facing the bar (§4: green for the ways out).
  { prop: "room-detail", ...koiPoint(19.6, 2.8, -4.1), yaw: 0, variant: roomDetailShape("rd-w3b-bulb") },
  { prop: "room-detail", ...koiPoint(22.2, 2.45, -4.1), yaw: 0, variant: roomDetailShape("rd-w3h-exit") },
];

/**
 * The yard's solids and lights, after every other prop of the district (`DISTRICT_M0_PROPS`): the bin for paper with
 * room for a body (ADR-0065), the empties and the keg, the bottle bank, the scooter; then the lights in
 * their fittings: the bulkhead over the back door (warm: the way in from the bar, the stash by the bin), the lantern in
 * the gap from the deptak (warm: the way in), the annex's batten (cold: the way out south-east).
 */
export const KOI_BACK_PROPS: readonly StaticProp[] = [
  { ...standing(crate(BIN.x, BIN.z, 2.2, 1.3, 1.2, skin("dumpster", "z-"))), hide: "dumpster" },
  drawnBlock(CRATES.x, CRATES.z, 1.2, 1.16, 0.6),
  drawnRound(KEG.x, KEG.z, 0.21, 0.66),
  drawnRound(BANK.x, BANK.z, 0.75, 1.6),
  drawnBlock(SCOOTER.x, SCOOTER.z, 1.85, 1.25, 0.72),
  light({ ...local(DOOR, 0, 0.075), y: KOI_BACK_DOOR.at.y + 2.55 }, v(0.18, 0.12, 0.02), "#ffc35a", "z-"),
  light(local(LANTERN, 0, 0.495, 2.95), v(0.02, 0.3, 0.16), "#ffb45e", "x-"),
  light(local(BATTEN, 0, 0.085, 2.6), v(0.02, 0.09, 1.2), "#cfe4ff", "x-"),
];
