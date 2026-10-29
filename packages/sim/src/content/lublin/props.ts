import type { StreetPropItem, StreetPropKind, ViewDescriptor } from "@seki/core";
import type { LublinPropTable } from "./types";

/** Numbers per piece in a row of the prop table: x, y, z, yaw, variant. */
const STRIDE = 5;

/** The prop table of `pnpm osm:props` as items per chunk, kinds in table order. */
export const decodePropTable = (table: LublinPropTable): Record<string, StreetPropItem[]> => {
  const out: Record<string, StreetPropItem[]> = {};
  for (const [chunk, kinds] of Object.entries(table)) {
    const items: StreetPropItem[] = [];
    for (const [prop, row] of Object.entries(kinds) as [StreetPropKind, readonly number[]][]) {
      for (let i = 0; i + STRIDE <= row.length; i += STRIDE) {
        items.push({ prop, x: row[i]!, y: row[i + 1]!, z: row[i + 2]!, yaw: row[i + 3]!, variant: row[i + 4]! });
      }
    }
    out[chunk] = items;
  }
  return out;
};

/** The `street-props` view of a chunk's furniture, positioned at the world origin (its items are world points). */
export const propsViewOf = (items: readonly StreetPropItem[]): ViewDescriptor => ({ kind: "street-props", items });
