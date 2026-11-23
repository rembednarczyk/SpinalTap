import type { Vec3 } from "@seki/core";
import { turnLocal } from "./lublin/furniture";
import { groundY } from "./lublin/terrain";
import { PLAC_ZAMKOWY_AREA, PLAC_ZAMKOWY_METRO, PLAC_ZAMKOWY_STALLS } from "./plac-zamkowy-detail";

/*
 * Podzamcze's first lights of the game (`docs/lokacje/dzielnica-targ.md`, „Dług sceny” point 1; `docs/zasady-lokacji.md`
 * §13): the warm light of trade on Plac Zamkowy's flea market and the green of the way down at its metro pavilion. Each
 * light stands in a fitting the scene's models draw (Blender's `rd-pz-stall` festoon between a stall's front posts,
 * `rd-pz-metro-lamp` over the pavilion's opening, `tools/blender/rooms/plac_zamkowy.py`): no light from nowhere. The
 * renderer turns them on near the square only (`SceneLamps`, as Alchemia's pavilion lamps), so the shader's light
 * slots go to the street everywhere else. Pattern: motivated lighting (the light's source visible in the frame, as
 * film and game lighting practice name it); they carry no entity, so no id of the content moves.
 */

/** A light of a scene, in its fitting: where, its colour, how far it reaches and how strong it is. */
export interface SceneLamp {
  readonly key: string;
  readonly at: Vec3;
  readonly color: string;
  readonly range: number;
  readonly intensity: number;
}

/** Lights of one place, on while the eye is within `near` of `centre`. */
export interface SceneLampGroup {
  readonly id: string;
  readonly centre: { readonly x: number; readonly z: number };
  readonly near: number;
  readonly lamps: readonly SceneLamp[];
}

/** The festoon's middle in a stall's frame (`rd-pz-stall`): between its front posts, a little under its sagging bulbs. */
const FESTOON = { x: 0, y: 2.0, z: 0.72 } as const;
/** The green lens of the pavilion's bulkhead lamp in its frame (`rd-pz-metro-lamp`), a little before it. */
const LENS = { y: 2.61, z: 0.3 } as const;

/** The warm bulbs of the market's festoons: the 30% of §13 under the neon of the signs. */
const FESTOON_LIGHT = { color: "#ffc27a", range: 5, intensity: 0.9 } as const;
/** The way down marked in the green of the ways (§13), as Alchemia's ladder lamp. */
const METRO_LIGHT = { color: "#3dff86", range: 6, intensity: 0.9 } as const;

const festoonOf = (i: number): SceneLamp => {
  const s = PLAC_ZAMKOWY_STALLS[i]!;
  const d = turnLocal(s.yaw, FESTOON.x, FESTOON.z);
  return { key: `targ-pz-festoon-${i}`, at: { x: s.x + d.x, y: s.y + FESTOON.y, z: s.z + d.z }, ...FESTOON_LIGHT };
};

const metroLamp = (): SceneLamp => {
  const d = turnLocal(PLAC_ZAMKOWY_METRO.yaw, 0, LENS.z);
  const { x, z } = PLAC_ZAMKOWY_METRO.at;
  return { key: "targ-pz-metro", at: { x: x + d.x, y: groundY(x, z) + LENS.y, z: z + d.z }, ...METRO_LIGHT };
};

/** Plac Zamkowy: one light in each stall's festoon and the pavilion's green lamp, on within 60 m of the square's middle. */
export const PLAC_ZAMKOWY_LAMPS: SceneLampGroup = {
  id: "targ-plac-zamkowy",
  centre: { x: (PLAC_ZAMKOWY_AREA.minX + PLAC_ZAMKOWY_AREA.maxX) / 2, z: (PLAC_ZAMKOWY_AREA.minZ + PLAC_ZAMKOWY_AREA.maxZ) / 2 },
  near: 60,
  lamps: [...PLAC_ZAMKOWY_STALLS.map((_, i) => festoonOf(i)), metroLamp()],
};

/** Every scene's lights the renderer turns on near their place. */
export const SCENE_LAMP_GROUPS: readonly SceneLampGroup[] = [PLAC_ZAMKOWY_LAMPS];
