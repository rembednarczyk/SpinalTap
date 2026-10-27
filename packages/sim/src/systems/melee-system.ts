import { type EntityId, type MeleeProfile, applyDamage, meleeReach, nextStrike, resolveAttack, strikeAt, strikeZone } from "@seki/core";
import type { Entity, MeleeState } from "../world/components";
import type { SimContext, System } from "../world/context";
import { bodyHeightOf } from "../world/hitboxes";
import { chestOf, eyeOf, lineOfSight } from "../world/hitscan";
import { inCreationOrder } from "../world/ordering";
import { worldTimeScale } from "./ability-system";
import { NPC_CRIT, alertNearbyGangers, defenderOf, guardAgainst, threaten, wearPlayerClothes } from "./combat-system";
import { playerStatsOf } from "./player-control-system";

/** A phase that ends within float noise of the step counts as over (0.3 s = 18 steps). */
const TIME_EPSILON = 1e-6;
/** Steepest look pitch that still decides where a swing lands (radians). */
const MAX_STRIKE_PITCH = 1;
/** A level swing travels this far below the eye line (metres): at the chest, not the face. */
const STRIKE_DROP = 0.35;
/** Where an NPC's swing lands, as a share of the target's height: the chest. */
const NPC_STRIKE_HEIGHT = 0.7;

type Fighter = Entity & { melee: NonNullable<Entity["melee"]>; combatant: NonNullable<Entity["combatant"]> };

const toIdle = (f: Fighter): void => {
  const m = f.melee;
  m.phase = "idle";
  m.timer = 0;
  m.queued = false;
};

/**
 * Starts swing `strike` of the fighter's combo, landing after `windup` seconds (the strike's
 * own for the player, the telegraphed `npcWindup` for NPCs). Drops the guard.
 */
export const startSwing = (ctx: SimContext, entityId: EntityId, m: MeleeState, profile: MeleeProfile, strike: number, windup: number): void => {
  m.phase = "windup";
  m.timer = windup;
  m.strike = strike;
  m.queued = false;
  m.guard = false;
  m.parry = 0;
  ctx.bus.emit("MeleeSwing", { entityId, strike, windup, recovery: strikeAt(profile, strike).recovery });
};

/** Knocks an entity off balance: a swing on its way, a guard or a reload is cut short. */
export const stagger = (ctx: SimContext, target: Entity, duration: number, cause: "hit" | "parry"): void => {
  const m = target.melee;
  if (!m || duration <= 0) return;
  m.stagger = Math.max(m.stagger, duration);
  m.phase = "idle";
  m.timer = 0;
  m.queued = false;
  m.combo = 0;
  m.guard = false;
  m.parry = 0;
  if (target.combatant) target.combatant.reloading = 0;
  ctx.bus.emit("Staggered", { entityId: target.id, duration, cause });
};

/**
 * Height at which the swing crosses a target `distance` away, as a share of its body height:
 * along the look pitch for the player (positive pitch looks down), chest height for NPCs.
 */
const strikeHeight = (f: Entity, target: Entity, distance: number): number => {
  if (!f.player) return NPC_STRIKE_HEIGHT;
  const pitch = Math.max(-MAX_STRIKE_PITCH, Math.min(MAX_STRIKE_PITCH, f.pitch));
  const y = eyeOf(f).y - STRIKE_DROP - Math.tan(pitch) * distance;
  return (y - target.position.y) / Math.max(0.1, bodyHeightOf(target));
};

/**
 * The swing lands: every living body in reach and in the arc, with nothing solid in between,
 * takes the strike on the zone the blade crosses (one random number each, the crit), unless
 * its guard faces the blow. A parry stuns the attacker and ends the swing. Gangers never hit
 * each other. Returns true when the swing was parried.
 */
