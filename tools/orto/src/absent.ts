/**
 * Section 4 of the cell report: buildings in GUGiK's models the game lacks (ADR-0077). A LoD2
 * building (2017) of `MIN_AREA` m² or more with the middle of its box in the cell, under less than
 * `GAME` of it covered by the game's footprints and outside the rectangles cleared for set pieces
 * (`CLEARED_BUILDINGS`): standing if LoD1 2024 covers `LOD1` of it or more, else likely pulled down
 * since 2017 (counted, not listed). The game's heights against the surface model (NMPT) need the
 * model in the repository's data; without it the check is skipped and the report says so.
 *
 * The other way round (`gameOnlySection`): the game's buildings with the centroid in the cell under
 * less than `GAME` of LoD2, with the nearest LoD1 2024 building within `NEAR` m. These lower the
 * footprints' IoU without any shift (LoD2's extract lacks them, or the building is new or gone).
 */
import { type Pt, type Rect, centroid, pointInRing, ringBounds } from "../../osm-import/src/geometry.ts";
import { gridOver, ringMask } from "./grid.ts";
import { samplesIn } from "./rings.ts";

export const ABSENT = { MIN_AREA: 30, GAME: 0.25, LOD1: 0.5, STEP: 0.5, NEAR: 12 } as const;

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

export interface GameOnlyBuilding {
  readonly id: string;
  /** The outline's centroid, rounded to metres. */
  readonly at: Pt;
  readonly m2: number;
  /** Per cent of it under LoD2. */
  readonly lod2: number;
  /** The nearest LoD1 2024 building within `ABSENT.NEAR` m: its id, m² and distance (0 overlapping). */
  readonly lod1?: { readonly id: string; readonly m2: number; readonly distance: number };
}

export interface GameOnlySection {
  readonly buildings: readonly GameOnlyBuilding[];
  readonly verdict: string;
}

const segDistance = (p: Pt, a: Pt, b: Pt) => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + t * dx - p.x, a.z + t * dz - p.z);
};

/** The least distance between two outlines (0 when one has a corner inside the other). */
export const ringDistance = (a: readonly Pt[], b: readonly Pt[]): number => {
  if (a.some((p) => pointInRing(p, b)) || b.some((p) => pointInRing(p, a))) return 0;
  let d = Infinity;
  for (const [u, v] of [[a, b], [b, a]] as const) for (const p of u) for (let i = 0; i < v.length; i++) d = Math.min(d, segDistance(p, v[i]!, v[(i + 1) % v.length]!));
  return d;
};

const grownBy = (r: Rect, d: number): Rect => ({ minX: r.minX - d, minZ: r.minZ - d, maxX: r.maxX + d, maxZ: r.maxZ + d });

/** The game's buildings in the cell (centroid) under less than `ABSENT.GAME` of LoD2, largest first. */
export const gameOnlySection = (
  rect: Rect,
  game: readonly { readonly id: string; readonly ring: readonly Pt[] }[],
  lod2: readonly (readonly Pt[])[],
  lod1: readonly { readonly id: string; readonly ring: readonly Pt[] }[],
): GameOnlySection => {
  const g = gridOver(rect, ABSENT.STEP, 30);
  const inLod2 = ringMask(g, lod2);
  const lod1Boxes = lod1.map((b) => ringBounds(b.ring));
  const buildings: GameOnlyBuilding[] = [];
  for (const b of game) {
    const c = centroid(b.ring);
    if (c.x < rect.minX || c.x >= rect.maxX || c.z < rect.minZ || c.z >= rect.maxZ) continue;
    const ks = samplesIn(g, b.ring);
    if (!ks.length) continue;
    const share = ks.filter((k) => inLod2[k]).length / ks.length;
    if (share >= ABSENT.GAME) continue;
    const near = grownBy(ringBounds(b.ring), ABSENT.NEAR);
    let best: GameOnlyBuilding["lod1"];
    lod1.forEach((l, i) => {
      if (!overlaps(near, lod1Boxes[i]!)) return;
      const d = ringDistance(b.ring, l.ring);
      if (d <= ABSENT.NEAR && (!best || d < best.distance)) best = { id: l.id, m2: Math.round(samplesIn(g, l.ring).length * ABSENT.STEP * ABSENT.STEP), distance: Math.round(d * 10) / 10 };
    });
    buildings.push({ id: b.id, at: { x: Math.round(c.x), z: Math.round(c.z) }, m2: Math.round(ks.length * ABSENT.STEP * ABSENT.STEP), lod2: Math.round(share * 100), ...(best ? { lod1: best } : {}) });
  }
  buildings.sort((a, b) => b.m2 - a.m2);
  const bare = buildings.filter((b) => !b.lod1).map((b) => b.id);
  const m2 = buildings.reduce((s, b) => s + b.m2, 0);
  return {
    buildings,
    verdict: buildings.length
      ? `budynki gry bez LoD2: ${buildings.length} (${m2} m²), z LoD1 2024 w ${ABSENT.NEAR} m ${buildings.length - bare.length} (niepełny wyciąg LoD2)${bare.length ? `; bez LoD1 i LoD2: ${bare.join(", ")} (sprawdź, czy stoi)` : ""}`
      : "każdy budynek gry w komórce leży na LoD2",
  };
};

const comma = (v: number) => String(v).replace(".", ",");

export const gameOnlyText = (s: GameOnlySection): string[] => [
  `-- budynki gry bez LoD2 (LoD2 < ${ABSENT.GAME * 100}% obrysu; najbliższy LoD1 2024 w ${ABSENT.NEAR} m)`,
  ...s.buildings.slice(0, 10).map((b) => `  ${b.id} (${b.at.x}; ${b.at.z}) ${b.m2} m², LoD2 ${b.lod2}%, LoD1 2024 ${b.lod1 ? `${b.lod1.id} ${b.lod1.m2} m² w ${comma(b.lod1.distance)} m` : "brak"}`),
  ...(s.buildings.length > 10 ? [`  i ${s.buildings.length - 10} więcej`] : []),
  `werdykt: ${s.verdict}`,
];
