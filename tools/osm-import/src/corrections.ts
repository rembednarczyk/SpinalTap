/**
 * Explicit corrections of OSM tags and outlines (ADR-0042): a value the map has only as an
 * estimate, which a measurement or the topography curator's review (`docs/topografia.md`) puts
 * right. Each entry names the OSM element, what it replaces, why, and the register entry; the raw data in
 * `data/osm` stays as downloaded, so a new extract keeps the correction until OSM agrees.
 */
import { type Area } from "./features.ts";
import { centroid } from "./geometry.ts";
import { type Tags } from "./osm.ts";

export interface TagCorrection {
  /** `w<id>` or `r<id>`, as `Area.id`. */
  readonly id: string;
  readonly tags: Tags;
  /** The outline scaled round its centroid by this factor (a mapped outline too small against the photograph). */
  readonly scale?: number;
  readonly reason: string;
  /** The entry of `docs/topografia.md` it answers. */
  readonly ref: string;
}

export const TAG_CORRECTIONS: readonly TagCorrection[] = [
  {
    // Brama Krakowska's annex (przedbramie): OSM has only `building:levels=2` (`source: levels`,
    // 7.1 m over the foot with the 0.7 m slope under the gate). The photograph from Plac Łokietka,
    // scaled by the 3.6 m passage, gives about 10 m to the top of the battlements, 0.6 of the tower.
    // `height` counts from the base over the plinth, so 9.3 m here is 10.0 m over the foot.
    id: "w617597406",
    tags: { height: "9.3" },
    reason: "przedbramie Bramy Krakowskiej ok. 10 m do szczytu blanków wobec 7,1 m z building:levels=2",
    ref: "T-033",
  },
  {
    // Brama Krakowska's octagon: mapped 6.6 m across, on the photograph about 0.75-0.8 of the
    // tower's width, about 7.5 m (T-032). Its heights stay the map's.
    id: "w617878341",
    tags: {},
    scale: 1.13,
    reason: "ośmiobok Bramy Krakowskiej ok. 7,5 m średnicy wobec 6,6 m obrysu OSM",
    ref: "T-032",
  },
  {
    // The Trinity Chapel: OSM has no height, so it stood at a church's default 16 m walls with a
    // 4.4 m roof. NMPT GUGiK puts the eaves at about y 7 (13.3 m over the 1.3 m plinth) and the
    // nave's ridge at y 15.3 (a steep 8.3 m roof). `height` runs to the ridge, roof included,
    // hence 13.3 + 8.3. The lower chancel is a part of its own later (plan Z3).
    id: "w66258167",
    tags: { height: "21.6", "roof:height": "8.3" },
    reason: "Kaplica Trójcy: okap ok. y 7 i kalenica y 15,3 z NMPT wobec domyślnych 16 m ścian i 4,4 m dachu",
    ref: "T-114",
  },
  {
    // The keep: OSM `height=25` over the 1 m plinth put its flat top at y 18.6; NMPT GUGiK has
    // the crown at y 16.4..16.9. The stair house on the terrace (to about y 22) is the recipe's.
    id: "w450180469",
    tags: { height: "23.3" },
    reason: "Donżon: korona ok. y 16,4–16,9 z NMPT wobec y 18,6 z height=25",
    ref: "T-114",
  },
];

const BY_ID: ReadonlyMap<string, TagCorrection> = new Map(TAG_CORRECTIONS.map((c) => [c.id, c]));

/** The area with its corrected tags and outline, or as it is. */
export const corrected = (a: Area, corrections: ReadonlyMap<string, TagCorrection> = BY_ID): Area => {
  const c = corrections.get(a.id);
  if (!c) return a;
  const k = c.scale ?? 1;
  const o = centroid(a.ring);
  return { ...a, tags: { ...a.tags, ...c.tags }, ring: k === 1 ? a.ring : a.ring.map((p) => ({ x: o.x + (p.x - o.x) * k, z: o.z + (p.z - o.z) * k })) };
};
