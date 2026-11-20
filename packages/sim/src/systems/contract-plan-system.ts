import { type Contract, contractKind, contractTag, hasFlag, hasModifier, inHours, minuteOfDay } from "@seki/core";
import { hooksOfKind } from "../content/contract-hooks";
import { W3_SMOKER } from "../content/tessen-w3";
import type { SimContext, System } from "../world/context";
import { ambushFlag, arrivalTick, dayFlag, offPostFlag, onWayFlag, smokeFlag } from "../world/contract-plan";
import { lowerFlag, raiseFlag } from "../world/domain-ops";
import { contractSmokerKey } from "../world/quiet-way-templates";

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

/**
 * W-3's smoker lies knocked out or dead in the world (a body of a takedown, ADR-0065). A corpse
 * keeps his key and `unconscious` but has no health (`corpseOf`), so the bodies are looked for by
 * `unconscious`, not among the living.
 */
const smokerDown = (ctx: SimContext, c: Contract): boolean => {
  const key = contractSmokerKey(c.id);
  return ctx.world.with("unconscious").entities.some((e) => e.key === key);
};

const followClock = (ctx: SimContext, c: Contract): void => {
  // The crew on its way turns up at its tick (only lowered: a save from before the delays has its crew there already).
  const arrives = arrivalTick(c, ctx.state.domain.contracts.tally?.startTick ?? ctx.tick);
  if (arrives !== undefined && ctx.tick >= arrives && hasFlag(ctx.state.domain.flags, onWayFlag(c.id))) lowerFlag(ctx, onWayFlag(c.id));
  const minute = minuteOfDay(ctx.state.domain.clock);
  const fighting = crewAlerted(ctx, c);
  if (hasModifier(c, "night_only")) setFlag(ctx, dayFlag(c.id), !fighting && !inHours(minute, NIGHT_FROM, NIGHT_TO));
  // W-3's smoker by the service gate in his hours (G-929), whatever goes on in the hall; knocked
  // out, carried, hidden or killed in a takedown, his body stays past them.
  if (contractKind(c) === "sabotage") setFlag(ctx, smokeFlag(c.id), inHours(minute, W3_SMOKER.fromHour * 60, W3_SMOKER.toHour * 60) || smokerDown(ctx, c));
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
 * while the crew fights), a raid on its way turns up after its site's delay (ADR-0093 O3), and
 * once the job is done the ambush by the way out moves in. The
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
