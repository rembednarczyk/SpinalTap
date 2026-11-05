/**
 * Where the metro layer writes its names (ADR-0071): over or under a ring, never over another name
 * or another ring. Greedy in the order given (the platform and the destination first), so when the
 * view is too far out for all of them the less important names give way instead of running into
 * each other. Map space: x east, y = −z; sizes in metres of the map (`k` per icon unit).
 */

export type NamePlace = "above" | "below" | null;

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
  /** Only the preferred side (a possible station's note goes under its ring or nowhere). */
  readonly only?: boolean;
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
export const nameOffset = (ring: number, size: number, place: "above" | "below"): number => (place === "above" ? -1 : 1) * (ring + GAP + size / 2);

const boxOf = (it: NameItem, place: "above" | "below", k: number): Box => {
  const half = (it.name.length * LETTER * it.size * k) / 2 + k;
  const y = -it.z + nameOffset(it.ring, it.size, place) * k;
  return { minX: it.x - half, maxX: it.x + half, minY: y - (it.size * k) / 2, maxY: y + (it.size * k) / 2 };
};

const ringBox = (it: NameItem, k: number): Box => ({ minX: it.x - it.ring * k, maxX: it.x + it.ring * k, minY: -it.z - it.ring * k, maxY: -it.z + it.ring * k });

/** The side each item's name goes on, or null where it would collide. Keys are the items' ids. */
export const placeNames = (items: readonly NameItem[], k: number): Map<string, NamePlace> => {
  const rings = items.map((it) => ({ x: it.x, z: it.z, box: ringBox(it, k) }));
  const placed: Box[] = [];
  const out = new Map<string, NamePlace>();
  for (const it of items) {
    if (it.prefer === null) {
      out.set(it.id, null);
      continue;
    }
    const sides: ("above" | "below")[] = it.only ? [it.prefer] : [it.prefer, it.prefer === "above" ? "below" : "above"];
    const side = sides.find((s) => {
      const b = boxOf(it, s, k);
      return !placed.some((p) => overlaps(p, b)) && !rings.some((r) => (r.x !== it.x || r.z !== it.z) && overlaps(r.box, b));
    });
    if (side) placed.push(boxOf(it, side, k));
    out.set(it.id, side ?? null);
  }
  return out;
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
