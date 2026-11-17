import {
  type Contract,
  SABOTAGE_LOUD,
  SABOTAGE_LOUD_DELTAS,
  TESSEN_HUNT,
  W3_ARMOURY_LOOT,
  W3_STATIONS,
  type W3StationId,
  applyDamage,
  blastDamageAt,
  chargesLeft,
  contractChargesKey,
  contractKind,
  contractStationKey,
  gameDayOf,
  loudTessenDelta,
  sabotagePay,
  stationDownFlag,
  takenFlag,
  tessenHuntFlag,
  tessenHuntUntil,
  virusUploaded,
} from "@seki/core";
import { W3_ARMOURY_CHEST, W3_HALL, W3_STATION_SPOTS, inW3Zone, stationChargeAt } from "../content/tessen-w3";
import type { Entity } from "../world/components";
import type { SimContext } from "../world/context";
import { completeContract } from "../world/contract-commands";
import { adjustReputation, clearContract, lowerFlag, raiseFlag } from "../world/domain-ops";
import { chestOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { contractChargeKey } from "../world/sabotage-templates";
import { disturb } from "../world/street";
import { raiseAlarm } from "./contract-system";
import { placeChest } from "./loot-system";

/**
 * W-3's sabotage, the loud way (ADR-0082 §1 "Droga głośna", stage 3b): the charges taken from
 * armoury S raise the alarm whatever was before; each is planted on a station of the line in 2.5 s
 * by its spot (a hit starts it over); the third lights the fuse; the charges go off when Seki leaves
 * the hall or the fuse runs out, hurting whoever is in clear line within 10 m and leaving the
 * stations wrecked; out of the zone after the blast Genzō pays the loud rate and Tessen hunts her
 * in the city for three days. Every counter is in the contract, so the clock survives a save.
 */

/** The blast is heard this far (a shot is heard at 22 m). */
export const BLAST_NOISE = 60;

const setActive = (ctx: SimContext, contract: Contract): void => {
  ctx.state.domain = { ...ctx.state.domain, contracts: { ...ctx.state.domain.contracts, active: contract } };
};

const running = (ctx: SimContext): Contract | null => {
  const c = ctx.state.domain.contracts.active;
  return c?.status === "active" && contractKind(c) === "sabotage" ? c : null;
};

/** The way chosen: from now on the job is the loud one (announced once). */
export const chooseLoud = (ctx: SimContext, contract: Contract): Contract => {
  if (contract.route === "loud") return contract;
  const loud: Contract = { ...contract, route: "loud" };
  setActive(ctx, loud);
  ctx.bus.emit("SabotageRouteChosen", { contract: loud, route: "loud" });
  return loud;
};

/** A thing of the job's taken out of the world for good (a used spot, a charge gone off). */
const useUp = (ctx: SimContext, key: string): void => {
  raiseFlag(ctx, takenFlag(key));
  for (const e of ctx.world) {
    if (e.key !== key) continue;
    if (ctx.session.focusId === e.id) {
      ctx.session.focusId = null;
      ctx.session.focusPrompt = null;
      ctx.bus.emit("InteractionFocusChanged", { targetId: null, prompt: null });
    }
    ctx.world.remove(e);
    return;
  }
};

/** Key of the armoury chest's loot of a job: opened once, with the charges' case. */
export const armouryChestKey = (contractId: string): string => `stash:w3-armoury-${contractId}`;

/** Is this the armoury's case of the running sabotage, the charges still in it and the virus not in? */
export const chargesToTake = (ctx: SimContext, box: Entity): boolean => {
  const contract = running(ctx);
  return !!contract && !!box.key && box.key === contractChargesKey(contract.id) && !contract.charges && !virusUploaded(contract, Math.round(1 / ctx.dt));
};

/**
 * The armoury's case: the key takes the three charges and always raises the alarm (its weight
 * sensor); the arms chest by it opens with it (its loot counts in the loud way's income, 16.11).
 */
export const takeCharges = (ctx: SimContext, box: Entity): void => {
  const contract = running(ctx);
  if (!contract || !box.key || !chargesToTake(ctx, box)) return;
  const loud = { ...chooseLoud(ctx, contract), charges: [] };
  setActive(ctx, loud);
  useUp(ctx, box.key);
  placeChest(ctx, armouryChestKey(contract.id), W3_ARMOURY_CHEST, W3_ARMOURY_LOOT);
  raiseAlarm(ctx, loud);
};

/** The station of this spot when the key would start planting there now: a charge in her bag, nothing being planted, none on it yet. */
export const plantableStation = (ctx: SimContext, spot: Entity): W3StationId | null => {
  const contract = running(ctx);
  if (!contract || !ctx.world.with("player").first?.health || chargesLeft(contract) <= 0 || contract.planting) return null;
  const station = W3_STATIONS.find((s) => spot.key === contractStationKey(contract.id, s));
  return station && !contract.charges?.includes(station) ? station : null;
};

/** A station's spot: with a charge in her bag and nothing being planted, the key starts planting one there. */
export const startPlanting = (ctx: SimContext, spot: Entity): void => {
  const contract = running(ctx);
  const player = ctx.world.with("player").first;
  const station = plantableStation(ctx, spot);
  if (!contract || !player?.health || !station) return;
  setActive(ctx, { ...contract, planting: { station, ticks: 0, hp: player.health.current } });
};

/** Seki by the station's spot, on its level, alive; null otherwise. */
const atStation = (ctx: SimContext, s: W3StationId): Entity | null => {
  const p = ctx.world.with("player").first;
  const spot = W3_STATION_SPOTS[s];
  if (!p || ctx.session.gameOver) return null;
  const near = Math.hypot(p.position.x - spot.x, p.position.z - spot.z) <= SABOTAGE_LOUD.plantRange && Math.abs(p.position.y - spot.y) <= 1.6;
  return near ? p : null;
};

/** The charge being planted goes on, or is dropped when she moved off or was hit; the third one lights the fuse. */
const plant = (ctx: SimContext, contract: Contract, rate: number): void => {
  const job = contract.planting;
  if (!job) return;
  const p = atStation(ctx, job.station);
  const { planting: _, ...rest } = contract;
  if (!p || (p.health?.current ?? 0) < job.hp) {
    setActive(ctx, rest);
    return;
  }
  if (job.ticks + 1 < Math.round(SABOTAGE_LOUD.plantSeconds * rate)) {
    setActive(ctx, { ...contract, planting: { ...job, ticks: job.ticks + 1 } });
    return;
  }
  const charges = [...(contract.charges ?? []), job.station];
  const last = charges.length >= SABOTAGE_LOUD.charges;
  setActive(ctx, { ...rest, charges, ...(last ? { fuseTick: ctx.tick + SABOTAGE_LOUD.fuseSeconds * rate } : {}) });
  useUp(ctx, contractStationKey(contract.id, job.station));
  ctx.streamer.spawnWaiting(ctx.world, ctx.state.domain.flags);
};

/** One charge's blast: whoever has a body in clear line within the radius is hurt, the more the nearer. */
const blast = (ctx: SimContext, at: { x: number; y: number; z: number }, by: Entity | undefined): void => {
  const from = { ...at, y: at.y + 0.3 };
  for (const e of inCreationOrder(ctx.world.with("health", "body"))) {
    const chest = chestOf(e);
    const amount = blastDamageAt(Math.hypot(chest.x - from.x, chest.y - from.y, chest.z - from.z));
    if (amount <= 0 || e.health.current <= 0 || !lineOfSight(ctx.world, from, chest)) continue;
    e.health = applyDamage(e.health, amount);
    if (by && !e.player) e.lastHitBy = by.id;
    if (e.ai && !e.unconscious) e.ai.alerted = true;
    ctx.bus.emit("DamageDealt", { sourceId: by?.id ?? e.id, targetId: e.id, amount, critical: false, zone: "torso", at: { ...chest } });
  }
  disturb(ctx, "gunshot", at, BLAST_NOISE, by?.id ?? 0);
};

/** The charges go off: the stations are wrecks for good (their flags), the charges gone. */
const detonate = (ctx: SimContext, contract: Contract): void => {
  const player = ctx.world.with("player").first;
  setActive(ctx, { ...contract, detonated: true });
  for (const s of contract.charges ?? []) {
    useUp(ctx, contractChargeKey(contract.id, s));
    raiseFlag(ctx, stationDownFlag(s));
    blast(ctx, stationChargeAt(s), player);
  }
  ctx.streamer.spawnWaiting(ctx.world, ctx.state.domain.flags);
};

/** Out of the zone after the blast: paid the loud rate by phone, Tessen at most -60 and on the hunt for three days. */
const escape = (ctx: SimContext, contract: Contract): void => {
  setActive(ctx, { ...contract, reward: sabotagePay(contract) });
  clearContract(ctx);
  completeContract(ctx);
  for (const d of SABOTAGE_LOUD_DELTAS) adjustReputation(ctx, d.faction, d.delta);
  const tessen = loudTessenDelta(ctx.state.domain.reputation.tessen);
  if (tessen !== 0) adjustReputation(ctx, "tessen", tessen);
  const until = tessenHuntUntil(ctx.state.domain.flags);
  if (until !== null) lowerFlag(ctx, tessenHuntFlag(until));
  raiseFlag(ctx, tessenHuntFlag(gameDayOf(ctx.state.domain.clock) + TESSEN_HUNT.days));
};

const inHall = (p: Entity): boolean => p.position.x >= W3_HALL.minX && p.position.x <= W3_HALL.maxX && p.position.z >= W3_HALL.minZ && p.position.z <= W3_HALL.maxZ;

/** One step of the loud way: planting, the fuse and the blast, the way out. */
export const runLoud = (ctx: SimContext, contract: Contract, rate: number): void => {
  plant(ctx, contract, rate);
  const now = running(ctx);
  const p = ctx.session.gameOver ? undefined : ctx.world.with("player").first;
  if (now && !now.detonated && now.fuseTick !== undefined && (ctx.tick >= now.fuseTick || (p && !inHall(p)))) detonate(ctx, now);
  const after = running(ctx);
  if (after?.detonated && p && !inW3Zone(p.position.x, p.position.z)) escape(ctx, after);
};
