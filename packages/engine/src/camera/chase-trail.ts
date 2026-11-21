/** A new point of the trail once the car has moved this far from the last (m). */
const STEP = 0.5;
/** A move between frames longer than this (m) is a jump (a teleport, a new car), not driving. */
const JUMP = 25;

/**
 * The road the car drove in the last moments, points on the ground every `STEP` metres (the
 * pattern of the chase camera of the owner's PodRcr, `src/render/ChaseTrail.ts`). The chase camera
 * stands on it a set distance behind the car: the car was just there, so the spot is clear of
 * walls, also in a tight turn, where a point on the car's axis behind it would fall in a building.
 */
export class ChaseTrail {
  /** From the oldest to the newest: x, z in turn. */
  private points: number[] = [];

  /** Records where the car is; keeps no more than `keep` metres. A jump starts the trail over. */
  record(x: number, z: number, keep: number): void {
    const n = this.points.length;
    if (n >= 2) {
      const moved = Math.hypot(x - this.points[n - 2]!, z - this.points[n - 1]!);
      if (moved < STEP) return;
      if (moved > JUMP) this.points = [];
    }
    this.points.push(x, z);
    const max = 2 * (Math.ceil(keep / STEP) + 8);
    if (this.points.length > 2 * max) this.points = this.points.slice(this.points.length - max);
  }

  clear(): void {
    this.points = [];
  }

  /**
   * The point on the trail `distance` metres (along the road driven) behind (`x`, `z`). A trail
   * shorter than that lays the rest off its end towards (`backX`, `backZ`), behind the car. The
   * newest points ahead of the car are skipped: backing up along its own trail, the camera would
   * otherwise stand in front of it looking back.
   */
  pointBehind(x: number, z: number, distance: number, backX: number, backZ: number): { x: number; z: number } {
    let px = x;
    let pz = z;
    let left = distance;
    let i = this.points.length - 2;
    while (i >= 0 && (this.points[i]! - x) * backX + (this.points[i + 1]! - z) * backZ <= 0) i -= 2;
    for (; i >= 0; i -= 2) {
      const qx = this.points[i]!;
      const qz = this.points[i + 1]!;
      const segment = Math.hypot(qx - px, qz - pz);
      if (segment >= left) {
        const t = left / segment;
        return { x: px + (qx - px) * t, z: pz + (qz - pz) * t };
      }
      left -= segment;
      px = qx;
      pz = qz;
    }
    return { x: px + backX * left, z: pz + backZ * left };
  }
}
