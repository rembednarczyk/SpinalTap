import {
  type Contract,
  SABOTAGE,
  SABOTAGE_LOUD,
  SABOTAGE_SEEN,
  W3_VIRUS_FLAG,
  contractAlarmFlag,
  contractKind,
  contractTag,
  contractVirusKey,
  sabotagePay,
  sabotageUploadSeconds,
  secondWaveFlag,
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
import { chargesToTake, chooseLoud, plantableStation, runLoud, startPlanting, takeCharges } from "./sabotage-loud";
import { watchStaff } from "./sabotage-witness";

/**
 * W-3's sabotage (ADR-0082 §1, stage 3). The silent way: the virus goes into the calibration core
 * while Seki stands by its terminal and pauses while she is away; the job's guards, the server
 * room's camera or a technician of the line noticing her raises the job's alarm, which locks the
 * server rooms down; once the virus is in she leaves the zone, seen if the alarm is up by then, and
 * Genzō pays by phone. The alarm before the virus is in turns the job into the loud way (stage 3b,
 * `sabotage-loud.ts`): the armoury's charges on the line. 06:00 with neither the virus in nor the
 * line blown ships the batch. Every counter is in the contract, so the clock survives a save.
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

/**
 * The alarm is up: its tick is kept (the second wave comes from the pickup yard a minute after),
 * and before the virus is in the job turns loud ("Serwerownia odcięta. Zostaje zbrojownia.").
 */
const onAlarm = (ctx: SimContext, contract: Contract, uploaded: boolean, rate: number): Contract => {
  let c = contract;
  if (c.alarmTick === undefined) {
    c = { ...c, alarmTick: ctx.tick };
    setActive(ctx, c);
  }
  if (!uploaded && c.route !== "loud") {
    c = chooseLoud(ctx, c);
    // A running upload stops for good: the server rooms are cut off.
    if (c.progress !== undefined) ctx.bus.emit("VirusUploadChanged", { contract: c, progress: Math.min(1, c.progress / (sabotageUploadSeconds(c) * rate)), paused: true });
  }
  const wave = secondWaveFlag(c.id);
  if (!ctx.state.domain.flags.includes(wave) && ctx.tick >= (c.alarmTick ?? ctx.tick) + SABOTAGE_LOUD.secondWaveSeconds * rate) {
    raiseFlag(ctx, wave);
    ctx.streamer.spawnWaiting(ctx.world, ctx.state.domain.flags);
  }
  return c;
};

/**
 * The upload counts only by the terminal and only while the server rooms are open. `away` is 1
 * while it stands paused; `VirusUploadChanged` tells when it stops, goes on, and every whole second.
 */
const upload = (ctx: SimContext, contract: Contract, rate: number): void => {
  if (contract.progress === undefined) return;
  const total = sabotageUploadSeconds(contract) * rate;
  if (lockdown(ctx) || !atCore(ctx, contract)) {
    if (contract.away === 1) return;
    const paused = { ...contract, away: 1 };
    setActive(ctx, paused);
    ctx.bus.emit("VirusUploadChanged", { contract: paused, progress: Math.min(1, contract.progress / total), paused: true });
    return;
  }
  const { away, ...rest } = contract;
  const next: Contract = { ...rest, progress: contract.progress + 1 };
  setActive(ctx, next);
  if (away === 1 || (next.progress ?? 0) % rate === 0) ctx.bus.emit("VirusUploadChanged", { contract: next, progress: Math.min(1, (next.progress ?? 0) / total), paused: false });
  if (virusUploaded(next, rate)) raiseFlag(ctx, W3_VIRUS_FLAG);
};

/** One step of the running sabotage. */
export const runSabotage = (ctx: SimContext, contract: Contract): void => {
  const rate = Math.round(1 / ctx.dt);
  const uploaded = virusUploaded(contract, rate);
  if (!uploaded && !contract.detonated && contract.deadlineTick !== undefined && ctx.tick >= contract.deadlineTick) {
    failContract(ctx, "batch-shipped");
    return;
  }
  const alarm = contractAlarmFlag(contract.id);
  if (!ctx.state.domain.flags.includes(alarm)) {
    watchStaff(ctx, contract, false);
    if (!ctx.state.domain.flags.includes(alarm) && spotted(ctx, contract)) raiseAlarm(ctx, contract);
  }
  const alarmUp = ctx.state.domain.flags.includes(alarm);
  const c = alarmUp ? onAlarm(ctx, ctx.state.domain.contracts.active ?? contract, uploaded, rate) : (ctx.state.domain.contracts.active ?? contract);
  if (c.route === "loud") {
    runLoud(ctx, c, rate);
    return;
  }
  if (!uploaded) {
    upload(ctx, c, rate);
    return;
  }
  const now: Contract = alarmUp && !c.seenLeaving ? { ...c, seenLeaving: true } : c;
  if (now !== c) setActive(ctx, now);
  const p = ctx.world.with("player").first;
  if (p && !ctx.session.gameOver && !inW3Zone(p.position.x, p.position.z)) leave(ctx, now);
};

/** The running sabotage when this is its core's terminal, open to the virus: no lockdown, the loud way not chosen. */
const openCore = (ctx: SimContext, terminal: Entity): Contract | null => {
  const contract = ctx.state.domain.contracts.active;
  if (contract?.status !== "active" || contractKind(contract) !== "sabotage" || terminal.key !== contractVirusKey(contract.id) || lockdown(ctx) || contract.route === "loud") return null;
  return contract;
};

/**
 * Would the key do the sabotage's work here now (G-910): start the upload or open its breach, take
 * the charges, plant one? A terminal or a spot with nothing left to do is no goal.
 */
export const sabotageGoal = (ctx: SimContext, e: Entity): boolean => {
  const core = openCore(ctx, e);
  if (core) return core.progress === undefined || (!core.breach && !virusUploaded(core, Math.round(1 / ctx.dt)));
  return chargesToTake(ctx, e) || plantableStation(ctx, e) !== null;
};

/**
 * The core's terminal of the running sabotage: the key starts the upload (the silent way, ADR-0082)
 * and opens Breach Protocol until one lands (ICEpick shortens the upload). Refused in a lockdown.
 */
const startUpload = (ctx: SimContext, terminal: Entity): void => {
  const contract = openCore(ctx, terminal);
  if (!contract || !terminal.key) return;
  if (!contract.breach && !virusUploaded(contract, Math.round(1 / ctx.dt))) ctx.bus.emit("BreachStarted", { terminalKey: terminal.key, daemons: BREACH_DAEMONS });
  if (contract.progress !== undefined) return;
  const quiet: Contract = { ...contract, route: "quiet", progress: 0 };
  setActive(ctx, quiet);
  ctx.bus.emit("SabotageRouteChosen", { contract: quiet, route: "quiet" });
};

/** A terminal of the running sabotage (ADR-0082): the core's, the armoury's charges, a station of the line. */
export const useSabotage = (ctx: SimContext, e: Entity): void => {
  startUpload(ctx, e);
  takeCharges(ctx, e);
  startPlanting(ctx, e);
};

/** Runs the sabotage after the contract system (ADR-0082): the hall's job keeps its own clock. */
export const sabotageSystem: System = {
  name: "sabotage",
  run(ctx) {
    const contract = ctx.state.domain.contracts.active;
    if (contract?.status === "active" && contractKind(contract) === "sabotage") runSabotage(ctx, contract);
  },
};
