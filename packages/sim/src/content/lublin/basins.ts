import type { GroundPoint, ViewDescriptor } from "@seki/core";
import type { StaticProp } from "../builders";
import type { PrismDef } from "../../world/prism";
import { groundY } from "./terrain";
import type { LublinChunkData } from "./types";

/** The granite rim of a fountain's basin as the renderer draws it (ADR-0044): its top over the ground, its width inwards. */
export const BASIN_RIM = { top: 0.45, width: 0.35 } as const;

/** Seen nowhere: the renderer draws the rim from the chunk's `ground` view. */
const NO_VIEW: ViewDescriptor = { kind: "street-props", items: [] };

const ringOf = (flat: readonly number[]): GroundPoint[] => {
  const pts: GroundPoint[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i] as number, z: flat[i + 1] as number });
  return pts;
};

const counterClockwise = (ring: readonly GroundPoint[]): readonly GroundPoint[] => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i] as GroundPoint;
    const q = ring[(i + 1) % ring.length] as GroundPoint;
    a += p.x * q.z - q.x * p.z;
  }
  return a >= 0 ? ring : [...ring].reverse();
};

/**
 * The rims of a chunk's fountains as solids: one block per side of the basin, as wide and as
 * tall as the drawn rim. Seki steps up onto the stone and down into water a hand deep, instead
 * of walking through the granite; the crowd keeps out of the basins already. The camera looks
 * through them, as through the furniture.
 */
export const basinRimProps = (chunk: LublinChunkData): StaticProp[] =>
  chunk.ground
    .filter((g) => g.surface === "basin")
    .flatMap((g) => {
      const ring = counterClockwise(ringOf(g.outline));
      return ring.flatMap((a, i): StaticProp[] => {
        const b = ring[(i + 1) % ring.length] as GroundPoint;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.05) return [];
        // Inward is left of the edge for a counter-clockwise ring (x east, z north).
        const ix = (-(b.z - a.z) / len) * BASIN_RIM.width;
        const iz = ((b.x - a.x) / len) * BASIN_RIM.width;
        const cx = (a.x + b.x) / 2;
        const cz = (a.z + b.z) / 2;
        const y = Math.min(groundY(a.x, a.z), groundY(b.x, b.z));
        const top = Math.max(groundY(a.x, a.z), groundY(b.x, b.z)) - y + BASIN_RIM.top;
        const at = (p: GroundPoint): GroundPoint => ({ x: p.x - cx, z: p.z - cz });
        const prism: PrismDef = { points: [at(a), at(b), at({ x: b.x + ix, z: b.z + iz }), at({ x: a.x + ix, z: a.z + iz })], bottom: -0.2, top };
        return [{ center: { x: cx, y, z: cz }, view: NO_VIEW, solid: true, prisms: [prism], scenery: true, seeThrough: true }];
      });
    });
