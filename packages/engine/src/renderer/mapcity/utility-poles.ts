import { MAP_CHUNKS, chunkAt, inBuilding } from "@seki/sim";
import type { KitModel } from "../city-kit-data";
import { type CityProps, type PropXform, addPropToSink, facing, transformProp } from "../city-props";
import { MeshSink, type Vec, hexColor } from "../mesh-sink";
import { cable } from "./canyon-plan";
import { type WorldProp, placePoint } from "./prop-batch";
import { glow, paint, v3 } from "./prop-kit";
import type { PropLight } from "./prop-lamps";

/**
 * Utility poles over the side streets of Podzamcze and Nabrzeże (ADR-0063): a road lamp there whose
 * nearest street is a side street in OSM (`residential`, `living_street`, `service`...) is drawn
 * as the CC-BY electric pole of `city-props.glb` (`pr-pole`, its own lamp included) and strung to
 * its nearest pole with sagging cables. The main roads (Aleja Tysiąclecia, Ruska, Mełgiewska) keep
 * their lamps, and so do the Rynek and the Old Town (ADR-0058). The pole stands where the lamp's
 * solid already is (ADR-0050), so the simulation does not change. Baked into the street furniture's
 * block mesh: vertices, not draw calls. Pure functions of the pieces and the map.
 */

/** Districts whose side streets get the poles. */
const POLE_DISTRICTS: ReadonlySet<string> = new Set(["targ", "doki"]);
/** OSM `highway` values of side streets. */
const SIDE_STREETS: ReadonlySet<string> = new Set(["residential", "living_street", "unclassified", "service", "pedestrian"]);
/** A lamp further than this from every street lights none of them, metres. */
const STREET_REACH = 25;
/** Longest cable between two poles, metres. */
export const CABLE_SPAN = 45;
/** Heights of the pole's two crossarms and the reach of their ends (pole frame, metres). */
const ARMS = [7.75, 5.75] as const;
const ARM_X = 1.3;

/** The pole's lamp: warm white under its hood, a pool on the pavement. */
const POLE_LIGHT = { color: "#ffd9a8", size: 2.2, pool: true } as const;

const CABLE = hexColor("#141519");

interface Segment {
  readonly ax: number;
  readonly az: number;
  readonly bx: number;
  readonly bz: number;
  readonly kind: string;
}

let segments: readonly Segment[] | null = null;

/** The street segments of the poles' districts (worked out once). */
const streetSegments = (): readonly Segment[] => {
  if (segments) return segments;
  const out: Segment[] = [];
  for (const c of MAP_CHUNKS) {
    if (!POLE_DISTRICTS.has(c.district)) continue;
    for (const s of c.streets) {
      for (let i = 0; i + 3 < s.line.length; i += 2) out.push({ ax: s.line[i] ?? 0, az: s.line[i + 1] ?? 0, bx: s.line[i + 2] ?? 0, bz: s.line[i + 3] ?? 0, kind: s.kind });
    }
  }
  segments = out;
  return out;
};

const toSegment = (x: number, z: number, s: Segment): number => {
  const dx = s.bx - s.ax;
  const dz = s.bz - s.az;
  const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - s.ax - dx * t, z - s.az - dz * t);
};

/** The OSM kind of the street nearest to (x, z) within `STREET_REACH` (in the poles' districts), or null. */
export const streetKindAt = (x: number, z: number): string | null => {
  let best = STREET_REACH;
  let kind: string | null = null;
  for (const s of streetSegments()) {
    const d = toSegment(x, z, s);
    if (d < best) {
      best = d;
      kind = s.kind;
    }
  }
  return kind;
};

/** Is this road lamp one of the poles: Podzamcze or Nabrzeże, by a side street. */
export const isPoleLamp = (p: WorldProp): boolean => {
  if (p.prop !== "lamp-road") return false;
  const district = chunkAt(p.x, p.z)?.district;
  if (district === undefined || !POLE_DISTRICTS.has(district)) return false;
  const kind = streetKindAt(p.x, p.z);
  return kind !== null && SIDE_STREETS.has(kind);
};

/** The pole's model of the props file, or null (not loaded, or a file without it). */
export const poleModel = (props: CityProps | null): KitModel | null => props?.byStyle.get("pole")?.[0] ?? null;

/** Where the pole goes: its mast on the lamp's foot, its lamp arm (the model's front) along the lamp's. */
export const poleXform = (p: WorldProp): PropXform => facing({ x: p.x, y: p.y, z: p.z }, { x: Math.sin(p.yaw), y: 0, z: Math.cos(p.yaw) }, { x: 1, y: 1, z: 1 });

