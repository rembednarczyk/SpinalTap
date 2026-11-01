import { VEHICLE_SIZE } from "../../../packages/core/src";
import { pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { type Area, extractFeatures } from "../../osm-import/src/features.ts";
import { type OsmData } from "../../osm-import/src/osm.ts";
import { type CrowdLane } from "../../../packages/sim/src/content/crowd";
import { BAY_STEP } from "../../../packages/sim/src/content/kerb-bays";
import { type ParkedCar } from "../../../packages/sim/src/content/parked-cars";
import { pointAt, projectOn } from "../../../packages/sim/src/content/traffic";
import { LANE_HALF_GAP } from "../../../packages/sim/src/world/crowd";

/**
 * The cars and walkers of the kerb car parks the map data draws (`amenity=parking`, `parking=lane`
 * or `street_side`, G-177), worked out from the data's outlines and tags alone: a strip along a
 * street, its cars at the kerb, turned as its `orientation` says, and no walkers' route in it.
 */

type P = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

const segmentGap = (p: P, a: P, b: P) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
};
const ringGap = (p: P, ring: readonly P[]) => Math.min(...ring.map((a, i) => segmentGap(p, a, ring[(i + 1) % ring.length]!)));

export const kerbParksOf = (osm: OsmData): Area[] =>
  extractFeatures(osm).areas.filter((a) => a.tags.amenity === "parking" && (a.tags.parking === "lane" || a.tags.parking === "street_side"));

const corners = (c: ParkedCar): P[] => {
  const { width, length } = VEHICLE_SIZE[c.model];
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  return [-0.5, 0.5].flatMap((a) => [-0.5, 0.5].map((b) => ({ x: c.x + fz * width * a + fx * length * b, z: c.z - fx * width * a + fz * length * b })));
};

/** A car with its middle in a kerb car park and a corner of its body more than 0.3 m out of the outline (on the carriageway or the pavement). */
export const bayCarsOutOfPark = (parks: readonly Area[], cars: readonly ParkedCar[]): Finding[] =>
  cars.flatMap((c) => {
    const park = parks.find((p) => pointInRing(c, p.ring));
    if (!park) return [];
    const out = corners(c).map((q) => (pointInRing(q, park.ring) ? 0 : ringGap(q, park.ring)));
    const worst = Math.max(...out);
    return worst > 0.3 ? [{ at: near(c.x, c.z), what: `${c.model} in ${park.id}: a corner ${worst.toFixed(2)} m out` }] : [];
  });

type Street = readonly (readonly [number, number])[];

/**
 * A strip's street (the car road whose axis runs nearest its outline), its length along that
 * street and its median depth across it (m), from chords across the street every half metre
 * (each sampled every 10 cm out to 25 m on the strip's side).
 */
const stripOf = (ring: readonly P[], streets: readonly Street[]) => {
  const gap = (s: Street) => Math.min(...ring.map((p) => projectOn(s, p.x, p.z).d));
  const street = streets.reduce((m, s) => (gap(s) < gap(m) ? s : m));
  const along = ring.map((p) => projectOn(street, p.x, p.z));
  const side = Math.sign(along.reduce((m, q) => m + q.side, 0));
  const chords: number[] = [];
  for (let s = Math.min(...along.map((q) => q.s)); s <= Math.max(...along.map((q) => q.s)); s += 0.5) {
    const p = pointAt(street, s);
    let n = 0;
    for (let d = 0; d <= 25; d += 0.1) if (pointInRing({ x: p.x + p.tz * side * d, z: p.z - p.tx * side * d }, ring)) n++;
    if (n > 5) chords.push(n / 10);
  }
  return { street, length: chords.length / 2, depth: chords.sort((a, b) => a - b)[Math.floor(chords.length / 2)] ?? 0 };
};

/** A strip's layout as its tag says, else aslant from 4.5 m deep (G-187), else along the kerb. */
const layoutOf = (park: Area, depth: number): string => park.tags.orientation ?? (depth >= 4.5 ? "untagged deep" : "parallel");

/** A car's angle to the way of the car road nearest it (°): 0 along it, 90 across. */
const angleToStreet = (c: ParkedCar, streets: readonly Street[]) => {
  const street = streets.reduce((m, s) => (projectOn(s, c.x, c.z).d < projectOn(m, c.x, c.z).d ? s : m));
  const t = pointAt(street, projectOn(street, c.x, c.z).s);
  return (Math.acos(Math.min(1, Math.abs(t.tx * Math.sin(c.yaw) + t.tz * Math.cos(c.yaw)))) * 180) / Math.PI;
};

/**
 * A car in a kerb car park turned against the way the map and Lublin's streets draw its bays,
 * measured to the car road nearest it (a strip's longest edge may run across its street at a
 * bend, G-189): within 20° of along the kerb where it is mapped `orientation=perpendicular` or
 * `diagonal`; more than 15° off 60° where it is mapped `diagonal`. A strip 4.5 m deep or more
 * mapped without the tag holds its cars aslant in Lublin (G-187), or in one layout across or
 * along the kerb where none aslant fits (on a slope, by a bend): one there that stands across or
 * along beside one aslant is turned wrong.
 */
