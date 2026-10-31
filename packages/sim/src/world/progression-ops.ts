import { type GameCommand, type XpSource, gainXp, isAttributeId, spendAttributePoint } from "@seki/core";
import type { SimContext } from "./context";

/**
 * Character progression in the simulation (ADR-0059, stage 1). Every source of experience goes
 * through `grantXp`: it adds the XP to the domain, reports it and reports each level gained.
 * No randomness.
 */
export const grantXp = (ctx: SimContext, amount: number, source: XpSource): void => {
  const before = ctx.state.domain.progression;
  const r = gainXp(before, amount);
  if (r.state === before) return;
  ctx.state.domain = { ...ctx.state.domain, progression: r.state };
  ctx.bus.emit("ExperienceGained", { amount: r.state.xp - before.xp, source });
  for (let level = before.level + 1; level <= r.state.level; level++) ctx.bus.emit("LevelUp", { level });
};

/** The `spend-attribute-point` command: a refused spend (no point, attribute at 15) changes nothing. */
export const spendAttribute = (ctx: SimContext, cmd: Extract<GameCommand, { type: "spend-attribute-point" }>): void => {
  if (!isAttributeId(cmd.attribute)) return;
  const r = spendAttributePoint(ctx.state.domain.progression, cmd.attribute);
  if (r.ok) ctx.state.domain = { ...ctx.state.domain, progression: r.state };
};
