import type { StreetPropItem } from "@seki/core";
import type { DoorDef, StaticProp } from "../builders";
import { doorParts } from "../doors";
import { W3_BASEMENT_PROPS } from "./basement";
import { W3_CHAMBER_DOORS, W3_HALL_INSIDE_PROPS } from "./hall-inside";
import {
  AIRLOCK_N_DOOR,
  AIRLOCK_S_CORRIDOR,
  AIRLOCK_S_DOOR,
  CHAMBER_CEILING,
  CHAMBER_GATE_E,
  CHAMBER_GATE_W,
  COOLER,
  COOLERS_X,
  DOOR_H,
  DOOR_W,
  DOORS_S,
  GALLERY_OVER_CHAMBER,
  GALLERY_OVER_LINE,
  GALLERY_WINDOW,
  HALL_CEILING,
  HALL_DOORS,
  ROOF_HATCH,
  ROOF_UNDERSIDE,
  STAIR_N_DOOR,
  WAGON_OPENING,
  WALL,
} from "./layout";
import { type ShellHollow, type ShellPart, type WallGap, barrierLine, barrierSolids, box, doorGap, merged, railing, rectRing, shellPart, wallZ } from "./parts";
import { W3_ROW_N_DOORS, W3_ROW_N_PROPS } from "./rows-n";
import { W3_CUT_WALL, W3_ROW_S_DOORS, W3_ROW_S_PROPS } from "./rows-s";
import { W3_AIRLOCKS, W3_ASSEMBLY, W3_CHAMBER, W3_CHAMBER_TOP, W3_GATE, W3_HALL_CUT, W3_HALL_TOP, W3_ROOF, W3_ROW_N, W3_ROW_S, W3_Y } from "./site";

/**
 * The hall's shell (ADR-0082 stage 1, the gate shut): row S with its south-west corner cut along
 * the fence (P1), the airlocks' strip and row N under one roof at +10.4, the assembly hall to +16.6
 * and the test chamber to +14. Stage 2 hollows it into the rooms of the plan: the map city's
 * parts keep only their roof slabs as solids and get openings in their facades where a door or
 * the gallery's window goes through one; the low boxes become their outer walls and roofs, with
 * the hatch over server room N; the cooling units stand on row N's roof.
 *
 * Row S, the assembly hall and the chamber are buildings of the map city (an industrial facade,
 * drawn with the city); the airlocks' strip and row N are boxes, so their roof, walked from the
 * tower's bridge, has no drawn parapet across the bridge's landing. The roofs' outer edges facing
 * the fence 4 m off (row S's south and east, the cut corner) have a 1.9 m parapet, higher than a
 * jump; those over the zone's own yards keep 1.05 m, so a shooter on row N sees down over them.
 */

/** Looks of the map city's industrial facade whose parapet is 1.2 m, graphite and steel grey (`shellPart`). */
const LOOK_ROW_S = 0x3e3008;
const LOOK_ASSEMBLY = 0x3e3009;
const LOOK_CHAMBER = 0x3e3002;
/** The parapet the renderer draws inside the top of an industrial building's walls. */
const DRAWN_PARAPET = 1.2;
/** The parapet over the fence: higher than a jump. */
const OUTER_PARAPET = 1.9;

const [cutA, cutB] = W3_HALL_CUT;

type Opening = NonNullable<ShellHollow["doorways"]>[number];
/** A door's opening in a facade along x (at z) or along z (at x). */
const doorX = (x: number, z: number, width = DOOR_W, top = DOOR_H, bottom = 0): Opening => ({ at: { x, z }, width, bottom, top });
const A = W3_ASSEMBLY;
const C = W3_CHAMBER;
const galleryWindow = (from: number, to: number): Opening => doorX((from + to) / 2, A.maxZ, to - from, GALLERY_WINDOW.top, GALLERY_WINDOW.bottom);

