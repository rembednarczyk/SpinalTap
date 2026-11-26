import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { type StaticProp, v } from "./builders";
import { PAVILION as PAVILION_SIZE } from "./metro-pavilion";
import { METRO_STATIONS } from "./metro";
import { groundY } from "./lublin/terrain";
import { WORLD_STREET_PROPS } from "./street-props";

/*
 * Plac Zamkowy's flea market after its card (`docs/lokacje/plac-zamkowy.md`, ADR-0102 point 5). Pattern: environmental
 * storytelling (Smith and Worch, GDC 2010). Every stall of the import's furniture on the square gets what its card asks
 * of the market (Blender, `tools/blender/rooms/plac_zamkowy.py`): a blanket of electronics and implants before its
 * counter, a festoon of warm bulbs between its front posts (§13: the warm light of trade, drawn only), what the day
 * leaves round it; the metro pavilion's opening gets its green lamp (§13: the way down marked).
 */

/**
 * The square between the castle's slope and the tenements' arc, where the market stands: all its 23 stalls (x 705..763,
 * z 177..289, the card's); till 24.11 only the northern end by the metro (6 stalls).
 */
export const PLAC_ZAMKOWY_AREA = { minX: 690, maxX: 770, minZ: 170, maxZ: 300 } as const;
/** The metro pavilion on the square (entrance A of Targ, ADR-0071): its outline; it opens to the north (+z). */
const PAVILION = METRO_STATIONS.flatMap((s) => s.entrances).find((e) => e.name === "Plac Zamkowy")!.outline;
/** Over the pavilion's opening, on its front, facing out of it. */
export const PLAC_ZAMKOWY_METRO = { at: { x: (PAVILION.minX + PAVILION.maxX) / 2, z: PAVILION.maxZ + 0.02 }, yaw: 0 } as const;

/** The market's stalls on the square, the import's (`WORLD_STREET_PROPS`), in its chunks' order. */
export const PLAC_ZAMKOWY_STALLS: readonly StreetPropItem[] = Object.values(WORLD_STREET_PROPS)
  .flat()
  .filter((i) => i.prop === "market-stall" && i.x > PLAC_ZAMKOWY_AREA.minX && i.x < PLAC_ZAMKOWY_AREA.maxX && i.z > PLAC_ZAMKOWY_AREA.minZ && i.z < PLAC_ZAMKOWY_AREA.maxZ);

export const PLAC_ZAMKOWY_DETAIL: readonly StreetPropItem[] = [
  ...PLAC_ZAMKOWY_STALLS.map((s): StreetPropItem => ({ prop: "room-detail", x: s.x, y: s.y, z: s.z, yaw: s.yaw, variant: roomDetailShape("rd-pz-stall") })),
  { prop: "room-detail", x: PLAC_ZAMKOWY_METRO.at.x, y: groundY(PLAC_ZAMKOWY_METRO.at.x, PLAC_ZAMKOWY_METRO.at.z), z: PLAC_ZAMKOWY_METRO.at.z, yaw: PLAC_ZAMKOWY_METRO.yaw, variant: roomDetailShape("rd-pz-metro-lamp") },
];

/** The pavilion's roof slab over its walls (`metro-pavilion.ts`): the sign stands on it. */
const ROOF_SLAB = 0.2;
/**
 * The market's neon on the metro pavilion (§13 of the card: the accent of the square, the backlog's „neon targu przy
 * pawilonie”): TARG ZAMKOWY on the pavilion's roof, two-sided as the roofs' signs are, one at the roof's south edge
 * facing the market (all its stalls stand south of the pavilion) and one at its north edge over the opening and the
 * green lamp, facing the pavement (the curator's review of #1059). Their own fitting, the roof they stand on: no light
 * from nowhere. In the pink of the neon strips over the market (`festoon-signs.ts`). Lublin's signs are Polish, as the
 * map's names (ADR-0056 counts no sign: no Polish letter here).
 */
const sign = (z: number, facing: "z+" | "z-"): StaticProp => ({
  center: v(PLAC_ZAMKOWY_METRO.at.x, groundY(PLAC_ZAMKOWY_METRO.at.x, PLAC_ZAMKOWY_METRO.at.z) + PAVILION_SIZE.height + ROOF_SLAB + 0.35, z),
  view: { kind: "neon", size: v(2.8, 0.6, 0.15), color: "#ff3fa4", label: "TARG ZAMKOWY", facing },
  solid: false,
});
export const PLAC_ZAMKOWY_SIGNS: readonly StaticProp[] = [sign(PAVILION.minZ + 0.25, "z-"), sign(PAVILION.maxZ - 0.25, "z+")];