export const bayCarsMisturned = (parks: readonly Area[], cars: readonly ParkedCar[], streets: readonly Street[]): Finding[] => {
  const angles = new Map(cars.map((c) => [c, angleToStreet(c, streets)]));
  const aslant = (a: number) => a >= 45 && a <= 75;
  return cars.flatMap((c) => {
    const park = parks.find((p) => pointInRing(c, p.ring));
    const orientation = park && layoutOf(park, stripOf(park.ring, streets).depth);
    if (!park || orientation === "parallel") return [];
    const angle = angles.get(c)!;
    const mixed = orientation === "untagged deep" && !aslant(angle) && cars.some((o) => pointInRing(o, park.ring) && aslant(angles.get(o)!));
    const wrong =
      orientation === "untagged deep"
        ? mixed && `${angle.toFixed(0)}° off the kerb beside a car aslant`
        : angle < 20
          ? "along the kerb"
          : orientation === "diagonal" && Math.abs(angle - 60) > 15 && `${angle.toFixed(0)}° off the kerb, not 60°`;
    return wrong ? [{ at: near(c.x, c.z), what: `${c.model} in ${park.id} (${orientation}) ${wrong}` }] : [];
  });
};

/** Share of a kerb car park's bays taken (`parked-cars`' occupancy, as Plac Zamkowy's). */
const TAKEN = 0.8;
/** Furniture or a footway this near a strip's outline, outside it, stands at its kerb (m). */
const AT_KERB = 1.5;

/** Things outside a kerb car park's outline that its cars must keep clear of: solid furniture (its round footprint) and footways' axes. */
export interface KerbNeighbours {
  readonly furniture: readonly { readonly x: number; readonly z: number; readonly r: number }[];
  readonly footways: readonly (readonly P[])[];
}

/** The furniture and footway segments outside a strip's outline and within `AT_KERB` of it. */
const atKerb = (ring: readonly P[], by: KerbNeighbours): number => {
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  const close = (p: P) => p.x > Math.min(...xs) - 10 && p.x < Math.max(...xs) + 10 && p.z > Math.min(...zs) - 10 && p.z < Math.max(...zs) + 10;
  const pieces = by.furniture.filter((f) => close(f) && !pointInRing(f, ring) && ringGap(f, ring) - f.r < AT_KERB && ringGap(f, ring) > f.r);
  const ways = by.footways.flatMap((w) => w.slice(1).map((b, i) => [w[i]!, b] as const)).filter(([a, b]) => {
    if (!close(a) && !close(b)) return false;
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25);
    const pts = Array.from({ length: n + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / (n || 1), z: a.z + ((b.z - a.z) * k) / (n || 1) }));
    return pts.every((p) => !pointInRing(p, ring)) && Math.min(...pts.map((p) => ringGap(p, ring))) < AT_KERB;
  });
  return pieces.length + ways.length;
};

/**
 * A kerb car park 15 m long or more along its street, with furniture or a footway just past its
 * outline (`AT_KERB`), holding fewer than half the cars its bays would: one every `BAY_STEP` of
 * its layout (aslant in a deep strip without the tag), `TAKEN` of them taken. The room a car
 * keeps from a meter or a footway, measured from its body and not from the kerb between them,
 * leaves the bays by them empty (G-189, Radziwiłłowska).
 */
export const bayStripsSparse = (parks: readonly Area[], cars: readonly ParkedCar[], streets: readonly Street[], by: KerbNeighbours): Finding[] =>
  parks.flatMap((park) => {
    const { length, depth } = stripOf(park.ring, streets);
    const got = cars.filter((c) => pointInRing(c, park.ring)).length;
    if (length < 15 || got === 0 || atKerb(park.ring, by) === 0) return [];
    const layout = layoutOf(park, depth);
    const step = BAY_STEP[layout === "untagged deep" ? "diagonal" : layout === "perpendicular" || layout === "diagonal" ? layout : "parallel"];
    const expected = Math.floor(length / step) * TAKEN;
    return got < expected / 2 ? [{ at: near(park.ring[0]!.x, park.ring[0]!.z), what: `${park.id} (${layout}, ${length.toFixed(1)} m): ${got} cars of ${expected.toFixed(1)}` }] : [];
  });

/**
 * A crowd lane whose walkers (each way on its own side of the line, `LANE_HALF_GAP`), sampled
 * every half metre, walk a metre or more inside a kerb car park: on its cars' strip, not the pavement.
 */
export const crowdLanesOnParking = (parks: readonly Area[], lanes: readonly CrowdLane[]): Finding[] =>
  lanes.flatMap((l) => {
    const pts = l.points.map(([x, z]) => ({ x, z }));
    const xs = pts.map((p) => p.x);
    const zs = pts.map((p) => p.z);
    const close = parks.filter((p) => p.ring.some((q) => q.x > Math.min(...xs) - 20 && q.x < Math.max(...xs) + 20 && q.z > Math.min(...zs) - 20 && q.z < Math.max(...zs) + 20));
    if (close.length === 0) return [];
    const inside = new Map<string, { n: number; at: P }>();
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-6) return;
      const [tx, tz] = [(b.x - a.x) / len, (b.z - a.z) / len];
      for (let s = 0; s < len; s += 0.5)
        for (const side of [1, -1]) {
          const q = { x: a.x + tx * s - tz * LANE_HALF_GAP * side, z: a.z + tz * s + tx * LANE_HALF_GAP * side };
          const park = close.find((p) => pointInRing(q, p.ring));
          if (park) inside.set(park.id, { n: (inside.get(park.id)?.n ?? 0) + 1, at: inside.get(park.id)?.at ?? q });
        }
    });
    return [...inside].filter(([, v]) => v.n >= 2).map(([id, v]) => ({ at: near(v.at.x, v.at.z), what: `${l.id} in ${id}: ${(v.n / 2).toFixed(1)} m` }));
  });
