import { type Contract, contractKind, contractTag, hasFlag, hasModifier, inHours, minuteOfDay } from "@seki/core";
import { hooksOfKind } from "../content/contract-hooks";
import type { SimContext, System } from "../world/context";
import { ambushFlag, dayFlag, offPostFlag } from "../world/contract-plan";
import { lowerFlag, raiseFlag } from "../world/domain-ops";

/** A `night_only` target is out from 20:00 to 05:00 (the night of the day clock). */
export const NIGHT_FROM = 20 * 60;
export const NIGHT_TO = 5 * 60;

const PLAN_PREFIX = "plan:";

const setFlag = (ctx: SimContext, flag: string, up: boolean): void => (up ? raiseFlag(ctx, flag) : lowerFlag(ctx, flag));

/** Is any of the job's crew fighting the player (then nobody walks off)? */
const crewAlerted = (ctx: SimContext, c: Contract): boolean => {
  const tag = contractTag(c.id);
  return ctx.world.with("ai").entities.some((e) => e.tag === tag && e.ai.alerted);
};

const followClock = (ctx: SimContext, c: Contract): void => {
  const minute = minuteOfDay(ctx.state.domain.clock);
  const fighting = crewAlerted(ctx, c);
  if (hasModifier(c, "night_only")) setFlag(ctx, dayFlag(c.id), !fighting && !inHours(minute, NIGHT_FROM, NIGHT_TO));
  for (const h of hooksOfKind(contractKind(c))) {
    const r = h.reveal;
    if (r.kind !== "rotation_gap") continue;
    const m = minute % r.period;
    setFlag(ctx, offPostFlag(c.id, r.post), !fighting && m >= r.from && m < r.to);
  }
};

/**
 * The plan of a varied contract over time (ADR-0034), after the contract system: the targets of
 * a night-only job are away by day, a guard with a rotation gap leaves his post in it (neither
 * while the crew fights), and once the job is done the ambush by the way out moves in. The
 * streamer follows the flags. Without a contract the flags of the last one come down.
 */
export const contractPlanSystem: System = {
  name: "contract-plan",
  run(ctx) {
    const c = ctx.state.domain.contracts.active;
    if (!c) {
      for (const f of ctx.state.domain.flags) if (f.startsWith(PLAN_PREFIX)) lowerFlag(ctx, f);
      return;
    }
    if (c.status === "active") {
      followClock(ctx, c);
      return;
    }
    const ambush = hasModifier(c, "ambush") || c.variation?.twist === "setup";
    if (!ambush || hasFlag(ctx.state.domain.flags, ambushFlag(c.id))) return;
    // The job is done: the presence flags of the plan come down, the crew by the way out comes.
    for (const f of ctx.state.domain.flags) if (f.startsWith(`${PLAN_PREFIX}day:`) || f.startsWith(`${PLAN_PREFIX}off:`)) lowerFlag(ctx, f);
    raiseFlag(ctx, ambushFlag(c.id));
    ctx.streamer.spawnWaiting(ctx.world, ctx.state.domain.flags);
  },
};
