import type { ActivityId } from "@seki/core";
import { SIGN_COLORS, prng } from "./city-kit-data";
import { DRESS_FLAG, MeshSink, type Rgba, type Vec, hexColor } from "./mesh-sink";

/**
 * The metro car of wave 2 (ADR-0036) as plain geometry: a commuter car with long benches under
 * the windows, poles by the doors, straps on overhead bars, lit ceiling strips and ad screens,
 * and outside the windows three layers of the night city that slide past. Pure functions over
 * `MeshSink`, so the plan is tested without a scene. Local frame: floor centre at the origin,
 * x across the car, z along it (the train runs towards +z).
 */

export const CAR = { length: 16, width: 2.8, height: 2.35, windowSill: 0.85, windowTop: 1.75 } as const;

const C = (hex: string, flag: number = DRESS_FLAG.solid): Rgba => hexColor(hex, flag);

const PAINT = {
  floor: "#2c303a",
  ceiling: "#c3c8cf",
  wallLow: "#8e98a4",
  wallHigh: "#b3bbc4",
  frame: "#3a3f48",
  seat: "#355d8c",
  seatBase: "#1f232a",
  metal: "#d3d8de",
  strap: "#e9e4d2",
  door: "#7d8590",
  light: "#eef6ff",
  ledLine: "#ffb000",
} as const;

/** Along-car spans: windows, doors and the narrow pillars between them. */
export interface Bay {
  readonly kind: "window" | "door" | "pillar";
  readonly z0: number;
  readonly z1: number;
}

/** One side of the car from the back end to the front: two doors, three window bays. */
export const CAR_BAYS: readonly Bay[] = [
  { kind: "pillar", z0: -8, z1: -7.4 },
  { kind: "window", z0: -7.4, z1: -5.3 },
  { kind: "door", z0: -5.3, z1: -3.9 },
  { kind: "window", z0: -3.9, z1: -0.08 },
  { kind: "pillar", z0: -0.08, z1: 0.08 },
  { kind: "window", z0: 0.08, z1: 3.9 },
  { kind: "door", z0: 3.9, z1: 5.3 },
  { kind: "window", z0: 5.3, z1: 7.4 },
  { kind: "pillar", z0: 7.4, z1: 8 },
];

const box = (sink: MeshSink, c: Vec, w: number, h: number, d: number, color: Rgba): void => sink.box(c, w, h, d, color);

/** Wall of one side (s = ±1): sill wall, header, pillars, frames, doors, ad screens. */
const planSide = (sink: MeshSink, s: number, ads: () => Rgba): void => {
  const x = s * (CAR.width / 2);
  const t = 0.06;
  for (const b of CAR_BAYS) {
    const len = b.z1 - b.z0;
    const zc = (b.z0 + b.z1) / 2;
    if (b.kind === "pillar") {
      box(sink, { x, y: CAR.height / 2, z: zc }, t, CAR.height, len, C(PAINT.wallHigh));
      continue;
    }
    // Header over every bay; the sill wall under windows; a door panel with its own small window.
    box(sink, { x, y: (CAR.windowTop + CAR.height) / 2, z: zc }, t, CAR.height - CAR.windowTop, len, C(PAINT.wallHigh));
    if (b.kind === "window") {
      box(sink, { x, y: CAR.windowSill / 2, z: zc }, t, CAR.windowSill, len, C(PAINT.wallLow));
      // Frame: sill and lintel rails, thin and dark.
      for (const y of [CAR.windowSill, CAR.windowTop]) box(sink, { x: x - s * 0.04, y, z: zc }, 0.05, 0.05, len, C(PAINT.frame));
      // Ad screens over the window, facing in; the picture is a few bands of lit colour.
      const n = Math.max(1, Math.floor(len / 1.3));
      for (let i = 0; i < n; i++) {
        const z = b.z0 + (len / n) * (i + 0.5);
        box(sink, { x: x - s * 0.045, y: 2.02, z }, 0.02, 0.34, 0.92, C("#101318"));
        for (let k = 0; k < 3; k++) box(sink, { x: x - s * 0.057, y: 1.9 + k * 0.1, z: z + (k - 1) * 0.08 }, 0.01, 0.07, 0.62 - k * 0.12, ads());
      }
    } else {
      for (const dz of [-1, 1]) {
        const half = { x: x - s * 0.02, z: zc + (dz * len) / 4 };
        box(sink, { ...half, y: 0.5 }, 0.05, 1, len / 2 - 0.02, C(PAINT.door));
        box(sink, { ...half, y: (CAR.windowTop + 1.2) / 2 + 0.3 }, 0.05, 0.25, len / 2 - 0.02, C(PAINT.door));
        for (const zz of [half.z - len / 4 + 0.05, half.z + len / 4 - 0.05]) box(sink, { x: half.x, y: 1.5, z: zz }, 0.05, 0.6, 0.1, C(PAINT.door));
      }
      // The LED line over the door.
      box(sink, { x: x - s * 0.05, y: 1.95, z: zc }, 0.02, 0.06, 0.7, C(PAINT.ledLine, DRESS_FLAG.lit));
      // Poles at both door edges, floor to ceiling.
      for (const z of [b.z0 - 0.1, b.z1 + 0.1]) sink.prism({ x: s * 1.08, y: 0, z }, 0.022, CAR.height, 8, C(PAINT.metal), false);
    }
  }
};

