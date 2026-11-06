import type { Vec3 } from "@seki/core";
import type { GroundVault } from "../world/vault";
import { type BlockMaterial, type StaticProp, v } from "./builders";
/** A room of the interior (the shape of `InteriorRoom`, ADR-0061; kept here, as interior-areas.ts reads this table). */
export interface PlatformRoom {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly bottom: number;
  readonly top: number;
}
import { HALL_DEPTH, MACHINE_SIZE, PAVILION, type PavilionSpot, STAIRS, inwardYaw, pavilionStreet, spotFrame } from "./metro-pavilion";
import { groundY } from "./lublin/terrain";

/**
 * The platform under a metro entrance (ADR-0071 stage 4), in the frame of its pavilion (`u` from
 * the opening inwards, `w` across): from the hall a doorway in the end wall opens on a second
 * flight of 31 steps going on inwards under the street, down to a side platform 8 m under the
 * opening. The platform runs across the flight, its track on the far side behind glass screen
 * doors, a train of two cars standing at it, longer than the platform, with its doors at the
 * screens' openings. Benches and the ticket
 * machine stand along the back wall, the station's name over them; the track runs on into the
 * tunnel at both ends. Everything is a solid under the terrain, which stays whole over it (a
 * `GroundVault`, not a cut): nothing of it shows from the street. The renderer draws it from the
 * same layout, one mesh a platform (`renderer/metro/platform-*.ts`).
 */

/** How far under the opening the platform's floor lies (ADR-0071: "peron −8 m"). */
export const PLATFORM_DEPTH = 8;
/** The second flight: a landing behind the end wall, then its steps of 0.28 m. */
export const FLIGHT = { landing: 0.4, steps: 31, tread: 0.28, width: STAIRS.width } as const;
/** The platform across the flight, the track bed behind its edge, the tunnel's wall, the ceiling over the platform. */
export const PLATFORM = { depth: 5, track: 3.7, trackDrop: 1.1, ceiling: 4.2, tunnel: 4 } as const;
/**
 * The train standing at the platform: two of the ride's cars (ADR-0036), their length, width and
 * height, their doors' middles along each and the doors' width. It fills the platform's length,
 * so the track behind the screens is the train's all along.
 */
export const PLATFORM_CAR = { cars: 2, length: 16, width: 2.8, height: 2.35, doors: [-4.6, 4.6], door: 1.4 } as const;
/** Walls and slabs. */
const WALL = 0.3;
/** Headroom kept over the stairs of the second flight, and the least the street keeps over its ceiling. */
export const FLIGHT_HEADROOM = 2.1;
const COVER_MIN = 0.05;
/** The passage's ceiling steps down with the stairs in this many pieces. */
const CEILING_STEPS = 4;
/** The screen doors stand this far back from the edge, the car's side 2 cm behind them, so nothing fits between. */
const SCREEN = { back: 0.12, thick: 0.1 } as const;

/** The u of the layout's lines: the end wall's inner and outer faces, the steps' top and foot, the edge, the tunnel's wall. */
export interface PlatformLines {
  readonly hallEnd: number;
  readonly wallEnd: number;
  readonly stepsTop: number;
  readonly back: number;
  readonly edge: number;
  readonly track: number;
}

/** A piece of the passage's ceiling: from u0 to u1, its underside at `bottom`. */
export interface CeilingPiece {
  readonly u0: number;
  readonly u1: number;
  readonly bottom: number;
}

