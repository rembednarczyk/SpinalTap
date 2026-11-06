import { FLIGHT, type METRO_PLATFORMS, PLATFORM, PLATFORM_CAR, type PlatformDef } from "@seki/sim";
import { CAR, planCar } from "../metro-plan";
import { DRESS_FLAG, type MeshSink, type Rgba, type Vec, hexColor } from "../mesh-sink";
import { type PavilionFrame, frameBox, pavilionFrame } from "./pavilion-frame";
import { PAVILION_COLORS } from "./pavilion-bake";

/**
 * A metro platform (ADR-0071 stage 4) as one piece of geometry, from the simulation's layout
 * (`metro-platform.ts`): the second flight with its nosings and handrails, the platform's granite
 * floor with the yellow line, walls of the station's own tile colour, the dark ceiling with its
 * lit strips, the glass screen doors with their steel frames, the track with its rails running
 * into the black of the tunnel at both ends, benches, the ticket machine, and the train of two
 * cars of the ride (`metro-plan.ts`) standing at the screens. The common style of a Warsaw-type
 * station in the city's 2077 layer, not any one of them, and none of its signs. Pure, over
 * `MeshSink`, so it is tested without a scene.
 */

/** An entrance with its platform. */
export type PlatformEntrance = (typeof METRO_PLATFORMS)[number];

/** Each station's tiles: its own colour along the walls, as Warsaw's stations have theirs (not their colours). */
export const STATION_TILE: Readonly<Record<PlatformEntrance["station"], string>> = {
  shinsekai: "#3f78b5",
  kanal: "#b8902a",
  targ: "#a8473f",
  doki: "#3c9488",
};

const C = {
  ...PAVILION_COLORS,
  ceiling: hexColor("#23262d"),
  wall: hexColor("#c9ccd0"),
  bed: hexColor("#1d1f23"),
  rail: hexColor("#9aa1aa"),
  tunnel: hexColor("#050608"),
  strip: hexColor("#eef6ff", DRESS_FLAG.lit),
  screen: hexColor("#4f7488", DRESS_FLAG.wet),
  doorLamp: hexColor("#39ff8a", DRESS_FLAG.lit),
} as const;

const NOSING = 0.06;
const STRIP = 0.12;

/** A point of the frame. */
const P = (f: PavilionFrame, u: number, w: number, y: number): Vec => f.at(u, w, y);

/** A level strip painted on a floor at `y` (two triangles): a nosing, the platform's line. */
const flatStrip = (sink: MeshSink, f: PavilionFrame, u: readonly [number, number], w: readonly [number, number], y: number, color: Rgba): void => {
  sink.quad([P(f, u[0], w[0], y), P(f, u[1], w[0], y), P(f, u[1], w[1], y), P(f, u[0], w[1], y)], { x: 0, y: 1, z: 0 }, color);
};

/** The second flight: landing, steps with their nosings, the handrails on both walls. */
const planFlight = (sink: MeshSink, f: PavilionFrame, p: PlatformDef, tile: Rgba): void => {
  const half = FLIGHT.width / 2;
  const { u } = p;
  frameBox(sink, f, [u.hallEnd, u.stepsTop], [-half, half], [p.hall - 0.3, p.hall], C.stone);
  const rise = (p.hall - p.floor) / FLIGHT.steps;
  for (let i = 0; i < FLIGHT.steps; i++) {
    const u0 = u.stepsTop + i * FLIGHT.tread;
    const y = p.hall - (i + 1) * rise;
    frameBox(sink, f, [u0, u0 + FLIGHT.tread], [-half, half], [y - rise, y], C.stone);
    flatStrip(sink, f, [u0, u0 + NOSING], [-half, half], y + 0.006, C.nosing);
  }
  for (const k of [-1, 1]) {
    // The walls: tiles of the station's colour up to the rail, light over it, up to the ceiling's top.
    frameBox(sink, f, [u.hallEnd, u.back], [k * half, k * (half + 0.3)], [p.floor - 0.3, p.top], C.wall);
    frameBox(sink, f, [u.wallEnd, u.back], [k * (half - 0.01), k * half], [p.floor, p.hall + 1.1], tile);
    const a = P(f, u.stepsTop - 0.3, k * (half - 0.06), p.hall + 0.9);
    const b = P(f, u.back, k * (half - 0.06), p.floor + 0.9);
    railRod(sink, a, b);
  }
  for (const c of p.ceiling) {
    frameBox(sink, f, [c.u0, c.u1], [-half - 0.3, half + 0.3], [c.bottom, p.top], C.ceiling, true);
    frameBox(sink, f, [c.u0 + 0.2, c.u1 - 0.2], [-STRIP / 2, STRIP / 2], [c.bottom - 0.02, c.bottom], C.strip, true);
  }
};