/** Long benches under each window run, with their base and back cushion. */
const planBenches = (sink: MeshSink, s: number): void => {
  for (const b of CAR_BAYS) {
    if (b.kind !== "window") continue;
    const len = b.z1 - b.z0 - 0.1;
    const zc = (b.z0 + b.z1) / 2;
    box(sink, { x: s * 1.13, y: 0.22, z: zc }, 0.4, 0.44, len, C(PAINT.seatBase));
    box(sink, { x: s * 1.1, y: 0.47, z: zc }, 0.5, 0.1, len, C(PAINT.seat));
    box(sink, { x: s * 1.33, y: 0.72, z: zc }, 0.09, 0.42, len, C(PAINT.seat));
  }
};

/** Overhead bars along the car with straps every 60 cm, ceiling light strips, the end walls. */
const planCeiling = (sink: MeshSink): void => {
  box(sink, { x: 0, y: -0.05, z: 0 }, CAR.width, 0.1, CAR.length, C(PAINT.floor));
  box(sink, { x: 0, y: CAR.height + 0.04, z: 0 }, CAR.width, 0.08, CAR.length, C(PAINT.ceiling));
  for (const s of [-1, 1]) {
    box(sink, { x: s * 0.5, y: CAR.height - 0.02, z: 0 }, 0.16, 0.03, CAR.length - 1, C(PAINT.light, DRESS_FLAG.lit));
    box(sink, { x: s * 0.78, y: 1.97, z: 0 }, 0.03, 0.03, CAR.length - 1.2, C(PAINT.metal));
    for (let z = -7.2; z <= 7.2; z += 0.6) {
      box(sink, { x: s * 0.78, y: 1.86, z }, 0.015, 0.2, 0.025, C(PAINT.strap));
      box(sink, { x: s * 0.78, y: 1.73, z }, 0.02, 0.09, 0.11, C(PAINT.strap));
    }
  }
  for (const s of [-1, 1]) {
    // End wall with the gangway door; its window shows only the dark next car.
    const z = s * (CAR.length / 2);
    for (const x of [-0.95, 0.95]) box(sink, { x, y: CAR.height / 2, z }, 0.9, CAR.height, 0.06, C(PAINT.wallHigh));
    box(sink, { x: 0, y: 0.6, z }, 1, 1.2, 0.06, C(PAINT.door));
    box(sink, { x: 0, y: 2.05, z }, 1, 0.6, 0.06, C(PAINT.wallHigh));
    box(sink, { x: 0, y: 1.5, z: z + s * 0.05 }, 0.8, 0.6, 0.02, C("#0b0d12"));
  }
};