const ROW_S = shellPart(
  [cutB, { x: W3_ROW_S.maxX, z: W3_ROW_S.minZ }, { x: W3_ROW_S.maxX, z: W3_ROW_S.maxZ }, { x: W3_ROW_S.minX, z: W3_ROW_S.maxZ }, cutA],
  W3_ROOF + DRAWN_PARAPET,
  2,
  LOOK_ROW_S,
  W3_ROOF,
  {
    slab: W3_ROOF - ROOF_UNDERSIDE,
    doorways: [doorX(DOORS_S.armoury, W3_ROW_S.minZ), ...[AIRLOCK_S_CORRIDOR, ...HALL_DOORS].map((x) => doorX(x, W3_ROW_S.maxZ))],
  },
);
const ASSEMBLY = shellPart(rectRing(A.minX, A.maxX, A.minZ, A.maxZ), W3_HALL_TOP, 4, LOOK_ASSEMBLY, W3_HALL_TOP, {
  slab: W3_HALL_TOP - HALL_CEILING,
  doorways: [
    ...HALL_DOORS.flatMap((x) => [doorX(x, A.minZ), doorX(x, A.maxZ)]),
    galleryWindow(GALLERY_OVER_LINE.from, GALLERY_OVER_LINE.to),
    doorX(A.minX, AIRLOCK_S_DOOR),
    doorX(A.minX, 418, 9.8, WAGON_OPENING),
    doorX(A.minX, AIRLOCK_N_DOOR),
    doorX(A.minX, STAIR_N_DOOR.z, STAIR_N_DOOR.width),
    doorX(A.maxX, (CHAMBER_GATE_W.minZ + CHAMBER_GATE_W.maxZ) / 2, CHAMBER_GATE_W.maxZ - CHAMBER_GATE_W.minZ, CHAMBER_GATE_W.height),
  ],
});
const CHAMBER = shellPart(rectRing(C.minX, C.maxX, C.minZ, C.maxZ), W3_CHAMBER_TOP, 3, LOOK_CHAMBER, W3_CHAMBER_TOP, {
  slab: W3_CHAMBER_TOP - CHAMBER_CEILING,
  doorways: [
    doorX(C.minX, (CHAMBER_GATE_W.minZ + CHAMBER_GATE_W.maxZ) / 2, CHAMBER_GATE_W.maxZ - CHAMBER_GATE_W.minZ, CHAMBER_GATE_W.height),
    doorX(C.maxX, (CHAMBER_GATE_E.minZ + CHAMBER_GATE_E.maxZ) / 2, CHAMBER_GATE_E.maxZ - CHAMBER_GATE_E.minZ, CHAMBER_GATE_E.height),
    galleryWindow(GALLERY_OVER_CHAMBER.from, GALLERY_OVER_CHAMBER.to),
  ],
});

/** The hall's parts the map city draws. */
export const W3_HALL_SHELL: readonly ShellPart[] = [ROW_S, ASSEMBLY, CHAMBER];

/** Row S's roof parapet over the fence, as a steel fence on the drawn parapet: the south, the east and the cut corner. */
const rowSParapet = (): StreetPropItem[] => {
  const top = W3_Y + W3_ROOF + DRAWN_PARAPET;
  const inset = 0.15;
  const line = [
    { x: W3_ROW_S.minX + inset, z: cutA.z },
    { x: cutB.x + inset * 0.6, z: W3_ROW_S.minZ + inset },
    { x: W3_ROW_S.maxX - inset, z: W3_ROW_S.minZ + inset },
    { x: W3_ROW_S.maxX - inset, z: W3_ROW_S.maxZ - inset },
  ];
  return barrierLine("fence", OUTER_PARAPET - DRAWN_PARAPET, line, () => top);
};

/** Row S's drawn parapet as a solid: the cut corner, the south and the east walls, and its north edge onto the airlocks' roof. */
const rowSParapetSolid = (): StaticProp[] => {
  const r = W3_ROOF;
  const p = DRAWN_PARAPET;
  return [
    railing(W3_ROW_S.minX, W3_AIRLOCKS.maxX, W3_ROW_S.maxZ - 0.3, W3_ROW_S.maxZ, r, p),
    railing(cutB.x, W3_ROW_S.maxX, W3_ROW_S.minZ, W3_ROW_S.minZ + 0.3, r, p),
    railing(W3_ROW_S.maxX - 0.3, W3_ROW_S.maxX, W3_ROW_S.minZ, W3_ROW_S.maxZ, r, p),
    ...barrierSolids(barrierLine("wall", p, [{ x: W3_ROW_S.minX + 0.15, z: cutA.z }, { x: cutB.x + 0.1, z: W3_ROW_S.minZ + 0.15 }], () => W3_Y + r)),
  ];
};

