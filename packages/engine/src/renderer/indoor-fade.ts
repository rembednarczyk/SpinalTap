import type { IndoorKind } from "../npr/lighting";

/** Seconds the interior's light takes to replace the sky's (ADR-0082 §4). */
export const INDOOR_FADE = 0.35;

/**
 * How far the interior's light has replaced the sky's (0..1): the eye in a closed interior lit by
 * its own lamps (W-3's hall, ADR-0082 §4) fades the moon and the sun off the materials and the
 * fluorescent ambient on, over a third of a second. Its own part, so `ScreenFx` stays within the
 * member limit of ADR-0031.
 */
export class IndoorFade {
  private now = 0;
  private target = 0;
  private which: IndoorKind = "w3";

  /** The eye is inside (or not) from now on; inside, whose light it is (it keeps the last one while fading out). */
  set(on: boolean, kind: IndoorKind = "w3"): void {
    this.target = on ? 1 : 0;
    // W-3 and Alchemia are a city apart: the eye never goes from one straight into the other.
    if (on) this.which = kind;
  }

  /** Whose light the interior's is. */
  get kind(): IndoorKind {
    return this.which;
  }

  /** The interior's light now (0..1). */
  get value(): number {
    return this.now;
  }

  /** Moves the light `dt` seconds toward the target; true when it changed. */
  update(dt: number): boolean {
    if (this.now === this.target) return false;
    const step = Math.max(dt, 0) / INDOOR_FADE;
    this.now = this.target > this.now ? Math.min(this.target, this.now + step) : Math.max(this.target, this.now - step);
    return true;
  }
}
