import { MAX_LAMP_STREAKS, STREAK_REACH } from "../../npr/lamp-streaks";
import type { RenderQuality } from "../../npr/quality";
import type { ToonWetGround } from "../../npr/toon-wet-ground";

/** A lamp whose light the wet street mirrors (ADR-0084): where its light hangs, its colour and own seed. */
export interface StreakLamp {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly color: readonly [number, number, number];
  readonly seed: number;
}

/** Brightness of a streak's steps over its lamp's colour. */
const GAIN = 0.42;
/** The eye moves this far (m) before the lamps are picked again. */
const REPICK = 1.5;

/**
 * The lamps whose streaks the ground draws: the nearest within reach, those behind the eye last
 * (their streaks lie behind it too), at most `slots`.
 */
export const pickStreakLamps = (lamps: readonly StreakLamp[], eye: { x: number; z: number }, forward: { x: number; z: number } | null, slots: number): StreakLamp[] => {
  const scored: { lamp: StreakLamp; score: number }[] = [];
  for (const lamp of lamps) {
    const dx = lamp.x - eye.x;
    const dz = lamp.z - eye.z;
    const d = Math.hypot(dx, dz);
    if (d > STREAK_REACH) continue;
    const behind = forward !== null && dx * forward.x + dz * forward.z < -2;
    scored.push({ lamp, score: d + (behind ? 1000 : 0) });
  }
  scored.sort((a, b) => a.score - b.score || a.lamp.seed - b.lamp.seed);
  return scored.slice(0, slots).map((s) => s.lamp);
};

/**
 * Feeds the map city's ground with the lamps near the eye for their streaks on the wet street
 * (ADR-0084, `npr/lamp-streaks.ts`): picked again when the eye moves on, dark by day.
 */
export class LampStreakFeed {
  private lamps: readonly StreakLamp[] = [];
  private picked: StreakLamp[] = [];
  private night = 1;
  private at: { x: number; z: number } | null = null;
  private facing: { x: number; z: number } | null = null;
  private readonly slots: number;

  constructor(
    private readonly wet: ToonWetGround,
    quality: RenderQuality,
  ) {
    this.slots = quality === "low" ? MAX_LAMP_STREAKS / 2 : MAX_LAMP_STREAKS;
  }

  /** Every lamp that pools its light on the street, in a stable order. */
  setLamps(lamps: readonly StreakLamp[]): void {
    this.lamps = lamps;
    this.at = null;
  }

  /** Night 0 .. 1: the streaks go out by day, as the halos do. */
  setNight(night: number): void {
    const n = Math.max(0, Math.min(1, night));
    if (n === this.night) return;
    this.night = n;
    this.push();
  }

  /** The eye and the way it looks on the ground: the nearest lamps in front of it, once it has moved. */
  aim(eye: { x: number; z: number }, forward: { x: number; z: number } | null): void {
    const f = this.facing;
    const turned = forward !== null && (f === null || forward.x * f.x + forward.z * f.z < 0.9 * Math.hypot(forward.x, forward.z) * Math.hypot(f.x, f.z));
    if (this.at && !turned && Math.hypot(eye.x - this.at.x, eye.z - this.at.z) < REPICK) return;
    this.at = { x: eye.x, z: eye.z };
    if (forward) this.facing = { x: forward.x, z: forward.z };
    const next = pickStreakLamps(this.lamps, eye, forward, this.slots);
    if (next.length === this.picked.length && next.every((l, i) => l === this.picked[i])) return;
    this.picked = next;
    this.push();
  }

  /** The lamps fed now (tests). */
  get current(): readonly StreakLamp[] {
    return this.picked;
  }

  private push(): void {
    const k = this.night * this.night * GAIN;
    const pos: number[] = [];
    const col: number[] = [];
    for (const l of k > 0 ? this.picked : []) {
      pos.push(l.x, l.y, l.z, l.seed);
      col.push(l.color[0] * k, l.color[1] * k, l.color[2] * k, 1);
    }
    this.wet.setLampStreaks(pos, col);
  }
}
