import { GAME_SECONDS_PER_REAL_SECOND, advanceClock } from "@seki/core";
import type { System } from "../world/context";

/** Game seconds per fixed step: 1 at 60 Hz. Whole seconds keep the clock exact over any run. */
export const gameSecondsPerStep = (dt: number): number => Math.round(dt * GAME_SECONDS_PER_REAL_SECOND);

/**
 * Advances the day clock by one step. First in the step, so streaming and schedules see the
 * time this step belongs to. The world keeps living during dialogue, so the clock does too.
 */
export const clockSystem: System = {
  name: "clock",
  run(ctx) {
    const domain = ctx.state.domain;
    ctx.state.domain = { ...domain, clock: advanceClock(domain.clock, gameSecondsPerStep(ctx.dt)) };
  },
};
