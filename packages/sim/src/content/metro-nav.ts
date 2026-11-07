import { type NavEdge, type NavGraph, type NavNode, mergeNav } from "./builders";
import { METRO_ENTRANCES, type MetroEntranceDef } from "./metro";
import { PAVILION, STAIRS, spotFrame } from "./metro-pavilion";
import { FLIGHT } from "./metro-platform";
import { groundY } from "./lublin/terrain";

/**
 * The metro's entrances in the level graph (ADR-0021, G-368): the pavilion's stairs from the
 * street to the hall and, at an entrance A, the second flight from the landing behind the end
 * wall to the platform. On its own floor (the street, the hall, the platform) an NPC walks round
 * the obstacles itself; the graph only says which way down. The nodes stand on the axis of the
 * flights, a step outside the opening and `OFF_FLIGHT` off the ends of each flight. A node is
 * reached only in a straight line from where one stands, so the street round the pavilion has its
 * corners too: from beside it or behind it the door is behind its walls.
 */

/** A node this far past the end of a flight stands clear of its first and last step. */
const OFF_FLIGHT = 0.4;
/** The corners' nodes stand this far off the pavilion's walls. */
const OFF_WALL = 1;

const entranceNav = (e: MetroEntranceDef & { readonly station: string }): NavGraph => {
  const { point, rect } = spotFrame(e.spot);
  const id = (part: string) => `metro-${e.station}-${e.label}-${part}`;
  const foot = STAIRS.landing + STAIRS.run;
  const node = (part: string, u: number, y: number): NavNode => ({ id: id(part), at: { ...point(u, 0), y } });
  const nodes: NavNode[] = [{ id: id("door"), at: e.door }, node("head", STAIRS.landing / 2, e.street), node("foot", foot + OFF_FLIGHT, e.floor)];
  const edges: NavEdge[] = [
    { a: id("door"), b: id("head") },
    { a: id("head"), b: id("foot"), via: rect(0, foot, -STAIRS.width / 2, STAIRS.width / 2) },
  ];
  // Round the pavilion on the street, but not on the side of a wall of the map close beside it (T-160).
  for (const side of [-1, 1] as const) {
    if (e.spot.wall?.side === side) continue;
    const w = side * (PAVILION.width / 2 + OFF_WALL);
    const corner = (part: string, u: number): NavNode => {
      const at = point(u, w);
      return { id: id(`${part}${side}`), at: { ...at, y: groundY(at.x, at.z) } };
    };
    const front = corner("front", -OFF_WALL);
    const back = corner("back", PAVILION.length + OFF_WALL);
    nodes.push(front, back);
    edges.push({ a: id("door"), b: front.id }, { a: front.id, b: back.id });
  }
  const p = e.platform;
  if (p) {
    nodes.push(node("landing", p.u.stepsTop - OFF_FLIGHT, p.hall), node("bottom", p.u.back + OFF_FLIGHT, p.floor));
    edges.push({ a: id("foot"), b: id("landing") }, { a: id("landing"), b: id("bottom"), via: rect(p.u.wallEnd, p.u.back, -FLIGHT.width / 2, FLIGHT.width / 2) });
  }
  return { nodes, edges };
};

export const METRO_NAV: NavGraph = mergeNav(...METRO_ENTRANCES.map(entranceNav));
