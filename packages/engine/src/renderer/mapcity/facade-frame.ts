import type { BuildingUse } from "@seki/core";
import { type FacadeStyle, ROOF_STYLE, SHOPFRONT_BIT, WINDOW_STYLE, facadeStyle } from "./facade-style";
import { type Obb, type P2, orientedBox, signedArea } from "./polygon";
import type { Rgba } from "../mesh-sink";
import type { Uv } from "./sink-ops";

/**
 * The measured frame of a building from the map (ADR-0044): its outline, levels and walls
 * classified against the neighbours, shared by the near facade, the far block and the signs.
 */

export interface MapBuilding {
  readonly id: number;
  /** Clean counter-clockwise outline in world metres. */
  readonly ring: readonly P2[];
  /** Ground floor level (the entity's y). */
  readonly base: number;
  /** Lowest ground under the outline: the walls reach down to it on a slope. */
  readonly foot: number;
  readonly height: number;
  readonly levels: number;
  readonly use: BuildingUse;
  readonly roof?: number;
  readonly name?: string;
  readonly look: number;
  /** Shop windows on the ground floor (from the map); absent: chosen from the look. */
  readonly shopfront?: boolean;
  /** Openings through the facade into a room on the ground floor (ADR-0045), in world metres. */
  readonly doorways?: readonly WorldDoorway[];
  /** Street passages through the ground floor, lined inside (ADR-0048). */
  readonly passages?: readonly WorldPassage[];
  /** Lifted over the street (a covered footbridge, ADR-0048): the walls start at `foot`, an underside closes them; `base` stays the street. */
  readonly lifted?: boolean;
  /** Shop signs hang from wrought-iron brackets (the Old Town, ADR-0048). */
  readonly bracketSigns?: boolean;
  /** Metres of Lublin 2077's superstructure over `top` (ADR-0051). */
  readonly rise?: number;
  /** Density (0..1) of the cables, ads, pipes and neon this building hangs over the street (ADR-0051). */
  readonly clutter?: number;
}

/** A doorway in world metres: the middle of the opening on a wall, its width, bottom and top (world y). */
export interface WorldDoorway {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly bottom: number;
  readonly top: number;
}

/** A passage through the building in world metres (ADR-0048): the view's, moved to the building's position. */
export interface WorldPassage {
  readonly from: P2;
  readonly to: P2;
  readonly width: number;
  /** World y of the floor at `from` and at `to`. */
  readonly floor: readonly [number, number];
  readonly spring: number;
  readonly crown: number;
}

export interface Wall {
  readonly a: P2;
  readonly b: P2;
  readonly length: number;
  /** Outward unit normal. */
  readonly nx: number;
  readonly nz: number;
  /** Another building stands against it: no windows, no signs. */
  readonly blind: boolean;
  /** Top of the neighbour against it (world y), or -Infinity. */
  readonly coveredTo: number;
  /** Bay width that fits the wall a whole number of times; 0 for no windows. */
  readonly bay: number;
}

export interface FacadeFrame {
  readonly b: MapBuilding;
  readonly style: FacadeStyle;
  readonly box: Obb;
  readonly walls: readonly Wall[];
  /** Under the main cornice (top of the window zone plus the frieze). */
  readonly eave: number;
  readonly top: number;
  readonly storey: number;
  /** Height of the ground floor (1.25 storeys; the whole wall for a church). */
  readonly ground: number;
}

/** Top (world y) of another building whose outline contains (x, z), or null. */
export type NeighbourAt = (x: number, z: number, self: number) => number | null;

/** The seed in the middle of one of 256 bins: the shader reads it back exactly. */
export const seedBin = (seed: number): number => (Math.min(Math.floor(Math.max(seed, 0) * 256), 255) + 0.5) / 256;

