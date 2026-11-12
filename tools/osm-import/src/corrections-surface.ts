/**
 * Buildings whose top the surface model puts far under what the import would build (G-708,
 * T-269): NMPT GUGiK 0.5 m (WCS `DSM_PL-KRON86-NH`, the curator's pass of `stare-miasto-1-1`,
 * 12.11; its heights less 196.15 m are world y, by eight points of the carriageway) gives `top`,
 * the world y of the median of the roof cells (over 2 m above the foot) in the game's outline.
 * Only where no rule can: LoD1 2024 stands against the surface model and the photograph of
 * 2024-06, or the building is in neither LoD1 nor LoD2 and its storeys are a guess.
 *
 * The walls go up to `top` from the foot (a flat top), at least a storey. As in LoD1's rule
 * (G-629), `building:levels` of the map that fit from the foot at `MIN_STOREY` each stay, the
 * plinth cut under them; otherwise the plinth is cut so a storey stands over it, the rest buried
 * in the slope, and the storeys follow the walls over it.
 */
import { MIN_STOREY, STOREY } from "./building-tags.ts";
import type { TagCorrection } from "./corrections.ts";
import { r1 } from "./geometry.ts";
import { type BuildingOut } from "./model.ts";

export interface SurfaceTop {
  /** `w<id>` or `r<id>` of the building. */
  readonly id: string;
  /** World y of the measured top. */
  readonly top: number;
  readonly reason: string;
  /** The entry of `docs/topografia.md` it answers. */
  readonly ref: string;
}

export const SURFACE_TOPS: readonly SurfaceTop[] = [
  {
    // Rybna 13: LoD1 2024 (e259afc9-5b94-11ee-ac8a-44e5174962da, 16.1 m) put a flat top at y 11.5
    // over the whole 528 m². NMPT has low roofs at y -0.4..1.8 (p25..p75, 79% of the cells in
    // NMPT's reach), a yard at the foot and nothing over 8 m but its neighbours' eaves; LoD2 2017
    // has only the low strip along the north wall (eaves 4.2 m). The photograph agrees with NMPT.
    id: "w66293276",
    top: 0.5,
    reason: "Rybna 13: niskie dachy y 0,5 z NMPT (p25 −0,4, p75 1,8) wobec płaskiego wierzchu y 11,5 z LoD1 16,1 m",
    ref: "T-269",
  },
  {
    // Zaułek Panasa, the beer garden Ogródek pod Murami: no height in the map, so the district's
    // three storeys over a 7.1 m plinth, top at y 1.1. NMPT has a flat top at y -8.9..-8.4 (p25..p75),
    // the level of Grodzka's yards (terrain y -8.5 at its west corner): a terrace on the scarp over
    // Podwale, the garden on it. In neither LoD1 2024 nor LoD2.
    id: "w232362965",
    top: -8.7,
    reason: "taras ogródka przy Zaułku Panasa: wierzch y −8,7 z NMPT na poziomie podwórzy Grodzkiej wobec y 1,1 z domyślnych 3 kondygnacji",
    ref: "T-269",
  },
  {
    // Zaułek Panasa: `building:levels=3` over a 5 m plinth, top at y 1.4. NMPT has its top at
    // y -7.9..-5.4 (p25..p75), about a metre over Grodzka's yards beside it: 6 m over its foot by
    // Podwale (`SURFACE_STOREYS`). In neither LoD1 2024 nor LoD2.
    id: "w364575978",
    top: -7.2,
    reason: "budynek przy Zaułku Panasa: wierzch y −7,2 z NMPT wobec y 1,4 z building:levels=3",
    ref: "T-269",
  },
];

/** The map's storeys a measured top leaves no room for, as many as fit under it from the foot. */
export const SURFACE_STOREYS: readonly TagCorrection[] = [
  {
    id: "w364575978",
    tags: { "building:levels": "2" },
    reason: "budynek przy Zaułku Panasa: wierzch z NMPT 6 m nad stopą od Podwala mieści 2 kondygnacje, nie 3 z building:levels",
    ref: "T-269",
  },
];

const BY_ID: ReadonlyMap<string, SurfaceTop> = new Map(SURFACE_TOPS.map((s) => [s.id, s]));

/** A building with its walls up to the measured top (`source: "height"`), else as it is. */
export const withSurfaceTop = (b: BuildingOut): BuildingOut => {
  const s = BY_ID.get(b.id);
  if (!s) return b;
  const height = r1(Math.max(s.top - b.y - (b.roof ?? 0) / 2, STOREY));
  if (b.source === "levels" && height >= b.levels * MIN_STOREY - 1e-9) return { ...b, height, plinth: r1(Math.max(0, Math.min(b.plinth, height - b.levels * STOREY))), source: "height" };
  const plinth = r1(Math.max(0, Math.min(b.plinth, height - STOREY)));
  return { ...b, height, plinth, levels: Math.max(1, Math.round((height - plinth) / STOREY)), source: "height" };
};