/** The car interior, one sink (one draw call). */
export const planCar = (seed = 0x3e7c0): MeshSink => {
  const sink = new MeshSink();
  const rand = prng(seed);
  const ads = () => C(SIGN_COLORS[Math.floor(rand() * SIGN_COLORS.length)] ?? "#ff2e88", DRESS_FLAG.lit);
  planCeiling(sink);
  for (const s of [-1, 1]) {
    planSide(sink, s, ads);
    planBenches(sink, s);
  }
  return sink;
};

// ------------------------------------------------------------------------------- Parallax

export type LayerKind = "near" | "mid" | "far";

/** Distance from the track (both sides) and how long one repeat of the layer is. */
export const LAYERS: Readonly<Record<LayerKind, { readonly distance: number; readonly period: number }>> = {
  // Pillars of the elevated track and the neon right beside it: they rush past.
  near: { distance: 6, period: 36 },
  // Blocks across the street, lit windows and signs.
  mid: { distance: 26, period: 96 },
  // Towers on the horizon, crawling.
  far: { distance: 85, period: 300 },
};

/** Train speed in m/s (about 55 km/h, an elevated city line). */
export const TRAIN_SPEED = 15;

/**
 * Shift of a layer along the track at `time`: everything outside moves back at the train's
 * speed (true parallax, so far layers crawl on screen by themselves), wrapped to a period and
 * centred, so the three copies of the layer always cover ±period around the car.
 */
export const parallaxOffset = (time: number, speed: number, period: number): number => {
  const travelled = (((time * speed) % period) + period) % period;
  return period / 2 - travelled;
};

const tower = (sink: MeshSink, x: number, z: number, w: number, h: number, d: number, body: string, rand: () => number, lit: number): void => {
  // The body glows faintly (city light on the haze), so the silhouette reads against the night.
  sink.box({ x, y: h / 2 - 2, z }, w, h, d, C(body, DRESS_FLAG.lit));
  // A red roof line along the face towards the track (aircraft warning lights).
  const edge = x > 0 ? x - w / 2 - 0.05 : x + w / 2 + 0.05;
  sink.box({ x: edge, y: h - 2.1, z }, 0.1, 0.12, d * 0.9, C("#ff4f6a", DRESS_FLAG.lit));
  // Rows of lit windows on the face towards the track: thin lit bars, some dark.
  const face = x > 0 ? x - w / 2 - 0.02 : x + w / 2 + 0.02;
  for (let y = 1; y < h - 3; y += 2.4 + rand() * 0.8) {
    if (rand() > lit) continue;
    const warm = rand() < 0.75;
    sink.box({ x: face, y: y - 2, z: z + (rand() - 0.5) * w * 0.2 }, 0.04, 0.5, d * (0.4 + rand() * 0.45), C(warm ? "#ffb978" : "#7fe8ff", DRESS_FLAG.lit));
  }
};

const neonSign = (sink: MeshSink, x: number, y: number, z: number, rand: () => number): void => {
  const color = SIGN_COLORS[Math.floor(rand() * SIGN_COLORS.length)] ?? "#ff2e88";
  const vertical = rand() < 0.5;
  sink.box({ x, y, z }, 0.15, vertical ? 3 + rand() * 3 : 0.9, vertical ? 0.8 : 3 + rand() * 2, C(color, DRESS_FLAG.lit));
};

