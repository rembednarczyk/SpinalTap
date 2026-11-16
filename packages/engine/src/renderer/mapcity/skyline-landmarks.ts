import { LUBLIN_CHUNKS, type LublinBuildingData } from "@seki/sim/lublin";

/**
 * A landmark of the game's own map drawn into the skyline as a silhouette, for an eye too far off
 * to see the real one past the far plane (ADR-0082: the castle group from W-3 on the Bystrzyca,
 * 1.6 km east): its parts as boxes, world metres, their bottoms and tops the map buildings'.
 */
export interface SkylineLandmark {
  readonly name: string;
  readonly parts: readonly { readonly x: number; readonly z: number; readonly w: number; readonly d: number; readonly y0: number; readonly y1: number; readonly octagon?: true }[];
}

const mapBuilding = (id: string): LublinBuildingData => {
  const b = LUBLIN_CHUNKS.flatMap((c) => c.buildings).find((q) => q.id === id);
  if (!b) throw new Error(`skyline landmark: no building ${id} in the map`);
  return b;
};

/** The castle's wings stand to 1 m under its roof's top: the roof slopes down behind the attic. */
const CASTLE_ROOF_DROP = 1;

/**
 * The castle group: w48500136 "Zamek w Lublinie" (its west, south and north wings), w450180469
 * "Wieża Zamkowa Donżon" (the keep, round) and w66258167 "Kaplica pw. Świętej Trójcy" by the
 * castle's east end, its roof as a ridge. The parts' plans are drawn here; their bottoms and tops
 * follow the map's buildings, so a measured height of the import (G-841) moves the silhouette
 * with it. The audit before W-3 (docs/plany/tessen-w3-audyt.md) keeps the Old Town's towers out:
 * from the Nabrzeże the real buildings 8-12 m tall in 340-430 m hide them.
 */
const castleGroup = (building: (id: string) => LublinBuildingData): readonly SkylineLandmark[] => {
  const castle = building("w48500136");
  const keep = building("w450180469");
  const chapel = building("w66258167");
  const wing = { y0: castle.y, y1: castle.y + castle.height + (castle.roof ?? 0) - CASTLE_ROOF_DROP };
  const walls = chapel.y + chapel.height;
  return [
    {
      name: "Zamek",
      parts: [
        { x: 839.5, z: 237, w: 9, d: 56, ...wing },
        { x: 892, z: 203.5, w: 106, d: 13, ...wing },
        { x: 895.5, z: 253.5, w: 103, d: 23, ...wing },
        { x: 893.1, z: 214.6, w: 15, d: 15, y0: keep.y, y1: keep.y + keep.height, octagon: true },
      ],
    },
    {
      name: "Kaplica",
      parts: [
        { x: 941.2, z: 215.5, w: 22.6, d: 11.2, y0: chapel.y, y1: walls },
        { x: 941.2, z: 215.5, w: 22, d: 4, y0: walls, y1: walls + (chapel.roof ?? 0) },
      ],
    },
  ];
};

export const SKYLINE_LANDMARKS: readonly SkylineLandmark[] = castleGroup(mapBuilding);
