/**
 * The streets' name plates at the start of each street (ADR-0094 stage 3, the user's decision of
 * 20.11: "znaki ulic tylko na początku ulicy"), flat on the walls of the corner buildings as the
 * towns hang them (the 1934 regulation: on the corners of streets and squares; ZDM Warszawa's rules
 * for street plates), not on posts at every junction.
 *
 * A street's start is the end its house numbers start from: the end nearest the building with the
 * lowest number on it (OSM `addr:street` and `addr:housenumber` of the buildings). A street with no
 * addresses starts at the end nearer the town's centre (Brama Krakowska), where Polish numbering
 * starts from. The ends are the points of its lines no other line of the same name meets (the chunks'
 * edges cut the streets into pieces whose ends meet). From a step into the street at its start, a
 * plate goes on the first wall each side within reach, its back on the facade, facing the street.
 */
import type { Pt } from "./geometry.ts";
import type { Placed, PlanItem } from "./props-gen.ts";
import { yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";

/** A building's address: its street, the number's leading figure and a point of it. */
export interface Address {
  readonly street: string;
  readonly number: number;
  readonly p: Pt;
}

/** The town's centre, where house numbering starts from (Brama Krakowska, world metres). */
export const CENTRE: Pt = { x: 481, z: -83 };
/** How far into the street from its end the plates' walls are looked for, and how far aside (m). */
const INTO = 2;
const REACH = 14;
const STEP = 0.25;
/** How far from a passage's axis a plate keeps (m): its walls are a vault's. */
const PASSAGE_ROOM = 3;
/** Ends of two lines within this of each other are one point (m). */
const MEET = 0.75;
/** The plates' shape: on a wall (`PLATE_SHAPE.wall` in the renderer). */
export const WALL_PLATE = 1;

const key = (p: Pt): string => `${Math.round(p.x / MEET)}:${Math.round(p.z / MEET)}`;

/** A street's free ends: each with the direction into the street from it. */
export const streetEnds = (lines: readonly (readonly Pt[])[]): { readonly p: Pt; readonly into: Pt }[] => {
  const seen = new Map<string, number>();
  const ends = lines.filter((l) => l.length >= 2).flatMap((l) => [
    { p: l[0]!, next: l[1]! },
    { p: l[l.length - 1]!, next: l[l.length - 2]! },
  ]);
  for (const e of ends) seen.set(key(e.p), (seen.get(key(e.p)) ?? 0) + 1);
  return ends
    .filter((e) => seen.get(key(e.p)) === 1)
    .map((e) => {
      const l = Math.hypot(e.next.x - e.p.x, e.next.z - e.p.z) || 1;
      return { p: e.p, into: { x: (e.next.x - e.p.x) / l, z: (e.next.z - e.p.z) / l } };
    });
};

/** The start of a street: the end nearest its lowest address, else the end nearest the centre. */
export const streetStart = <E extends { readonly p: Pt }>(ends: readonly E[], addresses: readonly Address[]): E | null => {
  if (ends.length === 0) return null;
  const lowest = [...addresses].sort((a, b) => a.number - b.number || a.p.x - b.p.x || a.p.z - b.p.z)[0];
  const to = lowest?.p ?? CENTRE;
  return [...ends].sort((a, b) => Math.hypot(a.p.x - to.x, a.p.z - to.z) - Math.hypot(b.p.x - to.x, b.p.z - to.z))[0]!;
};

/** The first wall from `from` along `dir` within reach: a point 0.2 to 0.45 m in front of it. */
const wallAlong = (site: Site, from: Pt, dir: Pt): Pt | null => {
  if (site.surfaceAt(from) === "building") return null;
  for (let t = STEP; t <= REACH; t += STEP) {
    const q = { x: from.x + dir.x * t, z: from.z + dir.z * t };
    if (site.surfaceAt(q) === "building") return { x: from.x + dir.x * (t - STEP - 0.2), z: from.z + dir.z * (t - STEP - 0.2) };
  }
  return null;
};

/** The plates at the start of every named street, up to the plan's count, the streets by name. */
export const startPlates = (site: Site, item: PlanItem, addresses: readonly Address[]): Placed[] => {
  const byName = new Map<string, Pt[][]>();
  for (const s of site.streets) if (s.name) byName.set(s.name, [...(byName.get(s.name) ?? []), [...s.line]]);
  const out: Placed[] = [];
  for (const name of [...byName.keys()].sort()) {
    const start = streetStart(streetEnds(byName.get(name)!), addresses.filter((a) => a.street === name));
    if (!start) continue;
    const at = { x: start.p.x + start.into.x * INTO, z: start.p.z + start.into.z * INTO };
    // A street starting through a gate (Brama Krakowska, Grodzka): its walls are the gate's vault, no plate there.
    if (site.nearPassage(at, PASSAGE_ROOM)) continue;
    for (const side of [1, -1] as const) {
      if (out.length >= (item.count ?? 0)) return out;
      const n = { x: -start.into.z * side, z: start.into.x * side };
      const wall = wallAlong(site, at, n);
      // On the pavement or the bare ground by the wall: a point on a carriageway or the rails would be moved off it, away from the wall.
      if (!wall || site.nearPassage(wall, PASSAGE_ROOM) || site.surfaceAt(wall) === "road" || site.surfaceAt(wall) === "rail") continue;
      // Where the chunks keep it, at 0.1 m: not in the wall of a corner beside.
      if (site.surfaceAt({ x: Math.round(wall.x * 10) / 10, z: Math.round(wall.z * 10) / 10 }) === "building") continue;
      // Its back on the facade, its face to the street.
      out.push({ prop: "street-plate", p: wall, yaw: yawOf(-n.x, -n.z), key: `${item.id}:${name}:${side}`, shape: WALL_PLATE });
    }
  }
  return out;
};
