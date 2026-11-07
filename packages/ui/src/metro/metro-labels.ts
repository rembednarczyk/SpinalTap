/**
 * Where the metro layer writes its names (ADR-0071): over or under a ring, never over another name
 * or another ring. Greedy in the order given (the platform and the destination first), so when the
 * view is too far out for all of them the less important names give way instead of running into
 * each other. Map space: x east, y = −z; sizes in metres of the map (`k` per icon unit).
 */

import type { MapBox } from "../store/map-vm";

export type Side = "above" | "below";
export type NamePlace = Side | null;

/** Where a name went: the side of its ring and how far east of the ring's centre its middle is, icon units. */
export interface Placed {
  readonly side: Side;
  readonly dx: number;
}

export interface NameItem {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly z: number;
  /** The ring's radius in icon units. */
  readonly ring: number;
  /** Font size in icon units. */
  readonly size: number;
  /** The side tried first; `null` writes no name. */
  readonly prefer: NamePlace;
  /**
   * A note to the name of this id (a possible station's distance): on the other side of the ring,
   * or beyond the name on its side (`noteOffset`), or nowhere. Never over a line.
   */
  readonly noteOf?: string;
}

interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/** Width of a monospace letter as a share of the font size, with the layer's letter spacing. */
const LETTER = 0.66;
/** Gap between a ring and its name, icon units. */
const GAP = 2;

const overlaps = (a: Box, b: Box) => a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;

/** Offset of the name's middle from the ring's centre, icon units (positive: under it). */
export const nameOffset = (ring: number, size: number, place: Side): number => (place === "above" ? -1 : 1) * (ring + GAP + size / 2);

/** Gap between a name and the note beyond it, icon units (the letters' stroke and descenders). */
const NOTE_GAP = 3;

/** Offset of a note's middle from the ring's centre, icon units: beyond the name when it shares its side. */
export const noteOffset = (ring: number, nameSize: number, size: number, place: Side, name: Side | null): number =>
  place === name ? nameOffset(ring + nameSize + NOTE_GAP, size, place) : nameOffset(ring, size, place);

/** Half a name's width, icon units. */
const halfOf = (it: NameItem) => (it.name.length * LETTER * it.size) / 2 + 1;

const boxOf = (it: NameItem, at: Placed, k: number, nameSize = 0, name: Side | null = null): Box => {
  const half = halfOf(it) * k;
  const x = it.x + at.dx * k;
  const y = -it.z + (it.noteOf ? noteOffset(it.ring, nameSize, it.size, at.side, name) : nameOffset(it.ring, it.size, at.side)) * k;
  return { minX: x - half, maxX: x + half, minY: y - (it.size * k) / 2, maxY: y + (it.size * k) / 2 };
};

const ringBox = (it: NameItem, k: number): Box => ({ minX: it.x - it.ring * k, maxX: it.x + it.ring * k, minY: -it.z - it.ring * k, maxY: -it.z + it.ring * k });

/** Half the width of the line's stroke and its glow, icon units: a name keeps this far off it. */
const LINE_PAD = 3;

/** Whether the segment (ax, ay)–(bx, by) runs through the box (Liang–Barsky clipping). */
const segmentHits = (ax: number, ay: number, bx: number, by: number, b: Box): boolean => {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  for (const [p, q] of [
    [-dx, ax - b.minX],
    [dx, b.maxX - ax],
    [-dy, ay - b.minY],
    [dy, b.maxY - ay],
  ] as const) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
};

/** Whether any of the lines (x, z pairs of map space) runs through the box, kept `pad` metres off. */
const linesHit = (lines: readonly (readonly number[])[], box: Box, pad: number): boolean => {
  const b = { minX: box.minX - pad, maxX: box.maxX + pad, minY: box.minY - pad, maxY: box.maxY + pad };
  return lines.some((l) => {
    for (let i = 0; i + 3 < l.length; i += 2) if (segmentHits(l[i] as number, -(l[i + 1] as number), l[i + 2] as number, -(l[i + 3] as number), b)) return true;
    return false;
  });
};

const flip = (s: Side): Side => (s === "above" ? "below" : "above");

/**
 * The places tried for an item, best first: centred over or under the ring (the preferred side
 * first), then the same pulled west or east until its end is over the ring. A note tries the
 * other side of its name's ring, then beyond the name.
 */
const candidates = (it: NameItem, name: Placed | null): Placed[] => {
  const pull = Math.max(0, halfOf(it) - it.ring);
  const around = (s: Side): Placed[] => [
    { side: s, dx: 0 },
    { side: s, dx: -pull },
    { side: s, dx: pull },
  ];
  if (it.noteOf) return name ? [...around(flip(name.side)), { side: name.side, dx: name.dx }] : around("below");
  const first = it.prefer ?? "above";
  return [{ side: first, dx: 0 }, { side: flip(first), dx: 0 }, ...around(first).slice(1), ...around(flip(first)).slice(1)];
};

