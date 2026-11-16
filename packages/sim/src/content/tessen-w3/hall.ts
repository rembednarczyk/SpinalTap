import type { StreetPropItem } from "@seki/core";
import type { StaticProp } from "../builders";
import { type ShellPart, barrierLine, barrierSolids, box, railing, rectRing, shellPart } from "./parts";
import { W3_AIRLOCKS, W3_ASSEMBLY, W3_CHAMBER, W3_CHAMBER_TOP, W3_GATE, W3_HALL_CUT, W3_HALL_TOP, W3_ROOF, W3_ROW_N, W3_ROW_S, W3_Y } from "./site";

/**
 * The hall's shell (ADR-0082 stage 1, the gate shut): row S with its south-west corner cut along
 * the fence (P1), the airlocks' strip and row N under one roof at +10.4, the assembly hall to +16.6
 * and the test chamber to +14. Stage 2 hollows it into the rooms of the plan.
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

const ROW_S = shellPart(
  [cutB, { x: W3_ROW_S.maxX, z: W3_ROW_S.minZ }, { x: W3_ROW_S.maxX, z: W3_ROW_S.maxZ }, { x: W3_ROW_S.minX, z: W3_ROW_S.maxZ }, cutA],
  W3_ROOF + DRAWN_PARAPET,
  2,
  LOOK_ROW_S,
  W3_ROOF,
);
const ASSEMBLY = shellPart(rectRing(W3_ASSEMBLY.minX, W3_ASSEMBLY.maxX, W3_ASSEMBLY.minZ, W3_ASSEMBLY.maxZ), W3_HALL_TOP, 4, LOOK_ASSEMBLY);
const CHAMBER = shellPart(rectRing(W3_CHAMBER.minX, W3_CHAMBER.maxX, W3_CHAMBER.minZ, W3_CHAMBER.maxZ), W3_CHAMBER_TOP, 3, LOOK_CHAMBER);

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

/** The airlocks' strip and row N: boxes under one roof, with their parapets; the wagon gate shut in the west wall. */
const lowRoof = (): StaticProp[] => {
  const r = W3_ROOF;
  const a = W3_AIRLOCKS;
  const n = W3_ROW_N;
  return [
    box(a.minX, a.maxX, 0, r, a.minZ, a.maxZ, "concrete"),
    box(n.minX, n.maxX, 0, r, n.minZ, n.maxZ, "metal"),
    // West parapet over the zone, open where the tower's bridge lands.
    railing(a.minX, a.minX + 0.3, a.minZ, W3_BRIDGE_Z.minZ, r),
    railing(n.minX, n.minX + 0.3, W3_BRIDGE_Z.maxZ, n.maxZ, r),
    // North over the pickup yard, east over the east yard.
    railing(n.minX + 0.3, n.maxX, n.maxZ - 0.3, n.maxZ, r),
    railing(n.maxX - 0.3, n.maxX, n.minZ, n.maxZ - 0.3, r),
    // The wagon gate (8 x 7 m, shut till stage 2) in the airlocks' west wall.
    box(W3_GATE.x - 0.25, W3_GATE.x, 0, W3_GATE.height, W3_GATE.minZ, W3_GATE.maxZ, "metal"),
    box(W3_GATE.x - 0.35, W3_GATE.x, W3_GATE.height, W3_GATE.height + 0.5, W3_GATE.minZ - 0.5, W3_GATE.maxZ + 0.5, "metal"),
  ];
};

/** Row S's steel fence on its parapet, drawn with the furniture. */
export const W3_HALL_BARRIERS: readonly StreetPropItem[] = rowSParapet();

/** The hall's solids and boxes: the map city's parts, the low roof, the parapets. */
export const W3_HALL_PROPS: readonly StaticProp[] = [...W3_HALL_SHELL.map((s) => s.prop), ...lowRoof(), ...rowSParapetSolid(), ...barrierSolids(W3_HALL_BARRIERS)];
