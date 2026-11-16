import type { LineScreens } from "@seki/core";
import { W3_CRANE_BRIDGE, W3_LAYOUT, W3_Y } from "@seki/sim";

/**
 * The assembly line's motion (ADR-0082 §3.8, stage 2b): the eight arms over belts L1 and L2, the
 * drones' bodies riding the belts, the crane's bridge along its tracks and the arms' beacons. A
 * pure function of the renderer's clock and a seed, so the same time draws the same frame; the
 * simulation does not know any of it (the bodies, arms and bridge are no solids).
 */

/** The line's own seed: the arms' phases and the bodies' spacing come from it. */
export const W3_LINE_SEED = 0x3e5c;

/** One arm over a belt: where its base stands and how it is bent. */
export interface ArmPose {
  /** The base's middle on the floor (world x, z). */
  readonly x: number;
  readonly z: number;
  /** +1 for L1's arms (south of the belt, reaching north), -1 for L2's. */
  readonly side: 1 | -1;
  /** Turn about the vertical from facing its belt (rad). */
  readonly yaw: number;
  /** The upper arm's lift from the horizontal and the forearm's bend under it (rad). */
  readonly shoulder: number;
  readonly elbow: number;
  /** Its beacon lit (amber, on the base's corner). */
  readonly beacon: boolean;
}

/** What the job has done to the line (ADR-0082 stage 3): the alarm on its beacons, its screens. */
export interface LineMission {
  readonly alarm: boolean;
  readonly screens: LineScreens;
}

export const LINE_IDLE: LineMission = { alarm: false, screens: "idle" };

export interface LinePose {
  readonly arms: readonly ArmPose[];
  /** The beacons red (the lockdown), else amber. */
  readonly alarm: boolean;
  /** The screens' state and whether its blink is on now (lit steadily when still). */
  readonly screens: LineScreens;
  readonly screenBlink: boolean;
  /** The bodies on the belts: world x, z of their middle, the belt's top under them. */
  readonly bodies: readonly { readonly x: number; readonly z: number }[];
  /** The crane's bridge: world x of its middle. */
  readonly bridgeX: number;
}

/** A small deterministic generator (mulberry32) of numbers in [0, 1). */
export const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** One arm's working cycle (s): reach over the belt, weld, swing back. */
const ARM_CYCLE = 6.5;
/** The belts' speed (m/s) and the bodies on each. */
const BELT_SPEED = 0.45;
const BODIES_PER_BELT = 3;
/** The crane's bridge goes from end to end and back in this many seconds. */
const BRIDGE_CYCLE = 96;
/** The arms' beacons blink at this rate (Hz) while they move. */
const BEACON_RATE = 1.2;
/** In the alarm they blink faster, and the screens of an upload or a virus at this rate. */
const ALARM_RATE = 2.5;
const SCREEN_RATE = 1.7;

const TAU = Math.PI * 2;
const frac = (x: number): number => x - Math.floor(x);

/** The arms' bases on the floor: L1's south of it, L2's north (the sim's boxes, `hall-inside.ts`). */
const armBases = (): { x: number; z: number; side: 1 | -1 }[] => {
  const s = W3_LAYOUT.ARM_BASE.size;
  const l1 = W3_LAYOUT.BELT_L1.minZ - 0.1 - s / 2;
  const l2 = W3_LAYOUT.BELT_L2.maxZ + 0.1 + s / 2;
  return [...W3_LAYOUT.ARMS_X.map((x) => ({ x, z: l1, side: 1 as const })), ...W3_LAYOUT.ARMS_X.map((x) => ({ x, z: l2, side: -1 as const }))];
};

/** The line at time `t` (s on the renderer's clock). `still` keeps the arms at rest (phones, low quality). */
export const linePose = (t: number, seed = W3_LINE_SEED, still = false, mission: LineMission = LINE_IDLE): LinePose => {
  const rnd = seeded(seed);
  const time = still ? 0 : t;
  // Still (low quality), the alarm's beacons burn steadily: the lockdown must show.
  const beaconOn = (beat: number): boolean => (mission.alarm ? still || frac(t * ALARM_RATE + beat) < 0.5 : !still && frac(time * BEACON_RATE + beat) < 0.5);
  const arms = armBases().map((b): ArmPose => {
    const phase = rnd();
    const beat = rnd();
    const p = frac(time / ARM_CYCLE + phase);
    // Reach out over the belt and back, with a hold at the weld in the middle of the cycle.
    const reach = still ? 0.35 : 0.5 - 0.5 * Math.cos(TAU * p);
    return {
      x: b.x,
      z: b.z,
      side: b.side,
      yaw: still ? 0 : 0.55 * Math.sin(TAU * p + beat * TAU),
      shoulder: 0.25 + 0.55 * reach,
      elbow: 1.35 - 0.7 * reach,
      beacon: beaconOn(beat),
    };
  });
  const span = W3_LAYOUT.BELT_X.maxX - W3_LAYOUT.BELT_X.minX - 1.4;
  const belts = [W3_LAYOUT.BELT_L1, W3_LAYOUT.BELT_L2];
  const bodies = belts.flatMap((belt, i) => {
    const start = rnd() * span;
    const z = (belt.minZ + belt.maxZ) / 2;
    // L1 runs east, L2 back west (picture 02's loop).
    const dir = i === 0 ? 1 : -1;
    return Array.from({ length: BODIES_PER_BELT }, (_, k) => {
      const along = frac((start + (k * span) / BODIES_PER_BELT + dir * BELT_SPEED * time) / span) * span;
      return { x: W3_LAYOUT.BELT_X.minX + 0.7 + along, z };
    });
  });
  const b = W3_CRANE_BRIDGE;
  const bridgePhase = rnd();
  const bridgeX = still ? b.x : (b.minX + b.maxX) / 2 + ((b.maxX - b.minX) / 2) * Math.sin(TAU * (time / BRIDGE_CYCLE + bridgePhase));
  const screenBlink = still || mission.screens === "idle" || frac(t * SCREEN_RATE) < 0.5;
  return { arms, alarm: mission.alarm, screens: mission.screens, screenBlink, bodies, bridgeX };

};

/** World y of the halls' floor, for the geometry. */
export const LINE_FLOOR = W3_Y;
