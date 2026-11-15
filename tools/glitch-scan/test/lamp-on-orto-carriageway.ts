import type { StreetPropItem } from "../../../packages/core/src";
import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";

/**
 * `lamp-on-orto-carriageway` (G-821): a lamp of the game (`lamp-*`) on what the orthophoto's cover
 * (2025-04, `tools/orto`) holds as asphalt, further than `EDGE` from every other class: in a
 * carriageway, not at its kerb. The import's carriageway follows OSM's lanes and widths, which leave
 * out merging lanes, turn pockets and a way drawn off its lanes' middle; the lamp rule (`props-lit.ts`)
 * stands its lamps at the map's kerb, so a lamp moved along its way may stand on the real road.
 */

type Finding = { readonly at: string; readonly what: string };

/** How far from the asphalt's edge a lamp counts as in it (m): a post by the kerb samples the kerb's paving or verge. */
export const EDGE = 0.5;
const AROUND = Array.from({ length: 8 }, (_, i) => ({ x: Math.sin((i * Math.PI) / 4), z: Math.cos((i * Math.PI) / 4) }));

/** The lamps on the cover's asphalt with asphalt all round them within `EDGE`. */
export const lampOnOrtoCarriageway = (props: readonly StreetPropItem[], covers: readonly Cover[]): Finding[] =>
  props.flatMap((i) => {
    if (!i.prop.startsWith("lamp-")) return [];
    const asphalt = (x: number, z: number) => {
      const c = coverFor(covers, { x, z });
      return c !== undefined && coverAt(c, x, z) === COVER.asphalt;
    };
    if (!asphalt(i.x, i.z) || !AROUND.every((u) => asphalt(i.x + u.x * EDGE, i.z + u.z * EDGE))) return [];
    return [{ at: `${i.x},${i.z}`, what: `${i.prop} on asphalt ${EDGE} m from its edge` }];
  });