/** A steel handrail from a to b. */
const railRod = (sink: MeshSink, a: Vec, b: Vec): void => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const flat = Math.hypot(dx, dz);
  sink.box({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }, Math.hypot(flat, dy), 0.05, 0.05, C.steel, { rotY: Math.atan2(-dz, dx), tilt: Math.atan2(dy, flat) });
};

/** The platform's hall: floor and its line, the walls round it, the ceiling with its strips, the benches and the machine. */
const planHall = (sink: MeshSink, f: PavilionFrame, p: PlatformDef, tile: Rgba): void => {
  const { u, w0, w1, floor } = p;
  const roof = floor + PLATFORM.ceiling;
  const bed = floor - PLATFORM.trackDrop;
  const half = FLIGHT.width / 2 + 0.3;
  frameBox(sink, f, [u.back, u.edge], [w0, w1], [bed, floor], C.stone);
  flatStrip(sink, f, [u.edge - 0.55, u.edge - 0.4], [w0, w1], floor + 0.006, C.nosing);
  // The back wall either side of the stairs' foot and over it: a band of tiles at eye height.
  for (const [a, b] of [
    [w0 - 0.3, -half],
    [half, w1 + 0.3],
  ] as const) {
    frameBox(sink, f, [u.back - 0.3, u.back], [a, b], [floor, roof], C.wall);
    frameBox(sink, f, [u.back, u.back + 0.01], [a, b], [floor + 0.45, floor + 2.4], tile);
  }
  frameBox(sink, f, [u.back - 0.3, u.back], [-half, half], [p.ceiling[p.ceiling.length - 1]?.bottom ?? floor + 2.3, roof], C.wall);
  for (const w of [w0 - 0.3, w1]) {
    frameBox(sink, f, [u.back - 0.3, u.edge], [w, w + 0.3], [bed, roof], C.wall);
  }
  frameBox(sink, f, [u.back - 0.3, u.track + 0.3], [w0 - PLATFORM.tunnel - 0.3, w1 + PLATFORM.tunnel + 0.3], [roof, roof + 0.3], C.ceiling, true);
  for (const k of [0.3, 0.7]) {
    const uu = u.back + (u.edge - u.back) * k;
    frameBox(sink, f, [uu - STRIP / 2, uu + STRIP / 2], [w0 + 1, w1 - 1], [roof - 0.02, roof], C.strip, true);
  }
  for (const w of p.benches) {
    frameBox(sink, f, [u.back + 0.05, u.back + 0.5], [w - 1, w + 1], [floor + 0.38, floor + 0.45], C.steel);
    for (const s of [-0.8, 0.8]) frameBox(sink, f, [u.back + 0.1, u.back + 0.45], [w + s - 0.05, w + s + 0.05], [floor, floor + 0.38], C.steel);
  }
  const m = p.machine;
  const size = p.machineSize;
  sink.box({ x: m.x, y: m.y + size.y / 2, z: m.z }, size.x, size.y, size.z, C.steel, { bottom: false });
  const mw = f.across.x !== 0 ? m.x - f.at(0, 0, 0).x : m.z - f.at(0, 0, 0).z;
  frameBox(sink, f, [u.back + 0.45, u.back + 0.47], [mw - 0.25, mw + 0.25], [floor + 1.05, floor + 1.4], hexColor("#36c5ff", DRESS_FLAG.lit));
  // The departures' board hung from the ceiling, and the plates the station's name is on.
  const b = departureBoard(p);
  frameBox(sink, f, [b.u0, b.u1], [b.w - 0.04, b.w + 0.04], [b.y0, b.y1], C.tunnel);
  for (const uu of [b.u0 + 0.2, b.u1 - 0.2]) frameBox(sink, f, [uu - 0.02, uu + 0.02], [b.w - 0.02, b.w + 0.02], [b.y1, roof], C.steel);
  for (const n of namePlates(p)) frameBox(sink, f, [u.back, u.back + 0.03], [n.w - n.width / 2, n.w + n.width / 2], [n.y - 0.3, n.y + 0.3], C.fascia);
};

/** Where the departures' board hangs (frame u, w, heights): across the platform's width, left of the stairs' foot. */
export const departureBoard = (p: PlatformDef): { readonly u0: number; readonly u1: number; readonly w: number; readonly y0: number; readonly y1: number } => ({
  u0: p.u.back + 0.8,
  u1: p.u.back + 3,
  w: -(FLIGHT.width / 2 + 2.2),
  y0: p.floor + 2.85,
  y1: p.floor + 3.55,
});

/** The plates with the station's name on the back wall, either side of the stairs' foot. */
export const namePlates = (p: PlatformDef): { readonly w: number; readonly width: number; readonly y: number }[] => {
  const half = FLIGHT.width / 2 + 0.3;
  return [
    [p.w0, -half],
    [half, p.w1],
  ].map(([a, b]) => ({ w: ((a ?? 0) + (b ?? 0)) / 2, width: Math.min(7, (b ?? 0) - (a ?? 0) - 1.5), y: p.floor + 2.85 }));
};