export interface PlatformDef {
  readonly spot: PavilionSpot;
  /** The street at the opening, the hall's floor and the platform's. */
  readonly street: number;
  readonly hall: number;
  readonly floor: number;
  readonly u: PlatformLines;
  /** The platform's ends across the flight. */
  readonly w0: number;
  readonly w1: number;
  /** The passage's ceiling, and the top of everything under the street (under the terrain everywhere over it). */
  readonly ceiling: readonly CeilingPiece[];
  readonly top: number;
  /** The doorway in the end wall: from the hall's floor up to this much over it. */
  readonly doorwayHead: number;
  /** The train's cars: the middle of each one's floor, and the yaw their length runs along (+w). */
  readonly cars: readonly Vec3[];
  readonly carYaw: number;
  readonly props: readonly StaticProp[];
  /** The ground under the street: the passage's and the platform's with its track, each hugging its walls. */
  readonly vaults: readonly GroundVault[];
  /** The passage and the platform, as rooms of the interior `metro-<station>` (ADR-0061). */
  readonly rooms: readonly PlatformRoom[];
  /** The ticket machine on the platform, by the foot of the stairs, facing the track. */
  readonly machine: Vec3;
  readonly machineSize: Vec3;
  readonly machineYaw: number;
  /** In front of the machine, facing it: where a ticket is bought. */
  readonly ticket: Vec3;
  readonly ticketYaw: number;
  /** At the car's door nearest the stairs, facing them: where a rider gets off. */
  readonly arrival: Vec3;
  readonly arrivalYaw: number;
  /** The lamps under the ceiling, the platform's two and the passage's one, for the renderer's lights. */
  readonly lamps: readonly Vec3[];
  /** The benches along the back wall: their middles along w. */
  readonly benches: readonly number[];
  /** The middles along w of the train's doors open on the platform, the screens' openings. */
  readonly doors: readonly number[];
}

/** Where the platform runs across the flight: its ends (w0 < 0 < w1). */
export interface PlatformSpan {
  readonly w0: number;
  readonly w1: number;
}

/** The lowest terrain over the frame's box u0..u1, w0..w1, sampled every 0.25 m. */
const lowestOver = (point: (u: number, w: number) => { x: number; z: number }, u0: number, u1: number, w0: number, w1: number): number => {
  let low = Infinity;
  for (let u = u0; u <= u1 + 1e-9; u += 0.25) {
    for (let w = w0; w <= w1 + 1e-9; w += 0.25) {
      const p = point(u, w);
      low = Math.min(low, groundY(p.x, p.z));
    }
  }
  return low;
};

/** The stairs' top over the point `u` of the second flight. */
const stairTopAt = (lines: PlatformLines, hall: number, floor: number, u: number): number => {
  const t = Math.max(0, Math.min(1, (u - lines.stepsTop) / (lines.back - lines.stepsTop)));
  return hall - (hall - floor) * t;
};

const linesOf = (): PlatformLines => {
  const hallEnd = PAVILION.length - 0.25;
  const wallEnd = PAVILION.length;
  const stepsTop = wallEnd + FLIGHT.landing;
  const back = stepsTop + FLIGHT.steps * FLIGHT.tread;
  const edge = back + PLATFORM.depth;
  return { hallEnd, wallEnd, stepsTop, back, edge, track: edge + PLATFORM.track };
};

/** The passage's ceiling in pieces stepping down with the stairs, under `top`. */
const ceilingOf = (lines: PlatformLines, hall: number, floor: number, top: number): CeilingPiece[] => {
  const span = (lines.back - lines.wallEnd) / CEILING_STEPS;
  return Array.from({ length: CEILING_STEPS }, (_, k) => {
    const u0 = lines.wallEnd + k * span;
    const bottom = Math.min(top - 0.15, stairTopAt(lines, hall, floor, u0) + 2.6);
    return { u0, u1: u0 + span, bottom: Math.round(bottom * 100) / 100 };
  });
};

/**
 * The platform of the entrance at `spot` (see the file's comment). The span is where it runs
 * across the flight, chosen per entrance to keep it off the buildings (ADR-0071 stage 4).
 */
