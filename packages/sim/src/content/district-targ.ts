import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { METRO_HALL_LAMPS } from "./metro-hall-lamps";
import { KATEDRALNY_LAMPS } from "./katedralny-lights";
import type { SceneLamp, SceneLampGroup, SceneRadio } from "./scene-lamp";
import { LUBLIN_CHUNKS } from "./lublin";
import { turnLocal } from "./lublin/furniture";
import { inBuilding, nearestWall } from "./lublin/places";
import { onRoad } from "./lublin/roads";
import { groundY } from "./lublin/terrain";
import { METRO_STATIONS } from "./metro";
import { PLAC_ZAMKOWY_AREA, PLAC_ZAMKOWY_METRO, PLAC_ZAMKOWY_STALLS } from "./plac-zamkowy-detail";
import { PO_FARZE_LAMPS } from "./po-farze-detail";
import { WORLD_STREET_PROPS } from "./street-props";
import { TERRITORY_GROUPS } from "./territory-groups";

/*
 * Podzamcze's first lights of the game (`docs/lokacje/dzielnica-targ.md`, „Dług sceny” point 1; `docs/zasady-lokacji.md`
 * §13): the warm light of trade on Plac Zamkowy's flea market, the Bazaar and Targ na Ruskiej, and the green of the way
 * down at the metro pavilion. Each light stands in a fitting the scene's models draw (Blender's festoons between a
 * stall's front posts, `rd-pz-stall` and `rd-targ-festoon`, and `rd-pz-metro-lamp` over the pavilion's opening,
 * `tools/blender/rooms/plac_zamkowy.py`, `dzielnica_targ.py`): no light from nowhere. The
 * renderer turns them on near the square only (`SceneLamps`, as Alchemia's pavilion lamps), so the shader's light
 * slots go to the street everywhere else. Pattern: motivated lighting (the light's source visible in the frame, as
 * film and game lighting practice name it); they carry no entity, so no id of the content moves.
 */

export type { SceneLamp, SceneLampGroup, SceneRadio } from "./scene-lamp";

/** The festoon's middle in a stall's frame (`rd-pz-stall`): between its front posts, a little under its sagging bulbs. */
const FESTOON = { x: 0, y: 2.0, z: 0.72 } as const;
/** The green lens of the pavilion's bulkhead lamp in its frame (`rd-pz-metro-lamp`), a little before it. */
const LENS = { y: 2.61, z: 0.3 } as const;

/** The warm bulbs of the market's festoons: the 30% of §13 under the neon of the signs. */
const FESTOON_LIGHT = { color: "#ffc27a", range: 5, intensity: 0.9 } as const;
/** The way down marked in the green of the ways (§13), as Alchemia's ladder lamp. */
const METRO_LIGHT = { color: "#3dff86", range: 6, intensity: 0.9 } as const;

/** The light in the festoon of the stall `s`, under the key `key`. */
const festoonOf = (s: StreetPropItem, key: string): SceneLamp => {
  const d = turnLocal(s.yaw, FESTOON.x, FESTOON.z);
  return { key, at: { x: s.x + d.x, y: s.y + FESTOON.y, z: s.z + d.z }, ...FESTOON_LIGHT };
};

/** The green light before the lens of a pavilion's bulkhead lamp standing at `at`, facing `yaw`. */
const metroLight = (key: string, at: { readonly x: number; readonly z: number }, yaw: number): SceneLamp => {
  const d = turnLocal(yaw, 0, LENS.z);
  return { key, at: { x: at.x + d.x, y: groundY(at.x, at.z) + LENS.y, z: at.z + d.z }, ...METRO_LIGHT };
};

const metroLamp = (): SceneLamp => metroLight("targ-pz-metro", PLAC_ZAMKOWY_METRO.at, PLAC_ZAMKOWY_METRO.yaw);

/** Plac Zamkowy: one light in each stall's festoon and the pavilion's green lamp, on within 85 m of the market's middle (its 23 stalls over 130 m). */
export const PLAC_ZAMKOWY_LAMPS: SceneLampGroup = {
  id: "targ-plac-zamkowy",
  centre: { x: (PLAC_ZAMKOWY_AREA.minX + PLAC_ZAMKOWY_AREA.maxX) / 2, z: (PLAC_ZAMKOWY_AREA.minZ + PLAC_ZAMKOWY_AREA.maxZ) / 2 },
  near: 85,
  lamps: [...PLAC_ZAMKOWY_STALLS.map((s, i) => festoonOf(s, `targ-pz-festoon-${i}`)), metroLamp()],
};

type Area = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** The Bazaar's stalls by the halls on aleja Tysiąclecia (T-026), round the Hebi group's `bazaar-halls`. */
export const BAZAR_AREA: Area = { minX: 640, maxX: 720, minZ: 355, maxZ: 445 };
/** Targ na Ruskiej's stalls on its square (w182461192, T-341). */
export const RUSKA_AREA: Area = { minX: 700, maxX: 845, minZ: 518, maxZ: 598 };