/** One copy of a layer on both sides of the track, spanning [-period/2, period/2). */
const planLayerCopy = (sink: MeshSink, kind: LayerKind, z0: number, seed: number): void => {
  const { distance, period } = LAYERS[kind];
  const rand = prng(seed);
  for (const s of [-1, 1]) {
    const x = s * distance;
    if (kind === "near") {
      for (let z = -period / 2; z < period / 2; z += 9) {
        sink.box({ x, y: -2, z: z0 + z }, 0.8, 8, 0.8, C("#3b404a"));
        if (rand() < 0.45) neonSign(sink, x - s * 0.5, 1.5 + rand() * 2.5, z0 + z + 4.5, rand);
      }
      continue;
    }
    const far = kind === "far";
    for (let z = -period / 2; z < period / 2; ) {
      const w = far ? 10 + rand() * 16 : 7 + rand() * 7;
      // Low enough that the sky shows over the roofs through the windows.
      const h = far ? 14 + rand() * 36 : 6 + rand() * 9;
      tower(sink, x + s * w * 0.4, z0 + z + w / 2, w, h, w * (0.8 + rand() * 0.4), far ? "#221f3a" : "#2b2c45", rand, far ? 0.45 : 0.6);
      if (rand() < (far ? 0.25 : 0.7)) neonSign(sink, x - s * 0.15, far ? h * 0.6 : 2 + rand() * 4, z0 + z + w / 2, rand);
      z += w + (far ? 4 : 1.5) + rand() * (far ? 14 : 3);
    }
  }
};

/** A parallax layer as three copies (behind, around and ahead of the car), so a wrap never shows. */
export const planLayer = (kind: LayerKind, seed = 0x9a7a): MeshSink => {
  const sink = new MeshSink();
  const { period } = LAYERS[kind];
  // The same seed for every copy: the pattern repeats exactly, so the wrap is seamless.
  for (const k of [-1, 0, 1]) planLayerCopy(sink, kind, k * period, seed + kind.length);
  return sink;
};

// ------------------------------------------------------------------------------ Camera

/** Eye of the rider: seated on the left bench, looking across to the windows on the right. */
export const RIDER_EYE = { x: -0.95, y: 1.2, z: -1.1 } as const;
export const RIDER_LOOK = { x: 1.4, y: 1.25, z: 1.6 } as const;

/**
 * Gentle sway of the car at `time`: a slow roll, a vertical shudder from the rail joints every
 * 25 m (at the train's speed) and a little lateral drift. Metres and radians; small enough not
 * to make anyone sick, and zero with `calm` (reduced motion).
 */
export const carSway = (time: number, calm = false): { dx: number; dy: number; roll: number } => {
  if (calm) return { dx: 0, dy: 0, roll: 0 };
  const joint = (time * TRAIN_SPEED) / 25;
  const bump = Math.exp(-((joint % 1) * 14)) * 0.006;
  return {
    dx: Math.sin(time * 0.9) * 0.012 + Math.sin(time * 2.3 + 1) * 0.004,
    dy: Math.sin(time * 1.7) * 0.004 - bump,
    roll: Math.sin(time * 0.7) * 0.006 + Math.sin(time * 1.9 + 0.5) * 0.002,
  };
};

/** Fellow riders: where they stand or sit and which preset they wear. */
export interface Rider {
  readonly preset: "civilian" | "fixer" | "ripperdoc" | "ganger" | "corpo";
  readonly at: Vec;
  readonly yaw: number;
  /** What the rider does on the way (ADR-0040). */
  readonly activity?: ActivityId;
}

/** Up to four riders, always in view of the seat: by the far door, on the bench opposite, in the aisle. */
export const RIDERS: readonly Rider[] = [
  { preset: "civilian", at: { x: 0.95, y: 0, z: 4.5 }, yaw: -Math.PI / 2, activity: "sit" },
  { preset: "corpo", at: { x: 0.35, y: 0, z: 2.6 }, yaw: Math.PI * 0.9, activity: "phone" },
  { preset: "ganger", at: { x: -0.3, y: 0, z: 5.4 }, yaw: Math.PI, activity: "idle" },
  { preset: "fixer", at: { x: 0.9, y: 0, z: -4.6 }, yaw: -Math.PI / 2, activity: "sleep" },
];

/** How many riders a ride gets: two to four, picked from the trip so it stays the same each time. */
export const ridersFor = (from: string, to: string): readonly Rider[] => {
  let h = 7;
  for (const ch of `${from}>${to}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return RIDERS.slice(0, 2 + (h % 3));
};
