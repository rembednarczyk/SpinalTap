import {
  CONTRACT_BONUS,
  type GameCommand,
  PROTECTEE_KEY,
  contractKind,
  contractTag,
  contractTerminalKey,
  credit,
  debriefOf,
  freshTally,
  generateContractOfKind,
  hasFlag,
  VARIATION_FROM_COMPLETED,
  applyVariation,
  rollContractVariation,
  UNDETECTED_CONTRACT_XP,
  breachXp,
  contractXp,
} from "@seki/core";
import { deriveRandom } from "../rng/derive-random";
import { DOKI_TERMINAL_SPOTS } from "../content/district-doki";
import { oyajiStallOpen } from "../content/schedules";
import { HACK_RANGE } from "../systems/contract-system";
import { deadFlag } from "../systems/death-system";
import { SIM_HZ } from "../step-rate";
import type { SimContext } from "./context";
import { applyReputationCause, clearContract, raiseProgress } from "./domain-ops";
import { BREACH_DAEMONS, giverOfContract, hackFxOf, noteHacked, phoneFromFixer } from "./street";
import { grantXp } from "./progression-ops";

/** Daemons of a terminal breach (ADR-0029): ICEpick cuts the hack short, Datamine pays, Mass Vulnerability marks the wave. */
export const BREACH_ICEPICK_SECONDS = 10;
export const BREACH_DATAMINE_EDDIES = 80;
export const BREACH_MARK_SECONDS = 20;

type Command<K extends GameCommand["type"]> = Extract<GameCommand, { type: K }>;

/** Oyaji has patched himself up since the last raid (only matters while he is in the world). */
const patchUpProtectee = (ctx: SimContext): void => {
  for (const e of ctx.world.with("health")) if (e.key === PROTECTEE_KEY) e.health = { ...e.health, current: e.health.max };
};

/** Oyaji lies knocked out (ADR-0065): there is nobody standing to protect. */
const protecteeDown = (ctx: SimContext): boolean => {
  for (const e of ctx.world.with("unconscious")) if (e.key === PROTECTEE_KEY) return true;
  return false;
};

/** A new job from the fixer; refused while one runs, and a raid only on a living Oyaji's open stall. */
export const acceptContract = (ctx: SimContext, cmd: Command<"accept-contract">): void => {
  const domain = ctx.state.domain;
  const kind = cmd.kind ?? "eliminate";
  if (domain.contracts.active) return;
  // Nobody to protect once Oyaji is dead or knocked out (ADR-0065), and Hebi raid his stall only while it is open.
  if (kind === "protect" && (hasFlag(domain.flags, deadFlag(PROTECTEE_KEY)) || protecteeDown(ctx) || !oyajiStallOpen(domain.clock))) return;
  const plain = generateContractOfKind(
    kind,
    { log: domain.contracts, reputation: domain.reputation, flags: domain.flags, tick: ctx.tick, ticksPerSecond: SIM_HZ },
    ctx.rng,
  );
  // The variation (ADR-0034) from a stream of its own, so the job's other rolls stay as they were.
  const varied = domain.contracts.completed >= VARIATION_FROM_COMPLETED;
  const variation = varied ? rollContractVariation(kind, plain.siteId, deriveRandom(ctx.seed, `variation:${plain.id}`)) : null;
  const contract = variation ? applyVariation(plain, variation, ctx.tick, SIM_HZ) : plain;
  // Fresh debrief counters (ADR-0029) and no hooks found: a new job starts clean.
  const { hooks: _found, ...log } = domain.contracts;
  ctx.state.domain = { ...domain, contracts: { ...log, active: contract, tally: freshTally(ctx.tick) } };
  if (kind === "protect") patchUpProtectee(ctx);
  ctx.streamer.registerContract(ctx.world, ctx.state.domain.flags, domain.contracts.completed, contract);
  ctx.bus.emit("ContractAccepted", { contract });
  ctx.bus.emit("ContractBonusChanged", { contractId: contract.id, condition: CONTRACT_BONUS[kind], kept: true });
};

/** Hands the package of a running delivery over. */
export const deliverContract = (ctx: SimContext): void => {
  const contract = ctx.state.domain.contracts.active;
  if (contract?.status !== "active" || contractKind(contract) !== "delivery") return;
  clearContract(ctx);
};

