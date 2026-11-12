/**
 * Section 4 of the cell report: buildings in GUGiK's models the game lacks (ADR-0077). A LoD2
 * building (2017) of `MIN_AREA` m² or more with the middle of its box in the cell, under less than
 * `GAME` of it covered by the game's footprints and outside the rectangles cleared for set pieces
 * (`CLEARED_BUILDINGS`): standing if LoD1 2024 covers `LOD1` of it or more, else likely pulled down
 * since 2017 (counted, not listed). The game's heights against the surface model (NMPT) need the
 * model in the repository's data; without it the check is skipped and the report says so.
 */
import { type Pt, type Rect, ringBounds } from "../../osm-import/src/geometry.ts";
import { gridOver, ringMask } from "./grid.ts";
import { samplesIn } from "./rings.ts";

export const ABSENT = { MIN_AREA: 30, GAME: 0.25, LOD1: 0.5, STEP: 0.5 } as const;

export interface Lod2Like {
  readonly id: string;
  readonly ring: readonly Pt[];
  readonly eaves?: number;
  readonly ridge?: number;
}

export interface AbsentBuilding {
  readonly id: string;
  readonly box: Rect;
  readonly m2: number;
  readonly game: number;
  readonly lod1: number;
  readonly lod1Height?: number;
  readonly eaves?: number;
  readonly ridge?: number;
}

export interface AbsentSection {
  readonly standing: readonly AbsentBuilding[];
  /** LoD2 buildings without a game building and without LoD1 2024 (pulled down since 2017?). */
  readonly gone: { readonly count: number; readonly m2: number };
  readonly nmpt: string;
  readonly verdict: string;
}

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

export const absentSection = (
  rect: Rect,
  lod2: readonly Lod2Like[],
  lod1: readonly { readonly ring: readonly Pt[]; readonly height: number }[],
  game: readonly (readonly Pt[])[],
  cleared: readonly Rect[],
): AbsentSection => {
  const g = gridOver(rect, ABSENT.STEP, 30);
  const inGame = ringMask(g, game);
  const lod1Id = new Int32Array(g.width * g.height).fill(-1);
  lod1.forEach((b, i) => {
    for (const k of samplesIn(g, b.ring)) lod1Id[k] = i;
  });
  const standing: AbsentBuilding[] = [];
  let [goneCount, goneM2] = [0, 0];
  for (const b of lod2) {
    const box = ringBounds(b.ring);
    const [cx, cz] = [(box.minX + box.maxX) / 2, (box.minZ + box.maxZ) / 2];
    if (cx < rect.minX || cx >= rect.maxX || cz < rect.minZ || cz >= rect.maxZ || cleared.some((c) => overlaps(c, box))) continue;
    const ks = samplesIn(g, b.ring);
    const m2 = ks.length * ABSENT.STEP * ABSENT.STEP;
    if (m2 < ABSENT.MIN_AREA) continue;
    const game = ks.filter((k) => inGame[k]).length / ks.length;
    if (game >= ABSENT.GAME) continue;
    const hits = ks.filter((k) => lod1Id[k]! >= 0);
    const share = hits.length / ks.length;
    if (share < ABSENT.LOD1) {
      goneCount++;
      goneM2 += m2;
      continue;
    }
    const votes = new Map<number, number>();
    for (const k of hits) votes.set(lod1Id[k]!, (votes.get(lod1Id[k]!) ?? 0) + 1);
    const top = [...votes].sort((p, q) => q[1] - p[1])[0]![0];
    standing.push({
      id: b.id,
      box: { minX: Math.floor(box.minX), minZ: Math.floor(box.minZ), maxX: Math.ceil(box.maxX), maxZ: Math.ceil(box.maxZ) },
      m2: Math.round(m2),
      game: Math.round(game * 100),
      lod1: Math.round(share * 100),
      lod1Height: lod1[top]!.height,
      ...(b.eaves !== undefined ? { eaves: b.eaves } : {}),
      ...(b.ridge !== undefined ? { ridge: b.ridge } : {}),
    });
  }
  standing.sort((a, b) => b.m2 - a.m2);
  const m2 = standing.reduce((s, b) => s + b.m2, 0);
  return {
    standing,
    gone: { count: goneCount, m2: Math.round(goneM2) },
    nmpt: "pominięte: NMPT nie ma w danych lokalnych (data/), więc wysokości gry z NMPT nie porównano",
    verdict: standing.length ? `budynki LoD2 i LoD1 2024 bez budynku gry: ${standing.length} (${m2} m²), sprawdź OSM i ortofoto` : "każdy budynek LoD2 z LoD1 2024 ma budynek gry",
  };
};

export const absentText = (s: AbsentSection): string[] => [
  `-- budynki LoD2 ≥ ${ABSENT.MIN_AREA} m² z LoD1 2024 ≥ ${ABSENT.LOD1 * 100}%, budynki gry < ${ABSENT.GAME * 100}%`,
  ...s.standing.slice(0, 10).map((b) => `  ${b.id} (${b.box.minX}..${b.box.maxX}; ${b.box.minZ}..${b.box.maxZ}) ${b.m2} m², gra ${b.game}%, LoD1 2024 ${b.lod1}% (${b.lod1Height} m), okap ${b.eaves ?? "-"} m, kalenica ${b.ridge ?? "-"} m`),
  `bez LoD1 2024 (rozebrane od 2017?): ${s.gone.count}, ${s.gone.m2} m²; NMPT: ${s.nmpt}`,
  `werdykt: ${s.verdict}`,
];
