/**
 * Active cyberware abilities. M1 has one: a reflex overdrive that slows everyone but the
 * player (enemy time scale), with a cooldown. State is plain numbers, so it saves trivially.
 */
export interface AbilityDefinition {
  readonly id: string;
  /** Catalog key of the name (`ability.<id>.name`, ADR-0056). */
  readonly name: string;
  readonly duration: number;
  readonly cooldown: number;
  /** Time scale applied to enemies while active. */
  readonly enemyTimeScale: number;
}

export const ABILITY_CATALOG = {
  reflex_overdrive: {
    id: "reflex_overdrive",
    name: "ability.reflex_overdrive.name",
    duration: 4,
    cooldown: 16,
    enemyTimeScale: 0.3,
  },
} as const satisfies Record<string, AbilityDefinition>;

export type AbilityId = keyof typeof ABILITY_CATALOG;

export interface AbilityState {
  /** Seconds the ability stays active. */
  readonly activeTime: number;
  /** Seconds until it can be used again (counts from activation). */
  readonly cooldown: number;
}

export const IDLE_ABILITY: AbilityState = { activeTime: 0, cooldown: 0 };

export const canActivate = (s: AbilityState): boolean => s.cooldown <= 0;

export const activate = (s: AbilityState, def: AbilityDefinition): AbilityState | null =>
  canActivate(s) ? { activeTime: def.duration, cooldown: def.cooldown } : null;

/** Runs the ability for `dt` seconds; the cooldown runs `cooldownRate` times faster (a buff, ADR-0033). */
export const tickAbility = (s: AbilityState, dt: number, cooldownRate = 1): AbilityState =>
  s.activeTime <= 0 && s.cooldown <= 0 ? s : { activeTime: Math.max(0, s.activeTime - dt), cooldown: Math.max(0, s.cooldown - dt * cooldownRate) };

export const enemyTimeScale = (s: AbilityState, def: AbilityDefinition | null): number =>
  def && s.activeTime > 0 ? def.enemyTimeScale : 1;
