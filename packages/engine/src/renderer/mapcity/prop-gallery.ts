import type { StreetPropItem, StreetPropKind } from "@seki/core";
import { PROP_KINDS } from "./prop-models";
import { PROP_SHAPES } from "./prop-shapes";

/**
 * `?props-gallery` (ADR-0047): every street prop kind in every shape, lined up in rows by group
 * (lamps, greenery, small furniture, structures and monuments) on a flat square, front towards
 * -z where the camera stands. The variants are the shapes themselves, unscaled.
 */

/** Width a piece needs in its row (m). */
const WIDTH: Partial<Record<StreetPropKind, number>> = {
  tree: 8,
  "bus-shelter": 5,
  kiosk: 4,
  "cafe-garden": 5.5,
  "market-stall": 3.5,
  monument: 4,
  artwork: 3,
  flagpole: 3,
  "trolley-pole": 5,
  "bike-station": 4,
  "bike-rack": 2.5,
  bench: 3,
  "lamp-modern-pole": 3,
};

const ROWS: readonly (readonly StreetPropKind[])[] = [
  ["lamp-pastoral", "lamp-wall-lantern", "lamp-candelabra", "lamp-modern-pole", "lamp-road", "lamp-park", "floodlight", "hanging-basket", "trolley-pole", "traffic-signal", "cctv"],
  ["tree", "shrubs", "planter", "fountain-jets", "granite-block", "flagpole"],
  ["bench", "bollard", "waste-bin", "bike-rack", "bike-station", "advertising-column", "a-frame-sign", "street-plate", "street-cabinet", "manhole", "ticket-machine", "vending-machine"],
  ["bus-shelter", "bus-stop", "kiosk", "cafe-garden", "market-stall", "monument", "artwork"],
];

/** Distance between rows (m), the first row at z = 0. */
export const GALLERY_ROW = 14;

export interface PropGallery {
  readonly items: StreetPropItem[];
  /** Extent on the ground, for the square under it. */
  readonly width: number;
  readonly depth: number;
}

const rowWidth = (row: readonly StreetPropKind[]): number => row.reduce((s, k) => s + (WIDTH[k] ?? 2) * (PROP_SHAPES[k] ?? 1), 0);

export const propGallery = (): PropGallery => {
  const items: StreetPropItem[] = [];
  const width = Math.max(...ROWS.map(rowWidth));
  ROWS.forEach((row, r) => {
    // Rows centred on the square.
    let x = (width - rowWidth(row)) / 2;
    for (const kind of row) {
      const shapes = PROP_SHAPES[kind] ?? 1;
      for (let s = 0; s < shapes; s++) {
        const w = WIDTH[kind] ?? 2;
        x += w / 2;
        // Flagpoles face sideways: their flags read best from the front.
        const yaw = kind === "flagpole" ? -Math.PI / 2 : Math.PI;
        // Variant: the shape in the low bits and the middle size for trees and shrubs.
        items.push({ prop: kind, x, y: 0, z: r * GALLERY_ROW, yaw, variant: s + 7 * 16 * shapes });
        x += w / 2;
      }
    }
  });
  // Every kind of the contract is in the gallery.
  for (const k of PROP_KINDS) if (!items.some((i) => i.prop === k)) items.push({ prop: k, x: width + 2, y: 0, z: 0, yaw: Math.PI, variant: 0 });
  return { items, width, depth: (ROWS.length - 1) * GALLERY_ROW };
};
