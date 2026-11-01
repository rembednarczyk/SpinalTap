import { COMBAT_RADIUS, type DifficultyProfile, type GameCommand, difficultyProfile, isDifficultyProfile } from "@seki/core";
import type { SimContext, System } from "./context";

/*
 * The difficulty of the run (ADR-0066). The profile lives in the domain state (it is saved and it
 * changes the outcome, like the seed); systems read it only through `difficultyOf` and multiply
 * their own constant by one field, in one place each, never asking which preset it is.
 */

/** The world's difficulty resource: the profile every system scales its constants by. */
export const difficultyOf = (ctx: SimContext): DifficultyProfile => ctx.state.domain.difficulty;

/** Is an alerted NPC (awake) within COMBAT_RADIUS of the player, so a fight is on? */
export const fightNearby = (ctx: SimContext): boolean => {
  const player = ctx.world.with("player").first;
  if (!player) return false;
  for (const g of ctx.world.with("ai")) {
    if (g.ai.alerted && !g.unconscious && Math.hypot(g.position.x - player.position.x, g.position.z - player.position.z) <= COMBAT_RADIUS) return true;
  }
  return false;
};

const apply = (ctx: SimContext, profile: DifficultyProfile): void => {
  ctx.session.pendingDifficulty = null;
  ctx.state.domain = { ...ctx.state.domain, difficulty: profile };
};

/**
 * The `set-difficulty` command: a valid profile takes effect at once, or, in a fight, waits for
 * its end (the last one asked for wins). An invalid one changes nothing.
 */
export const setDifficulty = (ctx: SimContext, cmd: Extract<GameCommand, { type: "set-difficulty" }>): void => {
  if (!isDifficultyProfile(cmd.profile)) return;
  const profile = difficultyProfile(cmd.profile);
  if (fightNearby(ctx)) ctx.session.pendingDifficulty = profile;
  else apply(ctx, profile);
};

/** Puts a waiting profile in force once no alerted NPC is near the player any more. */
export const difficultySystem: System = {
  name: "difficulty",
  run(ctx) {
    const pending = ctx.session.pendingDifficulty;
    if (pending && !fightNearby(ctx)) apply(ctx, pending);
  },
};
