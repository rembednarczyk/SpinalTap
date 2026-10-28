import type { Vec3 } from "@seki/core";
import type { FlashLimiter } from "./flash-limiter";

/**
 * Light trails of wave 2 (ADR-0036) as pure state: the streak a dash leaves behind and the
 * reflected bullet's path from the blade back to the shooter. The renderer turns each live
 * trail into a pooled glowing beam; the rules (lifetimes, fade, following the dasher, the
 * flash budget of the reflection) are tested without a GPU.
 */

export type TrailKind = "dash" | "dash-low" | "reflect";

export interface Trail {
  readonly kind: TrailKind;
  readonly from: Vec3;
  to: Vec3;
  /** Seconds left, and the full life. */
  ttl: number;
  readonly life: number;
  /** While it runs, the end follows this entity (the dasher), offset upwards by `lift`. */
  readonly follow: number | null;
  readonly lift: number;
  /** Seconds the end keeps following. */
  followFor: number;
}

/** Seconds a dash streak lives, and how long its head follows the dasher. */
export const DASH_TRAIL_LIFE = 0.42;
export const DASH_FOLLOW = 0.22;
/** Seconds the reflected bullet's trail stays. */
export const REFLECT_TRAIL_LIFE = 0.2;
/** Chest and knee height of the two dash streaks. */
const DASH_LIFTS = [1.15, 0.45] as const;
/** Where the reflected bullet ends on the shooter: about the chest. */
const SHOOTER_CHEST = 1.3;
/** Most trails alive at once; the oldest goes first. */
export const MAX_TRAILS = 8;

/** Opacity of a trail at `ttl` of `life`: full at first, then an eased fade out. */
export const trailFade = (ttl: number, life: number): number => {
  if (life <= 0) return 0;
  const k = Math.max(0, Math.min(1, ttl / life));
  return k * k * (3 - 2 * k);
};

/** Length and midpoint of a segment; a beam mesh is scaled and placed from these. */
export const segment = (from: Vec3, to: Vec3): { length: number; mid: Vec3 } => ({
  length: Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z),
  mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
});

const up = (p: Vec3, dy: number): Vec3 => ({ x: p.x, y: p.y + dy, z: p.z });

export type PositionOf = (id: number) => Vec3 | null;

export class TrailState {
  private readonly items: Trail[] = [];

  constructor(private readonly limiter: FlashLimiter) {}

  get trails(): readonly Trail[] {
    return this.items;
  }

  /** A dash from `at` (the feet): two streaks whose heads follow the dasher for a moment. */
  dash(entityId: number, at: Vec3): void {
    DASH_LIFTS.forEach((lift, i) => {
      const from = up(at, lift);
      this.push({ kind: i === 0 ? "dash" : "dash-low", from, to: from, ttl: DASH_TRAIL_LIFE, life: DASH_TRAIL_LIFE, follow: entityId, lift, followFor: DASH_FOLLOW });
    });
  }

  /**
   * A bullet sent back from the blade at `at` to the shooter's chest (or straight up the
   * defender's view when the shooter is gone). Returns true when the spark may also light the
   * street: one of the three flashes a second (ADR-0030), never with reduced flashes.
   */
  reflect(at: Vec3, shooter: Vec3 | null, reduceFlashes: boolean): boolean {
    const to = shooter ? up(shooter, SHOOTER_CHEST) : up(at, 0.01);
    this.push({ kind: "reflect", from: at, to, ttl: REFLECT_TRAIL_LIFE, life: REFLECT_TRAIL_LIFE, follow: null, lift: 0, followFor: 0 });
    return !reduceFlashes && this.limiter.tryFlash();
  }

  update(dt: number, positionOf: PositionOf): void {
    const step = Math.max(0, dt);
    for (let i = this.items.length - 1; i >= 0; i--) {
      const t = this.items[i]!;
      t.ttl -= step;
      if (t.ttl <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      if (t.follow === null || t.followFor <= 0) continue;
      t.followFor -= step;
      const p = positionOf(t.follow);
      if (p) t.to = up(p, t.lift);
    }
  }

  clear(): void {
    this.items.length = 0;
  }

  private push(t: Trail): void {
    this.items.push(t);
    while (this.items.length > MAX_TRAILS) this.items.shift();
  }
}
