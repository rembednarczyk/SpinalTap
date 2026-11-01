import { type BuffId, capacityMax, capacityUsed, disguiseOf, tickBuffs, type DomainState } from "@seki/core";
import type { SimContext, System } from "../world/context";

/** Cyberware capacity in use and the pool, from the domain (ADR-0033). */
export const cyberCapacityOf = (domain: DomainState): { used: number; max: number } => ({
  used: capacityUsed(domain.character.cyberware),
  max: capacityMax(domain.progression.level, domain.capacityShards),
});

/** A buff that is new since the last step, or got longer (eaten again), is reported with its seconds left. */
const announceBuffs = (ctx: SimContext, seen: Map<BuffId, number>): void => {
  for (const b of ctx.state.domain.buffs) {
    const before = seen.get(b.id);
    if (before === undefined || b.left > before + 1e-6) ctx.bus.emit("BuffApplied", { buffId: b.id, duration: b.left });
  }
};

/** Buffs run in the player's time; regeneration heals whole points (ADR-0033). */
const runBuffs = (ctx: SimContext): void => {
  const domain = ctx.state.domain;
  if (domain.buffs.length === 0) return;
  const r = tickBuffs(domain.buffs, ctx.dt);
  ctx.state.domain = { ...domain, buffs: r.buffs };
  const player = ctx.world.with("player", "health").first;
  // Not during a takedown (ADR-0065): any damage below its starting health breaks the hold.
  if (r.heal > 0 && player && !ctx.session.takedown && player.health.current > 0 && player.health.current < player.health.max) {
    player.health = { ...player.health, current: Math.min(player.health.max, player.health.current + r.heal) };
  }
  for (const id of r.ended) ctx.bus.emit("BuffEnded", { buffId: id });
};

/** The worn torso garment decides the disguise; changing it clears a blown one (ADR-0033). */
const runDisguise = (ctx: SimContext): void => {
  const domain = ctx.state.domain;
  const role = disguiseOf(domain.inventory, domain.equipment);
  if (role === domain.disguise.role) return;
  ctx.state.domain = { ...domain, disguise: { role, blown: false } };
  ctx.bus.emit("DisguiseChanged", { role });
};

/**
 * The body of the player (ADR-0033): buffs tick and heal, the disguise follows the clothes, and
 * the cyberware capacity is reported whenever it changes (an implant, a shard, a level). A buff is reported when it shows up (eaten, or running in a loaded game) and when
 * it is refreshed; the first step also announces a worn disguise, so the HUD starts right. No
 * randomness; the announcements are presentation only.
 */
export const createBodySystem = (): System => {
  let reported: { used: number; max: number } | null = null;
  const seen = new Map<BuffId, number>();
  return {
    name: "body",
    run(ctx) {
      if (reported === null && ctx.state.domain.disguise.role !== null) ctx.bus.emit("DisguiseChanged", { role: ctx.state.domain.disguise.role });
      announceBuffs(ctx, seen);
      if (!ctx.session.gameOver) runBuffs(ctx);
      seen.clear();
      for (const b of ctx.state.domain.buffs) seen.set(b.id, b.left);
      runDisguise(ctx);
      const capacity = cyberCapacityOf(ctx.state.domain);
      if (reported?.used !== capacity.used || reported.max !== capacity.max) {
        reported = capacity;
        ctx.bus.emit("CyberwareCapacityChanged", capacity);
      }
    },
  };
};