/** The import's market stalls in `area` (`WORLD_STREET_PROPS`), in its chunks' order. */
const stallsIn = (area: Area): StreetPropItem[] =>
  Object.values(WORLD_STREET_PROPS)
    .flat()
    .filter((i) => i.prop === "market-stall" && i.x > area.minX && i.x < area.maxX && i.z > area.minZ && i.z < area.maxZ);

export const BAZAR_STALLS: readonly StreetPropItem[] = stallsIn(BAZAR_AREA);
export const RUSKA_STALLS: readonly StreetPropItem[] = stallsIn(RUSKA_AREA);

/**
 * The festoon of warm bulbs over each stall of the two food markets (Blender's `rd-targ-festoon`,
 * `tools/blender/rooms/dzielnica_targ.py`), drawn only: the stall's solid is the import's.
 */
export const TARG_MARKET_DETAIL: readonly StreetPropItem[] = [...BAZAR_STALLS, ...RUSKA_STALLS].map((s) => ({
  prop: "room-detail",
  x: s.x,
  y: s.y,
  z: s.z,
  yaw: s.yaw,
  variant: roomDetailShape("rd-targ-festoon"),
}));

/** A market's lights, one in each stall's festoon, on within `near` of its area's middle. */
const marketLamps = (id: string, area: Area, stalls: readonly StreetPropItem[], near: number): SceneLampGroup => ({
  id,
  centre: { x: (area.minX + area.maxX) / 2, z: (area.minZ + area.maxZ) / 2 },
  near,
  lamps: stalls.map((s, i) => festoonOf(s, `${id}-festoon-${i}`)),
});

/** The Bazaar: a light in each stall's festoon, on within 70 m of its middle. */
export const BAZAR_LAMPS: SceneLampGroup = marketLamps("targ-bazar", BAZAR_AREA, BAZAR_STALLS, 70);
/** Targ na Ruskiej: a light in each stall's festoon, on within 90 m of its middle (its square is 145 m long). */
export const RUSKA_LAMPS: SceneLampGroup = marketLamps("targ-ruska", RUSKA_AREA, RUSKA_STALLS, 90);

/** The Hebi groups' territories on Podzamcze (ADR-0091), each with its bare bulb. */
const PODZAMCZE_GROUPS = ["bus-station", "bazaar-halls", "ruska-market", "lubartowska"] as const;
/** A wall nearer the group's ring than this takes its bulb on a bracket; farther, the bulb stands on a pole (m). */
const WALL_REACH = 4;
/** How far from the ring's middle the pole stands, towards the nearest wall (m): past the group standing round it. */
const POLE_OUT = 3.5;
/** The bulb in its fitting's frame: off the wall on the bracket's end above a ground floor's signs, or on the pole's arm (`dzielnica_targ.py`). */
const BULB = { wall: { y: 3.32, z: 0.36 }, pole: { y: 2.52, z: 0.5 } } as const;
/** A bare bulb's light: warm white, harsher than the festoons' (§13: the group's corner stands out). */
const BULB_LIGHT = { color: "#ffe2b8", range: 6, intensity: 0.6 } as const;

/** Where a group's bulb hangs: its fitting's foot and yaw (its front, +z, away from the wall or the arm's way). */
export interface HebiBulb {
  readonly territory: string;
  readonly kind: "wall" | "pole";
  readonly at: { readonly x: number; readonly z: number };
  readonly yaw: number;
}

/**
 * The bare bulb by each Hebi group on Podzamcze (`docs/lokacje/dzielnica-targ.md`): on a bracket on the wall nearest its
 * ring where one is within `WALL_REACH`, its arm out of the wall; else on a pole `POLE_OUT` from the ring's middle,
 * towards the nearest wall or the first eighth round from it off the carriageway and out of the houses, its arm back
 * over the ring.
 */
export const HEBI_BULBS: readonly HebiBulb[] = TERRITORY_GROUPS.filter((g) => (PODZAMCZE_GROUPS as readonly string[]).includes(g.territory)).map((g) => {
  const w = nearestWall(g.core.x, g.core.z);
  if (w.d < WALL_REACH) return { territory: g.territory, kind: "wall", at: w.p, yaw: Math.atan2(w.nx, w.nz) };
  // Towards the wall first, then round by eighths: the first spot off the carriageway and out of the houses.
  const toward = Math.atan2(w.p.x - g.core.x, w.p.z - g.core.z);
  const turns = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => toward + (k * Math.PI) / 4);
  const free = turns.map((a) => ({ a, x: g.core.x + Math.sin(a) * POLE_OUT, z: g.core.z + Math.cos(a) * POLE_OUT })).find((p) => !inBuilding(p.x, p.z) && !onRoad(p.x, p.z));
  const p = free ?? { a: toward, x: g.core.x + Math.sin(toward) * POLE_OUT, z: g.core.z + Math.cos(toward) * POLE_OUT };
  // Its arm back over the ring.
  return { territory: g.territory, kind: "pole", at: { x: p.x, z: p.z }, yaw: p.a + Math.PI };
});

