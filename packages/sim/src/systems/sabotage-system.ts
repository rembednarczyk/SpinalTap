import {
  type Contract,
  SABOTAGE,
  SABOTAGE_SEEN,
  W3_VIRUS_FLAG,
  contractAlarmFlag,
  contractKind,
  contractTag,
  contractVirusKey,
  sabotagePay,
  virusUploaded,
} from "@seki/core";
import { W3_TERMINAL_SPOTS, inW3Zone } from "../content/tessen-w3";
import type { Entity } from "../world/components";
import type { SimContext, System } from "../world/context";
import { adjustReputation, clearContract, failContract, raiseFlag } from "../world/domain-ops";
import { completeContract } from "../world/contract-commands";
import { BREACH_DAEMONS } from "../world/street";
import { raiseAlarm } from "./contract-system";
import { lockdown } from "./door-system";

/**
 * W-3's sabotage, the silent way (ADR-0082 §1, stage 3): the virus goes into the calibration core
 * while Seki stands by its terminal and pauses while she is away; the job's guards or the server
 * room's camera noticing her raises the job's alarm, which locks the server rooms down (no upload
 * then); once the virus is in she leaves the zone, seen if the alarm is up by then, and Genzō pays
 * by phone. 06:00 without the virus in ships the batch. Every counter is in the contract, so the
 * clock survives a save.
 */

const setActive = (ctx: SimContext, contract: Contract): void => {
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: contract } };
};

/** Has anyone of the job seen her: a guard of its crew alerted, or a camera watching the sabotage's no-go zone with its spot full? */
const spotted = (ctx: SimContext, contract: Contract): boolean => {
  const tag = contractTag(contract.id);
  for (const g of ctx.world.with("ai")) if (g.tag === tag && g.ai.alerted) return true;
  for (const c of ctx.world.with("device")) if (c.device.kind === "camera" && c.device.restricted?.during === "sabotage" && c.device.spot >= 1) return true;
  return false;
};

/** Is Seki by the core's terminal: in its reach, on its level, alive? */
const atCore = (ctx: SimContext, contract: Contract): boolean => {
  const spot = W3_TERMINAL_SPOTS[contract.siteId];
  const p = ctx.world.with("player").first;
  if (!spot || !p || ctx.session.gameOver) return false;
  return Math.hypot(p.position.x - spot.x, p.position.z - spot.z) <= SABOTAGE.range && Math.abs(p.position.y - spot.y) <= SABOTAGE.reachY;
};

/** Out of the zone with the virus in: the job is done and paid at once, the seen rate if she was seen leaving. */
const leave = (ctx: SimContext, contract: Contract): void => {
  setActive(ctx, { ...contract, reward: sabotagePay(contract) });
  clearContract(ctx);
  completeContract(ctx);
  if (contract.seenLeaving) for (const d of SABOTAGE_SEEN) adjustReputation(ctx, d.faction, d.delta);
};

/** One step of the running sabotage. */
export const runSabotage = (ctx: SimContext, contract: Contract): void => {
  const rate = Math.round(1 / ctx.dt);
  const uploaded = virusUploaded(contract, rate);
  if (!uploaded && contract.deadlineTick !== undefined && ctx.tick >= contract.deadlineTick) {
    failContract(ctx, "batch-shipped");
    return;
  }
  if (!ctx.state.domain.flags.includes(contractAlarmFlag(contract.id)) && spotted(ctx, contract)) raiseAlarm(ctx, contract);
  if (!uploaded) {
    // The upload counts only by the terminal and only while the server rooms are open.
    if (contract.progress === undefined || lockdown(ctx) || !atCore(ctx, contract)) return;
    const next = { ...contract, progress: contract.progress + 1 };
    setActive(ctx, next);
    if (virusUploaded(next, rate)) raiseFlag(ctx, W3_VIRUS_FLAG);
    return;
  }
  const seen = contract.seenLeaving || ctx.state.domain.flags.includes(contractAlarmFlag(contract.id));
  const now: Contract = seen && !contract.seenLeaving ? { ...contract, seenLeaving: true } : contract;
  if (now !== contract) setActive(ctx, now);
  const p = ctx.world.with("player").first;
  if (p && !ctx.session.gameOver && !inW3Zone(p.position.x, p.position.z)) leave(ctx, now);
};

/**
 * The core's terminal of the running sabotage: the key starts the upload (the silent way, ADR-0082)
 * and opens Breach Protocol until one lands (ICEpick shortens the upload). Refused in a lockdown.
 */
export const startUpload = (ctx: SimContext, terminal: Entity): void => {
  const contract = ctx.state.domain.contracts.active;
  if (contract?.status !== "active" || contractKind(contract) !== "sabotage" || terminal.key !== contractVirusKey(contract.id) || lockdown(ctx)) return;
  if (!contract.breach && !virusUploaded(contract, Math.round(1 / ctx.dt))) ctx.bus.emit("BreachStarted", { terminalKey: terminal.key, daemons: BREACH_DAEMONS });
  if (contract.progress !== undefined) return;
  setActive(ctx, { ...contract, route: "quiet", progress: 0 });
};

/** Runs the sabotage after the contract system (ADR-0082): the hall's job keeps its own clock. */
export const sabotageSystem: System = {
  name: "sabotage",
  run(ctx) {
    const contract = ctx.state.domain.contracts.active;
    if (contract?.status === "active" && contractKind(contract) === "sabotage") runSabotage(ctx, contract);
  },
};
