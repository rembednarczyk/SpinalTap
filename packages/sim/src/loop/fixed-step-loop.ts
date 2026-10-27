import type { ClockPort } from "@seki/core";

export interface LoopCallbacks {
  /** One fixed simulation step. */
  update(): void;
  /** Render with alpha ∈ [0, 1) = progress towards the next step. */
  render(alpha: number): void;
}

/**
 * Fixed-timestep accumulator loop. Simulation runs at a constant rate; rendering runs once
 * per frame. Long frames are clamped to maxSteps to avoid a spiral of death.
 */
export class FixedStepLoop {
  private accumulator = 0;
  private last: number | null = null;
  paused = false;

  constructor(
    private readonly clock: ClockPort,
    private readonly callbacks: LoopCallbacks,
    private readonly stepMs = 1000 / 60,
    private readonly maxSteps = 5,
  ) {}

  /** Call once per display frame. Returns the number of simulation steps executed. */
  frame(): number {
    const now = this.clock.now();
    const elapsed = this.last === null ? 0 : now - this.last;
    this.last = now;
    let steps = 0;
    if (!this.paused) {
      this.accumulator += elapsed;
      while (this.accumulator >= this.stepMs && steps < this.maxSteps) {
        this.callbacks.update();
        this.accumulator -= this.stepMs;
        steps += 1;
      }
      if (steps === this.maxSteps) this.accumulator = 0;
    }
    this.callbacks.render(this.paused ? 0 : this.accumulator / this.stepMs);
    return steps;
  }
}