const land = (ctx: SimContext, f: Fighter, profile: MeleeProfile): boolean => {
  const weapon = f.combatant.stats;
  if (!weapon) return false;
  const strike = strikeAt(profile, f.melee.strike);
  const crit = f.player ? playerStatsOf(ctx.state.domain) : NPC_CRIT;
  const eye = eyeOf(f);
  const facing = { x: f.position.x, z: f.position.z, yaw: f.yaw };
  let hits = 0;
  let parried = false;
  for (const t of inCreationOrder(ctx.world.with("health", "body"))) {
    if (t === f || t.health.current <= 0 || (!f.player && t.ai)) continue;
    const reach = meleeReach(facing, t.position.x, t.position.z, t.body.radius, weapon.range, profile.arc);
    if (!reach) continue;
    const chest = chestOf(t);
    if (!lineOfSight(ctx.world, eye, chest)) continue;
    hits++;
    const guard = guardAgainst(t, f.position, "melee");
    if (guard.parried) {
      ctx.bus.emit("AttackBlocked", { attackerId: f.id, defenderId: t.id, parried: true, kind: "melee", at: chest });
      stagger(ctx, f, t.combatant?.stats?.melee?.block.parryStun ?? 0, "parry");
      parried = true;
      break;
    }
    const zone = strikeZone(strikeHeight(f, t, reach.distance), reach.angle / profile.arc);
    const outcome = resolveAttack(
      {
        damage: weapon.damage * strike.damage * guard.multiplier,
        zones: weapon.zones,
        critChance: crit.critChance,
        critMultiplier: crit.critMultiplier,
        damageBonus: crit.damageBonus * guard.multiplier,
      },
      defenderOf(ctx, t),
      ctx.rng,
      zone,
    );
    t.health = applyDamage(t.health, outcome.damage);
    t.lastHitBy = f.id;
    if (t.player) wearPlayerClothes(ctx, outcome.zone);
    if (t.ai) t.ai.alerted = true;
    ctx.bus.emit("DamageDealt", { sourceId: f.id, targetId: t.id, amount: outcome.damage, critical: outcome.critical, zone: outcome.zone, at: chest });
    if (guard.blocked) ctx.bus.emit("AttackBlocked", { attackerId: f.id, defenderId: t.id, parried: false, kind: "melee", at: chest });
    else stagger(ctx, t, strike.stagger, "hit");
    if (t.player) threaten(ctx, "damage", f.id);
  }
  ctx.bus.emit("MeleeStrike", { entityId: f.id, strike: f.melee.strike, hits });
  alertNearbyGangers(ctx, f.position, weapon.alertRadius);
  return parried;
};

/** The player's attack button: a swing from idle, the next one of the combo while it lasts. */
const handlePlayer = (ctx: SimContext, f: Fighter, profile: MeleeProfile): void => {
  const m = f.melee;
  const c = f.combatant;
  if (m.phase !== "idle" || m.stagger > 0 || m.guard || c.holstered || c.drawing > 0) return;
  if (!ctx.input.fire && !m.queued) return;
  const strike = nextStrike(profile, m.strike, m.combo);
  startSwing(ctx, f.id, m, profile, strike, strikeAt(profile, strike).windup);
};

/**
 * Melee after `weapon` and before `combat` (ADR-0019): ticks stagger, parry and swing timers
 * of every fighter (NPCs in local time), lands swings at the end of their windup, chains the
 * player's combo and starts the player's swings. NPC swings are started by the AI.
 */
export const meleeSystem: System = {
  name: "melee",
  run(ctx) {
    const enemyDt = ctx.dt * worldTimeScale(ctx);
    const frozen = ctx.session.dialogueActive || ctx.session.gameOver;
    for (const f of inCreationOrder(ctx.world.with("melee", "combatant"))) {
      const m = f.melee;
      const dt = f.player ? ctx.dt : enemyDt;
      m.stagger = Math.max(0, m.stagger - dt);
      m.parry = Math.max(0, m.parry - dt);
      m.parryCooldown = Math.max(0, m.parryCooldown - dt);
      const profile = f.combatant.stats?.melee;
      // Switching to a gun, holstering, a conversation or death ends any swing.
      if (!profile || f.combatant.holstered || (f.health?.current ?? 1) <= 0 || (f.player && frozen)) {
        toIdle(f);
        m.combo = 0;
        continue;
      }
      if (m.phase === "windup") {
        m.timer -= dt;
        if (m.timer <= TIME_EPSILON && !land(ctx, f, profile)) {
          m.phase = "recovery";
          m.timer = strikeAt(profile, m.strike).recovery;
        }
      } else if (m.phase === "recovery") {
        m.timer -= dt;
        // Holding the button through the recovery buffers the next swing.
        if (f.player && ctx.input.fire) m.queued = true;
        if (m.timer <= TIME_EPSILON) {
          m.phase = "idle";
          m.timer = 0;
          // The finisher closes the combo; anything earlier leaves a window for the next swing.
          m.combo = m.strike < profile.combo.length - 1 ? profile.comboWindow : 0;
        }
      } else {
        m.combo = Math.max(0, m.combo - dt);
      }
      if (f.player) handlePlayer(ctx, f, profile);
    }
  },
};