/**
 * The pole's lights in the lamp's frame (front +z): the model's front is its -z, so the frame is
 * the model's turned half round.
 */
export const poleLights = (m: KitModel): PropLight[] => (m.lights ?? []).map((l) => ({ at: { x: -l.x, y: l.y, z: -l.z }, ...POLE_LIGHT }));

/**
 * Does the whole pole stand clear of the buildings: no vertex of the model at this lamp inside an
 * outline of the map (a lamp a few decimetres from a wall would push the crossarm and the lamp's
 * hood into the facade)? A lamp whose pole does not fit stays a lamp.
 */
export const poleFits = (m: KitModel, p: WorldProp): boolean => {
  const { positions } = transformProp(m, poleXform(p));
  for (let i = 0; i < positions.length; i += 3) if (inBuilding(positions[i] ?? 0, positions[i + 2] ?? 0)) return false;
  return true;
};

/** How far the pole's crossarms reach from its mast, for the awnings to keep clear (metres). */
export const POLE_REACH = 1.7;

/**
 * The pole in the far mesh: its mast, the upper crossarm and a lit box where its lamp is, so the
 * far pole's light sits where its halo does.
 */
export const farPole = (m: KitModel): MeshSink => {
  const sink = new MeshSink();
  const dark = paint("#1c1e22");
  sink.box(v3(0, m.size.y / 2 - 0.1, 0), 0.22, m.size.y + 0.2, 0.22, dark, { bottom: false });
  sink.box(v3(0, ARMS[0], 0), ARM_X * 2 + 0.3, 0.12, 0.12, dark);
  for (const l of poleLights(m)) {
    sink.box(v3(l.at.x / 2, l.at.y + 0.2, l.at.z / 2), Math.abs(l.at.x) + 0.08, 0.08, Math.abs(l.at.z) + 0.08, dark);
    sink.box(v3(l.at.x, l.at.y, l.at.z), 0.32, 0.3, 0.32, glow(POLE_LIGHT.color));
  }
  return sink;
};

/** Is the straight line between two points clear of the map's buildings (sampled every 2 m)? */
const clearLine = (a: Vec, b: Vec): boolean => {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
  for (let i = 1; i < n; i++) if (inBuilding(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
  return true;
};

/**
 * Pairs of poles strung together: each pole to its nearest pole within `CABLE_SPAN` whose line is
 * clear of buildings, each pair once, in the order of the list.
 */
export const polePairs = (poles: readonly WorldProp[]): [WorldProp, WorldProp][] => {
  const seen = new Set<string>();
  const out: [WorldProp, WorldProp][] = [];
  poles.forEach((a, i) => {
    let best = -1;
    let bestD = CABLE_SPAN;
    poles.forEach((b, j) => {
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (j !== i && d > 1 && d < bestD && clearLine(a, b)) {
        best = j;
        bestD = d;
      }
    });
    if (best < 0) return;
    const key = i < best ? `${i}:${best}` : `${best}:${i}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([a, poles[best] as WorldProp]);
  });
  return out;
};

/**
 * Four cables from one pole to the other: the ends of each crossarm to the ends of the same
 * crossarm, paired by their offset across the line between the masts (so they do not cross).
 */
export const poleCables = (a: WorldProp, b: WorldProp): [Vec, Vec][] => {
  const ux = b.x - a.x;
  const uz = b.z - a.z;
  const across = (p: Vec, o: WorldProp) => ux * (p.z - o.z) - uz * (p.x - o.x);
  const ends = (o: WorldProp, y: number): Vec[] => [placePoint(o, { x: -ARM_X, y, z: 0 }), placePoint(o, { x: ARM_X, y, z: 0 })].sort((p, q) => across(p, o) - across(q, o));
  return ARMS.flatMap((y): [Vec, Vec][] => {
    const [a0, a1] = ends(a, y) as [Vec, Vec];
    const [b0, b1] = ends(b, y) as [Vec, Vec];
    return [
      [a0, b0],
      [a1, b1],
    ];
  });
};

/** Bakes the poles of a block and the cables between them. */
export const bakePoles = (sink: MeshSink, props: CityProps, model: KitModel, poles: readonly WorldProp[]): void => {
  for (const p of poles) addPropToSink(sink, props, model, poleXform(p));
  for (const [a, b] of polePairs(poles)) {
    const span = Math.hypot(b.x - a.x, b.z - a.z);
    for (const [p, q] of poleCables(a, b)) cable(sink, p, q, 0.25 + 0.03 * span, CABLE, 0.035);
  }
};