/** The tower's bridge lands on row N's roof over its west parapet here (`tower-pipes.ts`). */
export const W3_BRIDGE_Z = { minZ: 437.6, maxZ: 439.7 } as const;

/** The west wall's openings: airlock S's door, the wagon gate, airlock N's door. */
const WEST_GAPS: readonly WallGap[] = [doorGap(AIRLOCK_S_DOOR, DOOR_W, DOOR_H), { from: W3_GATE.minZ, to: W3_GATE.maxZ, top: W3_GATE.height }, doorGap(AIRLOCK_N_DOOR, DOOR_W, DOOR_H)];

/**
 * The airlocks' strip and row N under one roof: their outer walls (the west one with its doors and
 * the wagon gate, shut), the roofs with the hatch over server room N, the parapets, the cooling units.
 */
const lowRoof = (): StaticProp[] => {
  const r = W3_ROOF;
  const u = ROOF_UNDERSIDE;
  const a = W3_AIRLOCKS;
  const n = W3_ROW_N;
  const t = WALL;
  const h = ROOF_HATCH;
  return [
    // The walls and the roofs' gear merged; the roofs cast the moon's shadow as the boxes did.
    ...merged([
      ...wallZ(a.minZ, n.maxZ, a.minX, a.minX + t, 0, u, WEST_GAPS, "metal"),
      box(a.minX + t, n.maxX, 0, u, n.maxZ - t, n.maxZ, "metal"),
      box(n.maxX - t, n.maxX, 0, u, n.minZ, n.maxZ - t, "metal"),
      ...COOLERS_X.map((x) => box(x - COOLER.w / 2, x + COOLER.w / 2, r, r + COOLER.h, COOLER.z - COOLER.d / 2, COOLER.z + COOLER.d / 2, "metal")),
    ]),
    box(a.minX, a.maxX, u, r, a.minZ, a.maxZ, "concrete"),
    box(n.minX, h.minX, u, r, n.minZ, n.maxZ, "metal"),
    // The roof round the hatch and the wagon gate (8 x 7 m, shut in v1) merged too: two meshes fewer each.
    ...merged([
      box(h.maxX, n.maxX, u, r, n.minZ, n.maxZ, "metal"),
      box(h.minX, h.maxX, u, r, n.minZ, h.minZ, "metal"),
      box(W3_GATE.x - 0.25, W3_GATE.x, 0, W3_GATE.height, W3_GATE.minZ, W3_GATE.maxZ, "metal"),
      box(W3_GATE.x - 0.35, W3_GATE.x, W3_GATE.height, W3_GATE.height + 0.5, W3_GATE.minZ - 0.5, W3_GATE.maxZ + 0.5, "metal"),
    ]),
    // West parapet over the zone, open where the tower's bridge lands.
    railing(a.minX, a.minX + 0.3, a.minZ, W3_BRIDGE_Z.minZ, r),
    railing(n.minX, n.minX + 0.3, W3_BRIDGE_Z.maxZ, n.maxZ, r),
    // North over the pickup yard, east over the east yard.
    railing(n.minX + 0.3, n.maxX, n.maxZ - 0.3, n.maxZ, r),
    railing(n.maxX - 0.3, n.maxX, n.minZ, n.maxZ - 0.3, r),
  ];
};

/** Row S's steel fence on its parapet and the cut corner's inner wall, drawn with the furniture. */
export const W3_HALL_BARRIERS: readonly StreetPropItem[] = [...rowSParapet(), ...W3_CUT_WALL];

/** Every door of the hall (ADR-0038 automatic doors; the locks, ADR-0082). */
export const W3_HALL_DOORS: readonly DoorDef[] = [...W3_ROW_S_DOORS, ...W3_ROW_N_DOORS, ...W3_CHAMBER_DOORS];

/** The hall's solids and boxes: the map city's parts, the low roof, the parapets; inside the rows, the hall, the basement, the doors. */
export const W3_HALL_PROPS: readonly StaticProp[] = [
  ...W3_HALL_SHELL.map((s) => s.prop),
  ...lowRoof(),
  ...rowSParapetSolid(),
  ...barrierSolids(rowSParapet()),
  ...W3_ROW_S_PROPS,
  ...W3_ROW_N_PROPS,
  ...W3_HALL_INSIDE_PROPS,
  ...W3_BASEMENT_PROPS,
  ...W3_HALL_DOORS.flatMap(doorParts),
];