export const platform = (spot: PavilionSpot, span: PlatformSpan): PlatformDef => {
  const { point, rect } = spotFrame(spot);
  const street = pavilionStreet(spot);
  const hall = street - HALL_DEPTH;
  const floor = street - PLATFORM_DEPTH;
  const u = linesOf();
  const { w0, w1 } = span;
  const half = FLIGHT.width / 2;
  const top = Math.round((lowestOver(point, u.hallEnd, u.back, -half - WALL, half + WALL) - COVER_MIN) * 100) / 100;
  const ceiling = ceilingOf(u, hall, floor, top);
  const doorwayHead = Math.round(((ceiling[0]?.bottom ?? hall + 2.3) - hall) * 100) / 100;
  const roof = floor + PLATFORM.ceiling;
  const bed = floor - PLATFORM.trackDrop;
  const t0 = w0 - PLATFORM.tunnel;
  const t1 = w1 + PLATFORM.tunnel;
  const box = (ua: number, ub: number, wa: number, wb: number, y0: number, y1: number, material: BlockMaterial = "concrete"): StaticProp => {
    const r = rect(ua, ub, wa, wb);
    return { center: v((r.minX + r.maxX) / 2, (y0 + y1) / 2, (r.minZ + r.maxZ) / 2), view: { kind: "block", size: v(r.maxX - r.minX, y1 - y0, r.maxZ - r.minZ), material }, solid: true, scenery: true };
  };
  const flight = rect(u.stepsTop, u.back, -half, half);
  const carMid = (w0 + w1) / 2;
  const carU = u.edge + PLATFORM_CAR.width / 2;
  const train = PLATFORM_CAR.cars * PLATFORM_CAR.length;
  const carMids = Array.from({ length: PLATFORM_CAR.cars }, (_, k) => carMid + (k - (PLATFORM_CAR.cars - 1) / 2) * PLATFORM_CAR.length);
  // The doors that open on the platform, clear of its end walls.
  const doors = carMids.flatMap((c) => PLATFORM_CAR.doors.map((d) => c + d)).filter((d) => d - PLATFORM_CAR.door / 2 >= w0 + WALL && d + PLATFORM_CAR.door / 2 <= w1 - WALL);
  // The screens along the edge, open at the car's doors.
  const gaps = doors.map((d) => [d - PLATFORM_CAR.door / 2, d + PLATFORM_CAR.door / 2] as const);
  const screens: [number, number][] = [];
  let from = w0;
  for (const [a, b] of gaps) {
    screens.push([from, a]);
    from = b;
  }
  screens.push([from, w1]);
  const benches = [w0 + 3, -5.5, 5.5, w1 - 3].filter((w) => w - 1 > w0 + 0.5 && w + 1 < w1 - 0.5 && Math.abs(w) > 3.5);
  const sideWalls = [-1, 1].map((s) => box(u.hallEnd, u.back, s * half, s * (half + WALL), floor - WALL, top));
  const props: StaticProp[] = [
    // Behind the end wall's doorway: the landing, then the second flight down to the platform.
    box(u.wallEnd, u.stepsTop, -half, half, hall - WALL, hall),
    {
      center: v((flight.minX + flight.maxX) / 2, (floor + hall) / 2, (flight.minZ + flight.maxZ) / 2),
      view: { kind: "block", size: v(flight.maxX - flight.minX, hall - floor, flight.maxZ - flight.minZ), material: "concrete", slope: { axis: spot.along, dir: spot.opens, low: 0, steps: FLIGHT.steps } },
      solid: true,
      scenery: true,
    },
    ...sideWalls,
    ...ceiling.map((c) => box(c.u0, c.u1, -half - WALL, half + WALL, c.bottom, top)),
    // The platform, down to the track bed at its edge, and the bed.
    box(u.back, u.edge, w0, w1, bed, floor),
    box(u.edge, u.track, t0, t1, bed - WALL, bed),
    // The back wall either side of the stairs' foot and over it, the ends, the tunnel's wall, the ceiling.
    box(u.back - WALL, u.back, w0 - WALL, -half - WALL, floor - WALL, roof),
    box(u.back - WALL, u.back, half + WALL, w1 + WALL, floor - WALL, roof),
    box(u.back - WALL, u.back, -half - WALL, half + WALL, ceiling[ceiling.length - 1]?.bottom ?? floor + 2.3, roof),
    ...[w0 - WALL, w1].map((w) => box(u.back - WALL, u.edge, w, w + WALL, bed, roof)),
    ...[t0 - WALL, t1].map((w) => box(u.edge, u.track + WALL, w, w + WALL, bed - WALL, roof)),
    box(u.track, u.track + WALL, t0, t1, bed - WALL, roof),
    box(u.back - WALL, u.track + WALL, t0 - WALL, t1 + WALL, roof, roof + WALL),
    // The glass screen doors along the edge, the car behind them.
    ...screens.filter(([a, b]) => b - a > 0.05).map(([a, b]) => box(u.edge - SCREEN.back, u.edge - SCREEN.back + SCREEN.thick, a, b, floor, roof, "glass")),
    box(u.edge, u.edge + PLATFORM_CAR.width, carMid - train / 2, carMid + train / 2, floor, floor + PLATFORM_CAR.height + 0.2, "metal"),
    // Benches along the back wall.
    ...benches.map((w) => box(u.back, u.back + 0.5, w - 1, w + 1, floor, floor + 0.45, "metal")),
  ];
  const mw = half + 0.5 + MACHINE_SIZE.x / 2;
  const m = point(u.back + MACHINE_SIZE.z / 2, mw);
  const machineSize = spot.along === "x" ? v(MACHINE_SIZE.z, MACHINE_SIZE.y, MACHINE_SIZE.x) : MACHINE_SIZE;
  const t = point(u.back + 1.1, mw);
  const nearest = doors.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a));
  const off = point(u.edge - 0.9, nearest);
  const deep = bed - WALL - 0.2;
  const room = (ua: number, ub: number, wa: number, wb: number, bottom: number, roomTop: number): PlatformRoom => ({ ...rect(ua, ub, wa, wb), bottom, top: roomTop });

  return {
    spot,
    street,
    hall,
    floor,
    u,
    w0,
    w1,
    ceiling,
    top,
    doorwayHead,
    cars: carMids.map((c) => {
      const q = point(carU, c);
      return v(q.x, floor, q.z);
    }),
    // Along +w: +z where w is z, +x where it is x (yaw 0 faces +Z).
    carYaw: spot.along === "x" ? 0 : Math.PI / 2,
    props,
    vaults: [
      { bounds: rect(u.hallEnd, u.back - WALL, -half - WALL, half + WALL), floor: deep },
      { bounds: rect(u.back - WALL, u.track + WALL, t0 - WALL, t1 + WALL), floor: deep },
    ],
    // Up to the screens' face: the rooms' sides are walls.
    rooms: [room(u.hallEnd, u.back, -half, half, floor, hall + doorwayHead), room(u.back, u.edge - SCREEN.back, w0, w1, floor, roof)],
    machine: v(m.x, floor, m.z),
    machineSize,
    machineYaw: inwardYaw(spot, 1),
    ticket: v(t.x, floor, t.z),
    ticketYaw: inwardYaw(spot, -1),
    arrival: v(off.x, floor, off.z),
    arrivalYaw: inwardYaw(spot, -1),
    lamps: [
      ...[w0 + (w1 - w0) / 4, w0 + (3 * (w1 - w0)) / 4].map((w) => {
        const p = point((u.back + u.edge) / 2, w);
        return v(p.x, roof - 0.4, p.z);
      }),
      // Halfway down the second flight, under its ceiling.
      (() => {
        const mid = (u.stepsTop + u.back) / 2;
        const p = point(mid, 0);
        return v(p.x, stairTopAt(u, hall, floor, mid) + 1.9, p.z);
      })(),
    ],
    benches,
    doors,
  };
};

