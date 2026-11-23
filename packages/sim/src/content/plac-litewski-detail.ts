import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { WRECK_FOOT } from "./district-m0";
import { surfaceY } from "./lublin/terrain";

/*
 * Plac Litewski's scene after its card (`docs/lokacje/plac-litewski.md`, ADR-0102): what happened here the night Seki
 * was pulled out of the wreck (environmental storytelling, Smith and Worch, GDC 2010), the models Blender builds
 * (`tools/blender/rooms/plac_litewski.py`) placed in world metres by hand, deterministically. The car came out of
 * Kapucyńska heading north-east, skidded, hit the pastoral lamp at the deptak's edge with the drone that chased it and
 * ended on its roof by it; the van's crew on the square's east edge leave their litter by its flank, Shiro his poems
 * under his lamp. Things on the paving stand on the surface the renderer draws there. Pure data.
 */

const item = (key: string, x: number, z: number, yaw = 0, y = surfaceY(x, z)): StreetPropItem => ({ prop: "room-detail", x, y, z, yaw, variant: roomDetailShape(key) });

/** The pastoral lamp's foot, on the OSM lamp's spot, and where its leaning shaft passes 1 m over the paving. */
const LAMP = { x: 155.1, z: -50.9 } as const;
const LAMP_AT_1M = { x: 155.03, z: -50.85 } as const;
/** The police's warning post, south-west of the lamp: the tape runs from it to the shaft (3.4 m, the model's +z). */
const TAPE_POST = { x: 153.5, z: -53.88 } as const;

/** The tyres' tracks out of Kapucyńska to the lamp: three 4.2 m pieces along the arc, each on the paving under its middle. */
const SKID: readonly (readonly [number, number, number])[] = [
  [145.5, -60.5, 0.35],
  [147.9, -57.0, 0.7],
  [150.9, -54.3, 0.95],
];

export const PLAC_LITEWSKI_DETAIL: readonly StreetPropItem[] = [
  // The wreck on its roof in its solid (`WRECK_BODY` of `district-m0.ts`), its driver's door open to the east.
  item("rd-lit-wreck", WRECK_FOOT.x, WRECK_FOOT.z, 0, WRECK_FOOT.y),
  item("rd-lit-bent-lamp", LAMP.x, LAMP.z),
  item("rd-lit-drone", 156.6, -51.9, 0.4),
  // The cluster on the open side: the window's glass, a cut belt, the tape's torn strip, a rescuer's glove.
  item("rd-lit-glass", 153.7, -51.3),
  // Oil and coolant out of the bonnet's gap at the car's nose (the drip's source, §17).
  item("rd-lit-spill", 152.4, -48.6),
  ...SKID.map(([x, z, yaw]) => item("rd-lit-skid", x, z, yaw)),
  item("rd-lit-tape", TAPE_POST.x, TAPE_POST.z, Math.atan2(LAMP_AT_1M.x - TAPE_POST.x, LAMP_AT_1M.z - TAPE_POST.z)),
  item("rd-lit-candles", 155.75, -50.15, 0.3),
  // By the van on the square's east edge (its box 110.8..113.2, -44.5..-39.5): the crew's litter on its flank, a tarp
  // off its load, a puddle under its sill, a delivery's cartons and bottles, clear of the crew's spots.
  item("rd-lit-van-camp", 114.6, -41.3, 0.5),
  item("rd-lit-tarp", 109.3, -42.3, Math.PI / 2),
  item("rd-c-puddle", 115.5, -43.6, 0.8),
  item("rd-c-cartons", 109.6, -44.2, 0.3),
  item("rd-c-bottles", 115.2, -39.6, 1.1),
  // Under Shiro's lamp: the sheets of his poems and his cup.
  item("rd-lit-poems", 97.9, -22.0, 0.2),
];