export const HEBI_BULB_DETAIL: readonly StreetPropItem[] = HEBI_BULBS.map((b) => ({
  prop: "room-detail",
  x: b.at.x,
  y: groundY(b.at.x, b.at.z),
  z: b.at.z,
  yaw: b.yaw,
  variant: roomDetailShape(b.kind === "wall" ? "rd-targ-bulb-wall" : "rd-targ-bulb-pole"),
}));

/** Each bulb's light in its fitting, on within 40 m of it. */
export const HEBI_LAMPS: readonly SceneLampGroup[] = HEBI_BULBS.map((b) => {
  const d = turnLocal(b.yaw, 0, BULB[b.kind].z);
  const at = { x: b.at.x + d.x, y: groundY(b.at.x, b.at.z) + BULB[b.kind].y, z: b.at.z + d.z };
  return { id: `targ-hebi-${b.territory}`, centre: b.at, near: 40, lamps: [{ key: `targ-hebi-${b.territory}`, at, ...BULB_LIGHT }] };
});

/** The metro pavilion B by the Dworzec Autobusowy (entrance B of Targ, ADR-0071): its outline; it opens to the south (-z). */
const PAVILION_B = METRO_STATIONS.flatMap((s) => s.entrances).find((e) => e.name === "Dworzec Autobusowy")?.outline;
/** Over the pavilion B's opening, on its front, facing out of it: the green lamp as at Plac Zamkowy's (`rd-pz-metro-lamp`). */
export const DWORZEC_METRO = PAVILION_B ? ({ at: { x: (PAVILION_B.minX + PAVILION_B.maxX) / 2, z: PAVILION_B.minZ - 0.02 }, yaw: Math.PI } as const) : null;

export const DWORZEC_METRO_DETAIL: readonly StreetPropItem[] = DWORZEC_METRO
  ? [{ prop: "room-detail", x: DWORZEC_METRO.at.x, y: groundY(DWORZEC_METRO.at.x, DWORZEC_METRO.at.z), z: DWORZEC_METRO.at.z, yaw: DWORZEC_METRO.yaw, variant: roomDetailShape("rd-pz-metro-lamp") }]
  : [];

/** The way down at the pavilion B marked green, on within 40 m of it. */
export const DWORZEC_METRO_LAMPS: readonly SceneLampGroup[] = DWORZEC_METRO
  ? [{ id: "targ-dworzec-metro", centre: DWORZEC_METRO.at, near: 40, lamps: [metroLight("targ-dworzec-metro", DWORZEC_METRO.at, DWORZEC_METRO.yaw)] }]
  : [];

/** Every scene's lights the renderer turns on near their place. */
export const SCENE_LAMP_GROUPS: readonly SceneLampGroup[] = [PLAC_ZAMKOWY_LAMPS, BAZAR_LAMPS, RUSKA_LAMPS, ...HEBI_LAMPS, ...DWORZEC_METRO_LAMPS, PO_FARZE_LAMPS, KATEDRALNY_LAMPS, ...METRO_HALL_LAMPS];

/** A speaker over a venue's door stands this high over the street (m): under its sign, as the neons' (`radio-speakers.ts`). */
const RADIO_HEIGHT = 2.4;
/**
 * The venues of Podzamcze whose doors play a station (the card's debt, `docs/lokacje/dzielnica-targ.md`: no radio in
 * the district): the kebab by the Dworzec's pavilions and two street-food counters on Targ na Ruskiej, the night
 * market's food (§17: sound from its source). Each is the map's fast-food venue nearest its point (within 3 m), so a
 * venue moved a little keeps its speaker; their 2077 names stay in the import's table, not here (ADR-0056).
 */
const TARG_RADIO_AT: readonly { readonly x: number; readonly z: number }[] = [
  { x: 803.1, z: 382.4 },
  { x: 772.3, z: 496.1 },
  { x: 831.0, z: 495.2 },
];
/** How far from its point a venue is still the one meant (m). */
const RADIO_REACH = 3;

export const TARG_RADIOS: readonly SceneRadio[] = TARG_RADIO_AT.flatMap((want, i) => {
  let best: { x: number; z: number; kind: string; label: string; d: number } | null = null;
  for (const c of LUBLIN_CHUNKS)
    for (const b of c.buildings)
      for (const v of b.venues ?? []) {
        if (v.kind !== "fast-food") continue;
        const [x, z] = [b.x + v.x, b.z + v.z];
        const d = Math.hypot(x - want.x, z - want.z);
        if (d < RADIO_REACH && (!best || d < best.d)) best = { x, z, kind: v.kind, label: v.name, d };
      }
  return best ? [{ key: `targ-radio-${i}`, at: { x: best.x, y: groundY(best.x, best.z) + RADIO_HEIGHT, z: best.z }, kind: best.kind, label: best.label }] : [];
});

/** Every scene's speakers the engine's radio plays near their place. */
export const SCENE_RADIOS: readonly SceneRadio[] = [...TARG_RADIOS];