/**
 * Where each item's name goes, or null where it would collide. Keys are the items' ids.
 * A place off the `lines` (the tunnel, the branches; x, z pairs) wins over the preferred one on
 * them, pulled aside if need be; a name with no place free of lines stays centred on the side it
 * has room on, a note gives way.
 */
export const placeNames = (items: readonly NameItem[], k: number, lines: readonly (readonly number[])[] = []): Map<string, Placed | null> => {
  const rings = items.map((it) => ({ x: it.x, z: it.z, box: ringBox(it, k) }));
  const placed: Box[] = [];
  const out = new Map<string, Placed | null>();
  for (const it of items) {
    if (it.prefer === null) {
      out.set(it.id, null);
      continue;
    }
    const name = it.noteOf ? (out.get(it.noteOf) ?? null) : null;
    const nameSize = it.noteOf ? (items.find((n) => n.id === it.noteOf)?.size ?? 0) : 0;
    const box = (at: Placed) => boxOf(it, at, k, nameSize, name?.side ?? null);
    const free = (at: Placed) => !placed.some((p) => overlaps(p, box(at))) && !rings.some((r) => (r.x !== it.x || r.z !== it.z) && overlaps(r.box, box(at)));
    const clear = (at: Placed) => free(at) && !linesHit(lines, box(at), LINE_PAD * k);
    const tries = candidates(it, name);
    // A name pulls aside only off a line: where the names crowd it out centred, it gives way as before.
    const centred = it.noteOf ? undefined : tries.slice(0, 2).find(free);
    const at = it.noteOf ? tries.find(clear) : centred && (tries.slice(0, 2).find(clear) ?? tries.slice(2).find(clear) ?? centred);
    if (at) placed.push(box(at));
    out.set(it.id, at ?? null);
  }
  return out;
};

/**
 * Where a possible station's ring goes in a view (`box` less `inset` metres): where it is when
 * inside, else where its branch (`path`, x, z pairs from the line out) leaves the view, the branch
 * cut there. A station without a branch is kept to the nearest point inside.
 */
export const pinToView = (at: { readonly x: number; readonly z: number }, path: readonly number[], box: MapBox | undefined, inset: number): { x: number; z: number; path: readonly number[] } => {
  if (!box) return { x: at.x, z: at.z, path };
  const v = { minX: box.minX + inset, maxX: box.maxX - inset, minZ: box.minZ + inset, maxZ: box.maxZ - inset };
  const inside = (x: number, z: number) => x >= v.minX && x <= v.maxX && z >= v.minZ && z <= v.maxZ;
  if (inside(at.x, at.z)) return { x: at.x, z: at.z, path };
  for (let i = 0; i + 3 < path.length; i += 2) {
    const [ax, az, bx, bz] = [path[i], path[i + 1], path[i + 2], path[i + 3]] as [number, number, number, number];
    if (!inside(ax, az) || inside(bx, bz)) continue;
    // The share of the segment before it leaves the view, the tightest of the four sides.
    const leave = (a: number, b: number, lo: number, hi: number) => (b > hi ? (hi - a) / (b - a) : b < lo ? (lo - a) / (b - a) : 1);
    const t = Math.min(leave(ax, bx, v.minX, v.maxX), leave(az, bz, v.minZ, v.maxZ));
    const x = ax + t * (bx - ax);
    const z = az + t * (bz - az);
    return { x, z, path: [...path.slice(0, i + 2), x, z] };
  }
  return { x: Math.min(v.maxX, Math.max(v.minX, at.x)), z: Math.min(v.maxZ, Math.max(v.minZ, at.z)), path };
};

/** How far a station's ring and its names reach up and down, icon units. */
const STATION_REACH = 21;

/** A name of the map tab: where it is and how big (`CityLabels`' labels). */
export interface MapName {
  readonly kind: string;
  readonly text: string;
  readonly x: number;
  readonly z: number;
  readonly angle: number;
}

/**
 * The district names of the map tab moved north off the metro's stations (ADR-0071): a ring with
 * its name over and under it takes about 21 icon units each way, and a district's name in the
 * middle of its chunks can fall right on it (Plac Litewski under "Krakowskie Przedmieście").
 */
export const liftDistricts = <L extends MapName>(labels: readonly L[], stations: readonly { readonly x: number; readonly z: number; readonly name: string }[], k: number, size: number): L[] =>
  labels.map((l) => {
    if (l.kind !== "district") return l;
    const half = (l.text.length * 0.8 * size) / 2;
    const hit = stations.find((s) => {
      const reach = Math.max(STATION_REACH * k, (s.name.length * LETTER * 11 * k) / 2 + k);
      return Math.abs(s.x - l.x) < half + reach && Math.abs(s.z - l.z) < size / 2 + STATION_REACH * k;
    });
    return hit ? { ...l, z: hit.z + STATION_REACH * k + size / 2 + GAP * k } : l;
  });
