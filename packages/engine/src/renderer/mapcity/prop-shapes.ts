import type { StreetPropKind } from "@seki/core";
import type { RenderQuality } from "../../npr/quality";

/**
 * What a street prop's `variant` means (ADR-0047) and how far each kind is drawn. The low bits
 * pick one of a kind's shapes (the same table as the importer's `SHAPES` for the shapes it
 * pins down); the next ones scale trees and shrubs.
 */
export const PROP_SHAPES: Readonly<Partial<Record<StreetPropKind, number>>> = {
  monument: 6,
  artwork: 6,
  flagpole: 2,
  tree: 3,
  bench: 2,
  "lamp-wall-lantern": 2,
  "waste-bin": 2,
  "market-stall": 3,
  "cafe-garden": 3,
  "advertising-column": 2,
  "vending-machine": 3,
  // ADR-0058 stage 2: what a rack's two slots hold (`RACK_SHAPES`), a container's colour.
  "bike-rack": 4,
  container: 2,
};

/** Monument and artwork shapes. */
export const MONUMENT_SHAPE = { obelisk: 0, figure: 1, koziolek: 2, abstract: 3, stele: 4, shrine: 5 } as const;

/** Tree species. */
export const TREE_SHAPE = { lime: 0, maple: 1, chestnut: 2 } as const;

export const shapeOf = (kind: StreetPropKind, variant: number): number => variant % (PROP_SHAPES[kind] ?? 1);

/** Size of a piece: trees 0.8 to 1.25, shrubs 0.7 to 1.2, the rest 1. */
export const scaleOf = (kind: StreetPropKind, variant: number): number => {
  const t = ((variant >> 4) % 16) / 15;
  if (kind === "tree") return 0.8 + 0.45 * t;
  if (kind === "shrubs") return 0.7 + 0.5 * t;
  return 1;
};

/**
 * How far a kind is drawn: `small` things only close by, `medium` ones to the detail distance,
 * `tall` ones (lamps, trees, monuments) also as a simplified far mesh.
 */
export type PropBand = "small" | "medium" | "tall";

const TALL: ReadonlySet<StreetPropKind> = new Set([
  "lamp-pastoral",
  "lamp-wall-lantern",
  "lamp-candelabra",
  "lamp-modern-pole",
  "lamp-road",
  "lamp-park",
  "tree",
  "monument",
  "flagpole",
  "trolley-pole",
]);

const SMALL: ReadonlySet<StreetPropKind> = new Set([
  "bollard",
  "waste-bin",
  "manhole",
  "street-plate",
  "a-frame-sign",
  "cctv",
  "bike-rack",
  "planter",
  "hanging-basket",
  "granite-block",
  "ticket-machine",
  "fountain-jets",
  "street-cabinet",
  "shrubs",
  "floodlight",
  "hydrant",
]);

export const bandOf = (kind: StreetPropKind): PropBand => (TALL.has(kind) ? "tall" : SMALL.has(kind) ? "small" : "medium");

/** Distances (m, camera to cell) per quality: small things, the detailed rest, the far trees and lamps. */
export interface PropLod {
  readonly small: number;
  readonly medium: number;
  readonly far: number;
}

export const PROP_LOD: Readonly<Record<RenderQuality, PropLod>> = {
  high: { small: 80, medium: 170, far: 650 },
  medium: { small: 60, medium: 130, far: 480 },
  low: { small: 40, medium: 80, far: 320 },
};

/** What a cell shows: everything, the detailed rest without small things, the far mesh, nothing. */
export type CellBand = "small" | "medium" | "far" | "off";

const ORDER: readonly CellBand[] = ["small", "medium", "far", "off"];

/** Band of a cell at distance d, holding the current one for `hysteresis` metres past its edge. */
export const cellBand = (d: number, lod: PropLod, current: CellBand, hysteresis = 10): CellBand => {
  const edges = [lod.small, lod.medium, lod.far];
  const pick = (extra: (i: number) => number): CellBand => {
    for (let i = 0; i < edges.length; i++) if (d < edges[i]! + extra(i)) return ORDER[i]!;
    return "off";
  };
  const k = ORDER.indexOf(current);
  return pick((i) => (i >= k ? hysteresis : 0));
};

/** Whether a kind's detailed model shows in a cell of this band. */
export const showsNear = (kind: StreetPropKind, band: CellBand): boolean => {
  if (band === "small") return true;
  if (band === "medium") return bandOf(kind) !== "small";
  return false;
};

/** Side of the blocks (m) that hold the far meshes and halos of four map cells. */
export const PROP_BLOCK = 256;

/** What a block shows: its cells in detail, its far mesh, nothing. */
export type BlockBand = "near" | "far" | "off";

/** Band of a block at distance d, with the same hysteresis as the cells. */
export const blockBand = (d: number, lod: PropLod, current: BlockBand, hysteresis = 10): BlockBand => {
  if (d < lod.medium + (current === "near" ? hysteresis : 0)) return "near";
  if (d < lod.far + (current !== "off" ? hysteresis : 0)) return "far";
  return "off";
};

/**
 * What a cell draws in detail: nothing unless its block is near (the block's far mesh stands in
 * for it), and then at least its tall and medium pieces, so no cell of a near block goes empty.
 */
export const detailBand = (cell: CellBand, block: BlockBand): CellBand => (block !== "near" ? "off" : cell === "small" ? "small" : "medium");
