import type { Vec3 } from "@seki/core";
import { INTERIORS, type InteriorDef, type InteriorRoom, type InteriorStoreys, inInteriorRoom } from "./interior-areas";

/**
 * The storey of an interior the player stands on (ADR-0100), for the minimap's floor plan, as the
 * floor layers of maps in games with interiors of many levels (Hitman, Deus Ex: Human Revolution,
 * Cyberpunk 2077). Worked out from the interiors' rooms (ADR-0061), no table per interior: a
 * storey is the rooms of the interior and those `within` it on the same floor, the nearest of its
 * plan's `storeys` when it numbers them, else the same `bottom` within half a metre.
 */
export interface InteriorFloor {
  /** The interior the player is in (a shop off the gallery, when in one). */
  readonly interior: InteriorDef;
  /** The storey's number from the plan (P-2 is -2, the gallery's P3 is 3); null without numbered storeys. */
  readonly level: number | null;
  /** The rooms on this storey of the interior, those within it and the one it stands in. */
  readonly rooms: readonly InteriorRoom[];
}

/** Floors this close count as one storey where the plan numbers none. */
const SAME_FLOOR = 0.5;
/** Feet this far under a floor still stand on it (`interiorAt`'s slab and step). */
const FEET_SLACK = 0.3;

const byId = (id: string): InteriorDef | undefined => INTERIORS.find((i) => i.id === id);

/** The interior the storeys and the plan belong to: the gallery for one of its shops. */
const rootOf = (i: InteriorDef): InteriorDef => (i.within ? (byId(i.within) ?? i) : i);

const nearestStorey = (s: InteriorStoreys, y: number): number => {
  let best = 0;
  s.floors.forEach((f, k) => {
    if (Math.abs(f - y) < Math.abs((s.floors[best] as number) - y)) best = k;
  });
  return best;
};

/** The floor under the feet: the highest room floor at or under them where she stands, else the nearest. */
const floorUnder = (rooms: readonly InteriorRoom[], p: Vec3): number => {
  const here = rooms.filter((r) => inInteriorRoom(r, p, 0));
  const pool = here.length > 0 ? here : rooms;
  const under = pool.filter((r) => r.bottom <= p.y + FEET_SLACK);
  if (under.length > 0) return Math.max(...under.map((r) => r.bottom));
  return pool.reduce((best, r) => (Math.abs(r.bottom - p.y) < Math.abs(best - p.y) ? r.bottom : best), pool[0]?.bottom ?? p.y);
};

const cache = new Map<string, InteriorFloor>();

/**
 * The storey of `interiorId` under the feet at `p`, or null outside (an unknown id too). The
 * same storey gives the same object, so a view model built from it changes only on a new floor.
 */
export const interiorFloorAt = (p: Vec3, interiorId: string | null): InteriorFloor | null => {
  const interior = interiorId === null ? undefined : byId(interiorId);
  if (!interior) return null;
  const root = rootOf(interior);
  const family = [root, ...INTERIORS.filter((i) => i.within === root.id)];
  const floor = floorUnder(interior.rooms, p);
  const storeys = root.storeys;
  const storey = storeys ? nearestStorey(storeys, floor) : null;
  const key = `${interior.id}:${storey ?? floor.toFixed(2)}`;
  const held = cache.get(key);
  if (held) return held;
  const sameFloor = (r: InteriorRoom): boolean => (storeys && storey !== null ? nearestStorey(storeys, r.bottom) === storey : Math.abs(r.bottom - floor) <= SAME_FLOOR);
  const rooms = family.flatMap((i) => i.rooms.filter(sameFloor));
  const out: InteriorFloor = { interior, level: storeys && storey !== null ? storeys.first + storey : null, rooms };
  cache.set(key, out);
  return out;
};
