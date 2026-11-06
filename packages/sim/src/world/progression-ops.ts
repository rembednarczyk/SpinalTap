import {
  BASE_RAM,
  type DomainState,
  type GameCommand,
  type PerkRanks,
  QUICKHACK_XP,
  type XpSource,
  attributeRam,
  detectionScale,
  gainXp,
  isAttributeId,
  perkDetectionScale,
  perkRam,
  rememberHack,
  spendAttributePoint,
  spendPerkPoint,
} from "@seki/core";
import type { SimContext } from "./context";
import { difficultyOf } from "./difficulty";
import { goneReinforcement } from "./reinforcements";

/**
 * Character progression in the simulation (ADR-0059, stages 1 to 3). Every source of experience goes
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

/** The cyberdeck's RAM pool: the base, what Net adds and the Buffer perk (ADR-0059). */
export const ramMaxOf = (domain: DomainState): number => BASE_RAM + attributeRam(domain.progression.attributes) + perkRam(domain.progression.perks);

/** The player's perk ranks (ADR-0059, stage 3), for the systems that read a perk's effect. */
export const playerPerks = (ctx: SimContext): PerkRanks => ctx.state.domain.progression.perks;

/**
 * The pace at which enemies and cameras fill their suspicion of the player: the difficulty's
 * `awareness` (ADR-0066) slowed by Shadow and Low Profile (ADR-0059). Draining is not affected.
 */
export const detectionPaceOf = (ctx: SimContext): number =>
  difficultyOf(ctx).awareness * detectionScale(ctx.state.domain.progression.attributes) * perkDetectionScale(ctx.state.domain.progression.perks);

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
  reportRamPool(ctx, ram);
};

/** Reports a RAM pool that changed (a point of Net, the Buffer perk, a respec), clamping the RAM to it. */
export const reportRamPool = (ctx: SimContext, before: number): void => {
  const max = ramMaxOf(ctx.state.domain);
  if (max === before) return;
  const netrun = ctx.state.domain.netrun;
  if (netrun.ram > max) ctx.state.domain = { ...ctx.state.domain, netrun: { ...netrun, ram: max } };
  ctx.bus.emit("RamChanged", { current: Math.floor(ctx.state.domain.netrun.ram + 1e-9), max });
};

/** The `spend-perk-point` command (stage 3): a refused one (no point, a tier not open, the last rank) changes nothing. */
export const spendPerk = (ctx: SimContext, cmd: Extract<GameCommand, { type: "spend-perk-point" }>): void => {
  const ram = ramMaxOf(ctx.state.domain);
  const r = spendPerkPoint(ctx.state.domain.progression, cmd.perk);
  if (!r.ok) return;
  ctx.state.domain = { ...ctx.state.domain, progression: r.state };
  reportRamPool(ctx, ram);
};