/** The screens along the edge with their frames, open at the doors, and the lamps over the openings. */
const planScreens = (sink: MeshSink, f: PavilionFrame, p: PlatformDef): void => {
  const { u, w0, w1, floor } = p;
  const roof = floor + PLATFORM.ceiling;
  const u0 = u.edge - 0.12;
  const u1 = u.edge - 0.02;
  const gaps = p.doors.map((d) => [d - PLATFORM_CAR.door / 2, d + PLATFORM_CAR.door / 2] as const);
  let from = w0;
  for (const [a, b] of [...gaps, [w1, w1] as const]) {
    if (a - from > 0.05) {
      frameBox(sink, f, [u0, u1], [from, a], [floor, floor + 2.2], C.screen);
      for (let w = from; w <= a + 1e-6; w += Math.max(0.6, (a - from) / Math.max(1, Math.round((a - from) / 1.6)))) frameBox(sink, f, [u0 - 0.01, u1 + 0.01], [w - 0.03, w + 0.03], [floor, floor + 2.2], C.steel);
    }
    from = b;
  }
  frameBox(sink, f, [u0 - 0.02, u1 + 0.02], [w0, w1], [floor + 2.2, roof], C.steel);
  for (const d of p.doors) frameBox(sink, f, [u0 - 0.03, u0 - 0.02], [d - 0.3, d + 0.3], [floor + 2.28, floor + 2.36], C.doorLamp);
};

/** The track bed with its two rails, the tunnel's wall, and the tunnel's mouths at both ends: black. */
const planTrack = (sink: MeshSink, f: PavilionFrame, p: PlatformDef): void => {
  const { u, w0, w1, floor } = p;
  const roof = floor + PLATFORM.ceiling;
  const bed = floor - PLATFORM.trackDrop;
  const t0 = w0 - PLATFORM.tunnel;
  const t1 = w1 + PLATFORM.tunnel;
  frameBox(sink, f, [u.edge, u.track], [t0, t1], [bed - 0.3, bed], C.bed);
  const mid = u.edge + PLATFORM_CAR.width / 2;
  for (const s of [-0.72, 0.72]) frameBox(sink, f, [mid + s - 0.04, mid + s + 0.04], [t0, t1], [bed, bed + 0.15], C.rail);
  frameBox(sink, f, [u.track, u.track + 0.3], [w0, w1], [bed, roof], C.wall);
  for (const [a, b, out] of [
    [t0, w0, t0 - 0.3],
    [w1, t1, t1],
  ] as const) {
    frameBox(sink, f, [u.track, u.track + 0.3], [a, b], [bed, roof], C.tunnel);
    frameBox(sink, f, [u.edge, u.track + 0.3], [out, out + 0.3], [bed, roof], C.tunnel);
    // The tunnel's mouth over the track: the platform's end wall reaches down to its arch.
    frameBox(sink, f, [u.edge, u.track], [a, b], [floor + 3.2, roof], C.tunnel, true);
  }
};

/** The cars of the ride (`planCar`), turned and put where the train stands. */
const planTrain = (sink: MeshSink, p: PlatformDef): void => {
  const car = planCar();
  const s = Math.sin(p.carYaw);
  const c = Math.cos(p.carYaw);
  for (const at of p.cars) {
    const base = sink.vertexCount;
    const pos = car.positions;
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i] ?? 0;
      const z = pos[i + 2] ?? 0;
      sink.positions.push(at.x + x * c + z * s, at.y + (pos[i + 1] ?? 0), at.z - x * s + z * c);
      const nx = car.normals[i] ?? 0;
      const nz = car.normals[i + 2] ?? 0;
      sink.normals.push(nx * c + nz * s, car.normals[i + 1] ?? 0, -nx * s + nz * c);
    }
    sink.colors.push(...car.colors);
    sink.uvs.push(...car.uvs);
    sink.uvs2.push(...car.uvs2);
    for (const i of car.indices) sink.indices.push(base + i);
    // The roof and the outer skin over the car's own shell: from the platform it is a train.
    const L = PLATFORM_CAR.length;
    sink.box({ x: at.x, y: at.y + CAR.height + 0.08, z: at.z }, Math.abs(c) * CAR.width + Math.abs(s) * L, 0.16, Math.abs(s) * CAR.width + Math.abs(c) * L, C.steel);
  }
};

/** The whole platform of an entrance. */
export const planPlatform = (sink: MeshSink, e: PlatformEntrance): void => {
  const f = pavilionFrame(e);
  const p = e.platform;
  const tile = hexColor(STATION_TILE[e.station]);
  planFlight(sink, f, p, tile);
  planHall(sink, f, p, tile);
  planScreens(sink, f, p);
  planTrack(sink, f, p);
  planTrain(sink, p);
};