/** Pays out a cleared job. */
export const completeContract = (ctx: SimContext): void => {
  const domain = ctx.state.domain;
  const contract = domain.contracts.active;
  if (contract?.status !== "cleared") return;
  // The card (ADR-0029): badges from the counters, the condition's bonus and the fixer's style, paid in one transfer.
  const kind = contractKind(contract);
  const tally = domain.contracts.tally ?? freshTally(ctx.tick);
  const card = debriefOf(kind, tally, contract.reward, ctx.tick, SIM_HZ);
  const total = contract.reward + card.bonus + card.styleBonus;
  const paid = credit(domain.wallet, total);
  ctx.state.domain = {
    ...domain,
    wallet: paid.ok ? paid.wallet : domain.wallet,
    contracts: { active: null, completed: domain.contracts.completed + 1 },
  };
  ctx.streamer.clearSite();
  if (paid.ok) ctx.bus.emit("EddiesChanged", { balance: paid.wallet.eddies, delta: total });
  applyReputationCause(ctx, { type: "contract-completed", kind });
  ctx.bus.emit("ContractCompleted", { contract, reward: contract.reward });
  ctx.bus.emit("ContractDebrief", { contractId: contract.id, reward: contract.reward, ...card, ...(contract.variation ? { variation: contract.variation } : {}) });
  phoneFromFixer(ctx, giverOfContract(contract), "paid");
  // Experience by difficulty (ADR-0059), and a stealth bonus when nobody noticed the player.
  grantXp(ctx, contractXp(kind, contract.targets), "contract");
  if (!tally.detected) grantXp(ctx, UNDETECTED_CONTRACT_XP, "stealth");
  raiseProgress(ctx, "contract_completed");
};

/**
 * A terminal breach (ADR-0028, ADR-0029): only on the running hack job's terminal, with the
 * hack started and Seki at the terminal, once per job. The UI played the minigame; the daemons
 * it won apply here: ICEpick takes BREACH_ICEPICK_SECONDS off the hack and a RAM off every
 * quickhack while the job lasts, Datamine pays BREACH_DATAMINE_EDDIES, Mass Vulnerability marks
 * the job's guards for BREACH_MARK_SECONDS.
 */
export const applyBreach = (ctx: SimContext, { terminalKey, daemons: won }: Command<"breach-result">): void => {
  const domain = ctx.state.domain;
  const contract = domain.contracts.active;
  if (contract?.status !== "active" || contractKind(contract) !== "hack" || contract.breach || contract.progress === undefined) return;
  if (terminalKey !== contractTerminalKey(contract.id)) return;
  const spot = DOKI_TERMINAL_SPOTS[contract.siteId];
  const p = ctx.world.with("player").first;
  if (!spot || !p || Math.hypot(p.position.x - spot.x, p.position.z - spot.z) > HACK_RANGE) return;
  const daemons = BREACH_DAEMONS.filter((d) => won.includes(d));
  const rate = Math.round(1 / ctx.dt);
  const progress = contract.progress + (daemons.includes("icepick") ? BREACH_ICEPICK_SECONDS * rate : 0);
  ctx.state.domain = { ...domain, contracts: { ...domain.contracts, active: { ...contract, breach: daemons, progress } } };
  if (daemons.includes("datamine")) {
    const r = credit(ctx.state.domain.wallet, BREACH_DATAMINE_EDDIES);
    if (r.ok) {
      ctx.state.domain = { ...ctx.state.domain, wallet: r.wallet };
      ctx.bus.emit("EddiesChanged", { balance: r.wallet.eddies, delta: BREACH_DATAMINE_EDDIES, source: "loot" });
    }
  }
  if (daemons.includes("mass_vulnerability")) {
    const tag = contractTag(contract.id);
    for (const e of [...ctx.world]) if (e.tag === tag) hackFxOf(ctx.world, e).pinged = BREACH_MARK_SECONDS;
  }
  noteHacked(ctx);
  ctx.bus.emit("BreachCompleted", { terminalKey, daemons });
  grantXp(ctx, breachXp(daemons.length), "hack");
};
