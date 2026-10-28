import { ABILITY_CATALOG, type AbilityDefinition, SCAN_TIME_SCALE, activate, enemyTimeScale, loadoutAbility, tickAbility } from "@seki/core";
import type { SimContext, System } from "../world/context";

export const equippedAbility = (ctx: SimContext): AbilityDefinition | null => {
  const id = loadoutAbility(ctx.state.domain.character.cyberware);
  return id ? ABILITY_CATALOG[id] : null;
};

/** The scanner is held and can be used (ADR-0029): not in a conversation, not after death. */
export const scanning = (ctx: SimContext): boolean => ctx.input.scan && !ctx.session.dialogueActive && !ctx.session.gameOver;

/**
 * Time scale for everything except the player: 1, the overdrive's while it runs, and a little
 * slower while the scanner is held (ADR-0029); the slower of the two wins.
 */
export const worldTimeScale = (ctx: SimContext): number =>
  Math.min(enemyTimeScale(ctx.state.domain.ability, equippedAbility(ctx)), scanning(ctx) ? SCAN_TIME_SCALE : 1);

/** Ticks the active ability, ends it on time, and activates it on the input edge. */
export const abilitySystem: System = {
  name: "ability",
  run(ctx) {
    const def = equippedAbility(ctx);
    const before = ctx.state.domain.ability;
    let next = tickAbility(before, ctx.dt);
    if (before.activeTime > 0 && next.activeTime <= 0) ctx.bus.emit("AbilityEnded", { abilityId: def?.id ?? "reflex_overdrive" });
    const blocked = ctx.session.dialogueActive || ctx.session.gameOver;
    if (ctx.input.ability && def && !blocked) {
      const activated = activate(next, def);
      if (activated) {
        next = activated;
        ctx.bus.emit("AbilityActivated", { abilityId: def.id, duration: def.duration });
      }
    }
    if (next !== before) ctx.state.domain = { ...ctx.state.domain, ability: next };
  },
};
