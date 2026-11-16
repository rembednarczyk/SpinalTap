import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { LUBLIN_CONSTRUCTION_SITES } from "./construction.generated";
import type { Pad } from "./shape";
import type { LublinChunkData, LublinConstructionSiteData } from "./types";

/**
 * The building sites of Lublin 2077 (ADR-0087 stage 1) in the game: their pieces join the chunks'
 * street furniture (the fence and the containers are solids, `furniture.ts`; the renderer draws
 * them with the rest), and their digs shape the terrain (`PADS` of `sites.ts`), the simulation's
 * ground and the renderer's alike.
 */

/** The row of `docs/topografia.md` the sites' digs are written down in (ADR-0042). */
export const SITE_ROW = "T-321";

/** Numbers per piece in a row: x, y, z, yaw, variant. */
const STRIDE = 5;

/** The pieces of the sites, in table order. */
export const sitePieces = (sites: readonly LublinConstructionSiteData[]): StreetPropItem[] =>
  sites.flatMap((s) =>
    (Object.entries(s.pieces) as [StreetPropKind, readonly number[]][]).flatMap(([prop, row]) => {
      const out: StreetPropItem[] = [];
      for (let i = 0; i + STRIDE <= row.length; i += STRIDE) out.push({ prop, x: row[i]!, y: row[i + 1]!, z: row[i + 2]!, yaw: row[i + 3]!, variant: row[i + 4]! });
      return out;
    }),
  );

/** The chunk-wise street furniture with the sites' pieces added to the chunk holding each (half-open bounds); a piece in no chunk is left out. */
export const withSitePieces = (
  props: Readonly<Record<string, StreetPropItem[]>>,
  chunks: readonly Pick<LublinChunkData, "id" | "bounds">[],
  sites: readonly LublinConstructionSiteData[],
): Record<string, StreetPropItem[]> => {
  const out: Record<string, StreetPropItem[]> = { ...props };
  for (const p of sitePieces(sites)) {
    const c = chunks.find((k) => p.x >= k.bounds.minX && p.x < k.bounds.maxX && p.z >= k.bounds.minZ && p.z < k.bounds.maxZ);
    if (c) out[c.id] = [...(out[c.id] ?? []), p];
  }
  return out;
};

/** The digs as pads over their rectangles. */
export const digPads = (sites: readonly LublinConstructionSiteData[]): Pad[] =>
  sites.flatMap((s) => {
    if (!s.dig) return [];
    const ring = [];
    for (let i = 0; i + 1 < s.dig.outline.length; i += 2) ring.push({ x: s.dig.outline[i]!, z: s.dig.outline[i + 1]! });
    const xs = ring.map((p) => p.x);
    const zs = ring.map((p) => p.z);
    return [{ rect: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }, ring, y: s.dig.y, blend: s.dig.blend, row: SITE_ROW }];
  });

export { LUBLIN_CONSTRUCTION_SITES };
