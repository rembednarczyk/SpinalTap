import type { StreetPropKind } from "@seki/core";
import type { Obstacle } from "./facade-props";
import { placePoint } from "./prop-batch";
import type { PropBlock } from "./prop-block";
import type { PropPoles } from "./prop-poles";
import { PROP_BLOCK } from "./prop-shapes";
import { POLE_REACH } from "./utility-poles";

/**
 * Furniture that stands up into the height of an awning (ADR-0058), as a circle round a point of
 * its model: a café garden's parasol (canopy radius 1.9 m at 2.25 m), shelters, kiosks, stalls,
 * tree crowns, columns and poles. Low pieces (benches, bins, bollards) pass under an awning.
 */
const STANDING: Partial<Record<StreetPropKind, { readonly r: number; readonly z?: number }>> = {
  "cafe-garden": { r: 2.0, z: -0.2 },
  "bus-shelter": { r: 2.3 },
  kiosk: { r: 1.8 },
  "market-stall": { r: 1.7 },
  "food-cart": { r: 2.1 },
  container: { r: 3.3 },
  "food-stall": { r: 1.5, z: -0.15 },
  tree: { r: 2.6 },
  "advertising-column": { r: 0.8 },
  monument: { r: 1.5 },
  "lamp-wall-lantern": { r: 0.6 },
  "lamp-pastoral": { r: 0.6 },
  "lamp-candelabra": { r: 0.8 },
  "lamp-modern-pole": { r: 0.5 },
  "lamp-road": { r: 0.5 },
  "lamp-park": { r: 0.5 },
  floodlight: { r: 0.5 },
  flagpole: { r: 0.3 },
  "traffic-signal": { r: 0.4 },
  "trolley-pole": { r: 0.3 },
};

/** Furniture of the blocks standing up within `r` of (x, z), for the awnings of the facades (ADR-0058). */
export const standingObstacles = (blocks: ReadonlyMap<string, PropBlock>, poles: PropPoles, x: number, z: number, r: number): Obstacle[] => {
  const out: Obstacle[] = [];
  for (let i = Math.floor((x - r) / PROP_BLOCK); i <= Math.floor((x + r) / PROP_BLOCK); i++) {
    for (let j = Math.floor((z - r) / PROP_BLOCK); j <= Math.floor((z + r) / PROP_BLOCK); j++) {
      for (const list of blocks.get(`${i}:${j}`)?.pieces.values() ?? []) {
        for (const p of list) {
          const s = STANDING[p.prop];
          if (!s) continue;
          const c = placePoint(p, { x: 0, y: 0, z: s.z ?? 0 });
          // A pole's crossarms reach further than the lamp's mast (ADR-0063).
          const reach = poles.isPole(p) ? POLE_REACH : s.r * p.scale;
          if (Math.hypot(c.x - x, c.z - z) < r + reach) out.push({ x: c.x, z: c.z, r: reach });
        }
      }
    }
  }
  return out;
};
