import { BASE_RAM, type DomainState, type GameCommand, QUICKHACK_XP, type XpSource, attributeRam, detectionScale, gainXp, isAttributeId, rememberHack, spendAttributePoint } from "@seki/core";
import type { SimContext } from "./context";
import { difficultyOf } from "./difficulty";
import { goneReinforcement } from "./reinforcements";

/**
 * Character progression in the simulation (ADR-0059, stages 1 and 2). Every source of experience goes
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

/**
 * A quickhack landed on the target with `key`: only the first one on each target pays (no farming
 * a speaker every second). Targets without one (passers-by; the scanner gives the heat's
 * reinforcements one, G-202) are not remembered across a save, so they pay nothing.
 */
export const grantQuickhackXp = (ctx: SimContext, key: string | undefined): void => {
  if (!key) return;
  const remembered = rememberHack(ctx.state.domain.progression, key, goneReinforcement(ctx.world));
  if (!remembered) return;
  ctx.state.domain = { ...ctx.state.domain, progression: remembered };
  grantXp(ctx, QUICKHACK_XP, "hack");
};

/** The cyberdeck's RAM pool: the base and what Net adds (ADR-0059). */
export const ramMaxOf = (domain: DomainState): number => BASE_RAM + attributeRam(domain.progression.attributes);

/**
 * The pace at which enemies and cameras fill their suspicion of the player: the difficulty's
 * `awareness` (ADR-0066) slowed by Shadow (ADR-0059). Draining is not affected.
 */
export const detectionPaceOf = (ctx: SimContext): number => difficultyOf(ctx).awareness * detectionScale(ctx.state.domain.progression.attributes);

/**
 * The `spend-attribute-point` command: a refused spend (no point, attribute at 15) changes
 * nothing. A point of Net that grows the RAM pool reports it, so the HUD shows the new pool
 * before the RAM next changes.
 */
export const spendAttribute = (ctx: SimContext, cmd: Extract<GameCommand, { type: "spend-attribute-point" }>): void => {
  if (!isAttributeId(cmd.attribute)) return;
  const ram = ramMaxOf(ctx.state.domain);
  const r = spendAttributePoint(ctx.state.domain.progression, cmd.attribute);
  if (!r.ok) return;
  ctx.state.domain = { ...ctx.state.domain, progression: r.state };
  const max = ramMaxOf(ctx.state.domain);
  if (max !== ram) ctx.bus.emit("RamChanged", { current: Math.floor(ctx.state.domain.netrun.ram + 1e-9), max });
};