/** uv2 of a wall: x = storey (dm, integer) + bay / 10, y = window style + seed. */
export const wallMeta = (storey: number, bay: number, style: number, seed: number): Uv => [bay > 0 ? Math.round(storey * 10) + Math.round(Math.min(Math.max(bay, 0.5), 9.9) * 100) / 1000 : 0, style + seedBin(seed)];
export const trimMeta = (seed: number): Uv => [0, seedBin(seed)];
export const roofMeta = (seed: number): Uv => [0, ROOF_STYLE + seedBin(seed)];

const SAMPLES = [0.15, 0.5, 0.85] as const;

const classify = (b: MapBuilding, a: P2, c: P2, neighbour: NeighbourAt): { blind: boolean; coveredTo: number } => {
  const len = Math.hypot(c.x - a.x, c.z - a.z) || 1;
  const nx = (c.z - a.z) / len;
  const nz = -(c.x - a.x) / len;
  let covered = Infinity;
  for (const t of SAMPLES) {
    const top = neighbour(a.x + (c.x - a.x) * t + nx * 0.6, a.z + (c.z - a.z) * t + nz * 0.6, b.id);
    // A part lifted onto its building (G-049) stands over it: the building under its walls is no firewall.
    if (top === null || (b.lifted && top <= b.foot + 0.1)) return { blind: false, coveredTo: -Infinity };
    covered = Math.min(covered, top);
  }
  return { blind: true, coveredTo: covered };
};

export const facadeFrame = (b: MapBuilding, neighbour: NeighbourAt): FacadeFrame => {
  const box = orientedBox(b.ring);
  const area = Math.abs(signedArea(b.ring));
  const style = facadeStyle({ use: b.use, levels: b.levels, height: b.height, ...(b.roof !== undefined ? { roof: b.roof } : {}), look: b.look, area, width: box.halfShort * 2, ...(b.shopfront !== undefined ? { shopfront: b.shopfront } : {}), ...(b.lifted ? { lifted: true } : {}) });
  const top = b.base + b.height;
  const eave = top - style.atticHeight;
  const levels = Math.max(1, Math.round(b.levels));
  const zone = Math.max(eave - b.base - (style.cornice ? 0.7 : 0.25), 2.4);
  const church = style.window === WINDOW_STYLE.church;
  // A free-standing tower stands in tiers of about 8 m; a church's windows are one tall row.
  const storey = style.freeTower ? zone / Math.max(1, Math.round(zone / 8) + 0.25) : church ? zone / 1.25 : Math.min(Math.max(zone / (levels + 0.25), 2.4), 7.5);
  const walls: Wall[] = [];
  for (let i = 0; i < b.ring.length; i++) {
    const a = b.ring[i] as P2;
    const c = b.ring[(i + 1) % b.ring.length] as P2;
    const length = Math.hypot(c.x - a.x, c.z - a.z);
    if (length < 0.05) continue;
    const { blind, coveredTo } = classify(b, a, c, neighbour);
    const n = Math.max(1, Math.round(length / style.bay));
    walls.push({
      a,
      b: c,
      length,
      nx: (c.z - a.z) / length,
      nz: -(c.x - a.x) / length,
      blind,
      coveredTo,
      bay: blind || length < 1.4 || style.window === WINDOW_STYLE.none ? 0 : length / n,
    });
  }
  return { b, style, box, walls, eave, top, storey, ground: storey * 1.25 };
};

/** uv2 of the walls of this frame (the window style with the shop bit). */
export const frameWallMeta = (f: FacadeFrame, w: Wall): Uv => wallMeta(f.storey, w.bay, f.style.window + (f.style.shopfront ? SHOPFRONT_BIT : 0), f.style.seed);

/** Walls a neighbour hides up to this building's top: not worth drawing. */
export const hiddenWall = (f: FacadeFrame, w: Wall): boolean => w.blind && w.coveredTo >= f.top - 0.1;

/** Colours of a building's parts, with the dressing flag in alpha. */
export interface Palette {
  readonly wall: Rgba;
  readonly trim: Rgba;
  readonly plinth: Rgba;
  readonly roof: Rgba;
}
