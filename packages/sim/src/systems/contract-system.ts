import {
  type Contract,
  HACK_GRACE_SECONDS,
  HACK_SECONDS,
  PROTECTEE_KEY,
  contractAlarmFlag,
  contractEscortKey,
  contractKind,
  contractTag,
} from "@seki/core";
import { DOKI_TERMINAL_SPOTS, ESCORT_AMBUSH_Z, ESCORT_ROUTE } from "../content/district-doki";
import type { SimContext, System } from "../world/context";
import { clearContract, failContract, raiseFlag } from "../world/domain-ops";
import { deadFlag } from "./death-system";
import { CONTRACT_SITE_SPAWNS } from "../content/district-m0";
import { disturb } from "../world/street";

/** A raised alarm is heard this far (ADR-0029). */
export const ALARM_NOISE = 25;

/** Mika is on the boat this close to the end of the route (metres, horizontally). */
export const ESCORT_ARRIVE = 1.2;
/** Seki keeps a hack's connection standing this close to the terminal (horizontally, and on its level). */
export const HACK_RANGE = 4;
const HACK_REACH_Y = 1.6;

/** Raises a docks job's alarm once and wakes whoever was waiting for it (ADR-0024). */
export const raiseAlarm = (ctx: SimContext, contract: Contract): void => {
  const flag = contractAlarmFlag(contract.id);
  if (ctx.state.domain.flags.includes(flag)) return;
  raiseFlag(ctx, flag);
  ctx.streamer.spawnWaiting(ctx.world, ctx.state.domain.flags);
  ctx.bus.emit("ContractAlarm", { contract });
  // The job's own second phase: the street hears it, the debrief does not count it as an alarm.
  const site = CONTRACT_SITE_SPAWNS[contract.siteId][0];
  if (site) disturb(ctx, "alarm", site, ALARM_NOISE, ctx.world.with("player").first?.id ?? 0);
};

const setActive = (ctx: SimContext, contract: Contract): void => {
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: contract } };
};

/** The escort: Mika dead fails it; past the yard she springs the ambush; at the end of the pier the job is done. */
const runEscort = (ctx: SimContext, contract: Contract): void => {
  const key = contractEscortKey(contract.id);
  if (ctx.state.domain.flags.includes(deadFlag(key))) {
    failContract(ctx, "escort-killed");
    return;
  }
  const mika = ctx.world.with("escort").entities.find((e) => e.key === key);
  if (!mika) return;
  if (mika.position.z >= ESCORT_AMBUSH_Z) raiseAlarm(ctx, contract);
  const end = ESCORT_ROUTE[ESCORT_ROUTE.length - 1] ?? ESCORT_ROUTE[0];
  if (Math.hypot(mika.position.x - end.x, mika.position.z - end.z) <= ESCORT_ARRIVE) clearContract(ctx);
};

/** The infiltration: any of its guards raising the alarm fails it. */
const runInfiltration = (ctx: SimContext, contract: Contract): void => {
  const tag = contractTag(contract.id);
  for (const g of ctx.world.with("ai")) {
    if (g.tag === tag && g.ai.alerted) {
      failContract(ctx, "detected");
      return;
    }
  }
};

/**
 * The hack, once started: every step at the terminal adds to the connection, every step away
 * counts towards the grace; done at HACK_SECONDS, lost after HACK_GRACE_SECONDS away in a row.
 * Both counters are in the contract, so the clock survives a save.
 */
const runHack = (ctx: SimContext, contract: Contract): void => {
  if (contract.progress === undefined) return;
  const spot = DOKI_TERMINAL_SPOTS[contract.siteId];
  const player = ctx.world.with("player").first;
  const rate = Math.round(1 / ctx.dt);
  const at =
    !!spot &&
    !!player &&
    !ctx.session.gameOver &&
    Math.hypot(player.position.x - spot.x, player.position.z - spot.z) <= HACK_RANGE &&
    Math.abs(player.position.y - spot.y) <= HACK_REACH_Y;
  const next = at ? { ...contract, progress: contract.progress + 1, away: 0 } : { ...contract, away: (contract.away ?? 0) + 1 };
  setActive(ctx, next);
  if ((next.away ?? 0) >= HACK_GRACE_SECONDS * rate) failContract(ctx, "connection-lost");
  else if ((next.progress ?? 0) >= HACK_SECONDS * rate) clearContract(ctx);
};

/**
 * Fails a running contract whose job can no longer be done: a delivery past its deadline
 * (the tick is part of the save, so the clock survives a load) or a protection job whose
 * Oyaji is dead. Runs the docks jobs too (ADR-0024): the escort's ambush and arrival, the
 * infiltration's alarm, the hack's connection. Runs after the death system, so a kill and its
 * consequence share a step.
 */
export const contractSystem: System = {
  name: "contract",
  run(ctx) {
    const contract = ctx.state.domain.contracts.active;
    if (contract?.status !== "active") return;
    const kind = contractKind(contract);
    if (kind === "delivery" && contract.deadlineTick !== undefined && ctx.tick >= contract.deadlineTick) failContract(ctx, "timeout");
    else if (kind === "protect" && ctx.state.domain.flags.includes(deadFlag(PROTECTEE_KEY))) failContract(ctx, "protectee-killed");
    else if (kind === "escort") runEscort(ctx, contract);
    else if (kind === "infiltrate") runInfiltration(ctx, contract);
    else if (kind === "hack") runHack(ctx, contract);
  },
};
