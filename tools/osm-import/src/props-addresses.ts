/**
 * The buildings' addresses for the furniture's rules (ADR-0094 stage 3): each building of the chunks
 * with `addr:street` and `addr:housenumber` in the map, by its street and the leading figure of its
 * number, at the building's point.
 */
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import type { Tags } from "./osm.ts";
import type { Address } from "./props-plates.ts";

export const buildingAddresses = (chunks: readonly LublinChunkData[], tags: ReadonlyMap<string, Tags>): Address[] =>
  chunks.flatMap((c) =>
    c.buildings.flatMap((b) => {
      const t = tags.get(b.id);
      const street = t?.["addr:street"];
      const n = /^\d+/.exec(t?.["addr:housenumber"] ?? "");
      return street && n ? [{ street, number: Number(n[0]), p: { x: b.x, z: b.z } }] : [];
    }),
  );
