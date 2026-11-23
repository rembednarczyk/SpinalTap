import { CLUTTER, type StreetPropItem, type Vec3, roomDetailShape } from "@seki/core";
import type { StaticProp } from "./builders";
import { GATE_PASSAGES } from "./lublin/gate-passages";
import { groundY } from "./lublin/terrain";

/*
 * The scene of Brama Krakowska after its card (`docs/lokacje/brama-krakowska.md`, ADR-0102 point 5): what the gate, its
 * forecourt on Plac Łokietka and the mouth of Bramowa need besides the landmark's recipe, as street pieces drawn with the
 * furniture (vertices, not draw calls). Pure data, world metres, each piece on the ground under it. Pattern: the
 * environmental storytelling of Smith and Worch (GDC 2010) and the one-page level design of Librande (GDC 2010).
 *
 * - The threshold (§12, §13): the passage lit by two warm wall lanterns on its jambs, staggered either side of the Hebi
 *   scanner in the middle of the vault (Blender, `tools/blender/rooms/brama_krakowska.py`), whose emitters, camera and
 *   control box carry the strips the landmark draws, and whose chirp is its sound (§17); its conduit runs along the
 *   north jamb to the east mouth, to the post on Bramowa.
 * - Tetsu's stash (ink `m4-ulica.ink`, `KANAL_ALLEY_STASH`): the dumpster in the corner of the annex's west front and its
 *   buttress, on the deptak's side, its lid propped on a bottle a moment ago (§5), the stash in the wedge behind it among
 *   bin bags and a carton (§14's cluster).
 * - The zapiekanki booth's side (gas, bread, trays, a bin over its rim; `simmer`) and the litter where people eat.
 * - On Bramowa: Hideo's doorway (mat, blanket, mug), the gully grate old Sabu fishes through.
 */

const GATE = GATE_PASSAGES[0]!;
const LENGTH = Math.hypot(GATE.to.x - GATE.from.x, GATE.to.z - GATE.from.z);
/** Along the passage (east) and to its left (north), unit vectors. */
const ALONG = { x: (GATE.to.x - GATE.from.x) / LENGTH, z: (GATE.to.z - GATE.from.z) / LENGTH } as const;
const NORTH = { x: -ALONG.z, z: ALONG.x } as const;
/** The passage's facing: a model's +z along it to the east. */
export const PASSAGE_YAW = Math.atan2(ALONG.x, ALONG.z);

/** A point of the passage `t` metres along its axis from its west end, `off` metres to the north of it. */
export const inPassage = (t: number, off = 0): { x: number; z: number } => ({ x: GATE.from.x + ALONG.x * t + NORTH.x * off, z: GATE.from.z + ALONG.z * t + NORTH.z * off });

/** Where the scanner stands: the middle of the vault under the gate (6.45..26.55 m along), where the landmark draws its arch. */
export const SCANNER_AT = 16.5;
/** The two lanterns' places along the passage: one on the north jamb in the west half, one on the south in the east. */
export const VAULT_LANTERNS = [
  { t: 11, side: 1 },
  { t: 21.5, side: -1 },
] as const;
/** The lanterns hang this much lower than on a house's front (their brackets at 2.75 m, under the vault's springing). */
export const LANTERN_DROP = 1.3;

/** The dumpster under the annex (its solid's middle and size: 1.2 m across x, 1.3 high, 2.2 along z), its front west. */
export const GATE_DUMPSTER = { x: 463.65, z: -97.55, w: 1.2, h: 1.3, d: 2.2 } as const;
/** Tetsu's stash in the wedge between the dumpster's back, the annex's front and its buttress. */
export const GATE_STASH = { x: 464.7, z: -98.3 } as const;

/**
 * The dumpster's solid, a body fits in (ADR-0065), drawn by its model (`rd-bk-dumpster`, `scenery`). In the rooms' pool of
 * ids of its chunk (`ChunkDef.rooms`), so no id of the city's content moves for it.
 */
export const BRAMA_SOLIDS: readonly StaticProp[] = [
  {
    center: { x: GATE_DUMPSTER.x, y: groundY(GATE_DUMPSTER.x, GATE_DUMPSTER.z) + GATE_DUMPSTER.h / 2, z: GATE_DUMPSTER.z },
    view: { kind: "block", size: { x: GATE_DUMPSTER.w, y: GATE_DUMPSTER.h, z: GATE_DUMPSTER.d }, material: "metal" },
    solid: true,
    scenery: true,
    hide: "dumpster",
  },
];

/** The Hebi post on Bramowa by day: 6.5 m out of the passage's east mouth, by the south house's wall, watching the mouth. */
export const BRAMOWA_POST: { readonly at: { readonly x: number; readonly z: number }; readonly yaw: number } = (() => {
  const at = inPassage(33.05, -0.5);
  const mouth = inPassage(26.55);
  return { at, yaw: Math.atan2(mouth.x - at.x, mouth.z - at.z) };
})();

