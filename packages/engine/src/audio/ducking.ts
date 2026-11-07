/** Depth of the duck under speech, dB (ADR-0060 stage 1). */
export const SPEECH_DUCK_DB = -8;
/** Seconds to fall the full depth once a line starts: quick enough not to cover the first word. */
export const SPEECH_DUCK_ATTACK = 0.25;
/** Seconds to rise back the full depth after the last line: slow, so the music swells back in. */
export const SPEECH_DUCK_RELEASE = 0.8;
/** Seconds the duck holds after a line ends, so the music does not pump between two lines. */
export const SPEECH_DUCK_HOLD = 0.35;

export const dbToGain = (db: number): number => 10 ** (db / 20);

/**
 * Ducking of music and radio under spoken lines, as plain numbers (like `MusicDirector`): the
 * level moves in dB at a fixed rate towards the duck while a line plays and back to 0 dB after
 * it, so the gain the WebAudio side ramps to is testable without a context. Times are the
 * audio clock's seconds and only grow; an earlier `now` is treated as no time passing.
 */
export class SpeechDucker {
  private db = 0;
  private at = 0;
  /** End of the last line plus the hold; speech counts as on before it. */
  private until = Number.NEGATIVE_INFINITY;

  /** A line from `now` until `end`; overlapping lines extend the duck. */
  speak(now: number, end: number): void {
    this.update(now);
    this.until = Math.max(this.until, end + SPEECH_DUCK_HOLD);
  }

  /** The line was cut: the release starts now, without the hold. */
  stop(now: number): void {
    this.update(now);
    this.until = Number.NEGATIVE_INFINITY;
  }

  speaking(now: number): boolean {
    return now < this.until;
  }

  /** Advances the level to `now` and returns the linear gain factor, 1 when not ducked. */
  update(now: number): number {
    if (now <= this.at) return this.factor;
    // A line that ended inside the step: fall until its end, rise only after it.
    if (this.at < this.until && this.until < now) {
      this.slew(this.until - this.at, true);
      this.slew(now - this.until, false);
    } else this.slew(now - this.at, this.speaking(now));
    this.at = now;
    return this.factor;
  }

  private slew(dt: number, down: boolean): void {
    const db = down ? this.db + (SPEECH_DUCK_DB / SPEECH_DUCK_ATTACK) * dt : this.db - (SPEECH_DUCK_DB / SPEECH_DUCK_RELEASE) * dt;
    // Snapped at both ends, so a duck at rest reads exactly 1 and exactly the full depth.
    this.db = db <= SPEECH_DUCK_DB + 1e-9 ? SPEECH_DUCK_DB : db >= -1e-9 ? 0 : db;
  }

  /** Gain factor at the last update. */
  get factor(): number {
    return this.db === 0 ? 1 : dbToGain(this.db);
  }

  /** True while the level is not at rest (falling, rising), so the scheduler keeps ramping. */
  moving(now: number): boolean {
    return this.speaking(now) ? this.db > SPEECH_DUCK_DB : this.db < 0;
  }
}
