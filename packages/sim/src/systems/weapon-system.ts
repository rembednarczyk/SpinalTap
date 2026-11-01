import { holsterTime, recoverBloom, reloadPlan } from "@seki/core";
import type { Entity } from "../world/components";
import { playerHeld } from "../world/takedown";
import type { SimContext, System } from "../world/context";
import { inCreationOrder } from "../world/ordering";
import { SLOT_BY_INPUT, activeWeaponItem, loadedOf, reserveOf, setRounds, syncPlayerWeapon } from "../world/player-weapon";
import { worldTimeScale } from "./ability-system";

const TIME_EPSILON = 1e-6;

type Armed = Entity & { combatant: NonNullable<Entity["combatant"]> };

const cancelReload = (e: Armed): void => {
  e.combatant.reloading = 0;
};

/** Starts one reload step if there is anything to load. */
const startReload = (ctx: SimContext, e: Armed): boolean => {
  const c = e.combatant;
  if (!c.stats || c.reloading > 0 || c.holstered || c.drawing > 0) return false;
  const plan = reloadPlan(c.stats, loadedOf(ctx, e), reserveOf(ctx, e));
  if (!plan) return false;
  c.reloading = plan.duration;
  ctx.bus.emit("ReloadStarted", { entityId: e.id, duration: plan.duration });
  return true;
};

/** Finishes a reload step: rounds move in, a per-round reload goes on with the next one. */
const finishReload = (ctx: SimContext, e: Armed): void => {
  const c = e.combatant;
  if (!c.stats) return;
  const plan = reloadPlan(c.stats, loadedOf(ctx, e), reserveOf(ctx, e));
  if (!plan) return;
  setRounds(ctx, e, plan.loaded, plan.reserve);
  ctx.bus.emit("ReloadFinished", { entityId: e.id, loaded: plan.loaded });
  if (c.stats.reloadMode === "per-round") startReload(ctx, e);
};

/** Ticks draw, cooldown, bloom and reload timers of everyone; `dt` is local time. */
const tick = (ctx: SimContext, e: Armed, dt: number): void => {
  const c = e.combatant;
  c.cooldown = Math.max(0, c.cooldown - dt);
  c.drawing = Math.max(0, c.drawing - dt);
  if (c.stats) c.bloom = recoverBloom(c.stats.spread, c.bloom, dt);
  if (c.reloading > 0) {
    // A step that lands on the end within float noise counts as done (1.4 s = 84 steps).
    c.reloading = c.reloading - dt > TIME_EPSILON ? c.reloading - dt : 0;
    if (c.reloading === 0) finishReload(ctx, e);
  }
};

/** Puts the weapon away or starts drawing it. Holstering cancels a reload. */
const toggleHolster = (ctx: SimContext, p: Armed): void => {
  const c = p.combatant;
  c.holstered = !c.holstered;
  c.drawing = c.holstered || !c.stats ? 0 : c.stats.drawTime;
  cancelReload(p);
  ctx.bus.emit("WeaponToggled", { entityId: p.id, drawn: !c.holstered });
};

/**
 * Switches to another slot: the current weapon goes away (half its draw time) and the new one
 * is drawn (its full draw time). Choosing the active slot while holstered draws it. Empty slots
 * are ignored.
 */
const selectSlot = (ctx: SimContext, p: Armed, index: number): void => {
  const slot = SLOT_BY_INPUT[index];
  if (!slot) return;
  const c = p.combatant;
  const domain = ctx.state.domain;
  if (slot === domain.equipment.active) {
    if (c.holstered) toggleHolster(ctx, p);
    return;
  }
  if (!activeWeaponItem(domain, slot)) return;
  const away = c.stats && !c.holstered ? holsterTime(c.stats) : 0;
  ctx.state.domain = { ...domain, equipment: { ...domain.equipment, active: slot } };
  // Re-arm at once without the draw a plain equip would start: the timing is set below.
  c.uid = undefined;
  syncPlayerWeapon(ctx.state.domain, c);
  const stats = c.stats;
  if (!stats) return;
  c.holstered = false;
  c.reloading = 0;
  c.drawing = away + stats.drawTime;
  ctx.bus.emit("WeaponSwitched", { entityId: p.id, slot, weapon: stats.id });
};

/**
 * The slot input `step` places away from the active one, wrapping round and skipping empty
 * slots (mouse wheel). 0 when no other slot holds a weapon.
 */
const cycledSlot = (ctx: SimContext, step: 1 | -1): 0 | 1 | 2 | 3 => {
  const domain = ctx.state.domain;
  const order = [1, 2, 3] as const;
  const current = order.findIndex((i) => SLOT_BY_INPUT[i] === domain.equipment.active);
  for (let k = 1; k < order.length; k++) {
    const i = order[(current + step * k + order.length * 2) % order.length] ?? 1;
    const slot = SLOT_BY_INPUT[i];
    if (slot && activeWeaponItem(domain, slot)) return i;
  }
  return 0;
};

const handlePlayer = (ctx: SimContext, p: Armed): void => {
  const c = p.combatant;
  const { input } = ctx;
  if (playerHeld(ctx)) {
    // Opening a conversation, the shop or a bag, or a takedown interrupts a reload.
    cancelReload(p);
    return;
  }
  if (input.weaponSlot !== 0) selectSlot(ctx, p, input.weaponSlot);
  else if (input.weaponCycle !== 0) {
    const next = cycledSlot(ctx, input.weaponCycle);
    if (next !== 0) selectSlot(ctx, p, next);
  }
  if (input.toggleWeapon || (c.holstered && input.fire)) toggleHolster(ctx, p);
  if (p.posture?.sprinting) cancelReload(p);
  else if (input.reload) startReload(ctx, p);
  // Pulling the trigger on an empty magazine reloads, if there is anything to load.
  else if (input.fire && c.stats && loadedOf(ctx, p) === 0) startReload(ctx, p);
};

/**
 * Weapon handling before `combat` (ADR-0015): keeps the player's combatant in step with the
 * equipment in the domain, ticks timers, switches slots, holsters and draws, and reloads from
 * the pouch. NPCs reload by themselves when their magazine runs dry; their reserve is endless.
 */
export const weaponSystem: System = {
  name: "weapon",
  run(ctx) {
    const enemyDt = ctx.dt * worldTimeScale(ctx);
    for (const e of inCreationOrder(ctx.world.with("combatant"))) {
      if (e.player) syncPlayerWeapon(ctx.state.domain, e.combatant);
      tick(ctx, e, e.player ? ctx.dt : enemyDt);
      if (e.player) handlePlayer(ctx, e);
      else if (e.combatant.reloading === 0 && loadedOf(ctx, e) === 0) startReload(ctx, e);
    }
  },
};