/** The zapiekanki booth on the forecourt (the street furniture's `food-stall`) and its frame. */
const BOOTH = { x: 455.8, z: -76.1, yaw: -1.78 } as const;
/** A point of the booth's frame (x across its front, +z out of it) in the world. */
const atBooth = (x: number, z: number): { x: number; z: number } => ({
  x: BOOTH.x + x * Math.cos(BOOTH.yaw) + z * Math.sin(BOOTH.yaw),
  z: BOOTH.z - x * Math.sin(BOOTH.yaw) + z * Math.cos(BOOTH.yaw),
});
/** Where the steam of the booth's hot plate rises: over its counter's front, under the roof's edge. */
export const BOOTH_STEAM: Vec3 = (() => {
  const p = atBooth(0.3, 0.85);
  return { x: p.x, y: groundY(p.x, p.z) + 1.25, z: p.z };
})();

/** Hideo's doorway on Bramowa: a hand off the wall's foot (w232362886, at (489.53, -76.05)) and its normal into the street. */
export const HIDEO_DOORWAY = { x: 489.58, z: -76.13, nx: 0.5294, nz: -0.8484 } as const;
/** The gully grate old Sabu fishes through (`enc_kanal_fisherman` stands at (510, -68)), in Bramowa's gutter. */
export const SABU_GRATE = { x: 509.75, z: -67.6 } as const;

const piece = (prop: StreetPropItem["prop"], x: number, z: number, yaw: number, variant: number, up = 0): StreetPropItem => ({ prop, x, y: groundY(x, z) + up, z, yaw, variant });

/** A model of the gate (`ROOM_DETAIL_SHAPES`), on the ground or `up` over it. */
const model = (key: string, x: number, z: number, yaw: number, up = 0): StreetPropItem => piece("room-detail", x, z, yaw, roomDetailShape(key), up);

/** The odds and ends of ADR-0096 by shape (`CLUTTER_SHAPES`). */
const odd = (shape: number, x: number, z: number, yaw: number): StreetPropItem => piece("clutter", x, z, yaw, shape);

const lantern = (t: number, side: 1 | -1): StreetPropItem => {
  const p = inPassage(t, side * (GATE.width / 2));
  // Its arm out of the jamb, across the passage.
  const yaw = Math.atan2(-NORTH.x * side, -NORTH.z * side);
  return piece("lamp-wall-lantern", p.x, p.z, yaw, 0, -LANTERN_DROP);
};

const scanner = inPassage(SCANNER_AT);
const booth = atBooth(1.6, -0.2);
/** The neon's transformer on the annex's west front north of the passage (the wall from (460.5, -90.2) to (461.6, -92.5)). */
const NEON_BOX = { x: 460.96, z: -91.39, yaw: Math.atan2(-0.902, -0.431) } as const;

export const BRAMA_DETAIL: readonly StreetPropItem[] = [
  // The vault: the scanner in its middle, the lanterns either side of it.
  model("rd-bk-scanner", scanner.x, scanner.z, PASSAGE_YAW),
  ...VAULT_LANTERNS.map((l) => lantern(l.t, l.side)),
  // The dumpster drawn where its solid stands (front west), what lies behind it round the stash.
  model("rd-bk-dumpster", GATE_DUMPSTER.x, GATE_DUMPSTER.z, -Math.PI / 2),
  model("rd-bk-behind", GATE_DUMPSTER.x + GATE_DUMPSTER.w / 2, GATE_DUMPSTER.z, -Math.PI / 2),
  model("rd-bk-neon-box", NEON_BOX.x, NEON_BOX.z, NEON_BOX.yaw),
  // The booth's side by the tenement, the litter in front of it where people eat standing.
  model("rd-bk-booth", booth.x, booth.z, BOOTH.yaw),
  ...[
    [CLUTTER.litter[0], -1.2, 1.6, 0.4],
    [CLUTTER.litter[1], -1.6, 2.0, 2.2],
    [CLUTTER.litter[0], -0.9, 2.3, 1.1],
    [CLUTTER.litter[1], -1.9, 1.3, 0.3],
  ].map(([shape, x, z, yaw]) => {
    const p = atBooth(x!, z!);
    return odd(shape!, p.x, p.z, yaw!);
  }),
  // Bramowa: Hideo's doorway at the wall's foot, facing the street; Sabu's grate in the gutter.
  model("rd-bk-doorway", HIDEO_DOORWAY.x, HIDEO_DOORWAY.z, Math.atan2(HIDEO_DOORWAY.nx, HIDEO_DOORWAY.nz)),
  // Its bars across the gutter, along the house's front (the wall from w232362893 runs (0.845, 0.535)).
  model("rd-bk-grate", SABU_GRATE.x, SABU_GRATE.z, -Math.atan2(0.535, 0.845)),
];
