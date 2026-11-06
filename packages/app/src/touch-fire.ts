import type { TouchFire } from "@seki/engine";
import type { Entity } from "@seki/sim";
import type { SettingsVm } from "@seki/ui";

/** The part of the engine's VirtualPad the touch fire button needs (ADR-0072). */
export interface TouchFireTarget {
  touchFire: TouchFire;
  adsWeapon: boolean;
}

/**
 * Before each poll: the fire button's mode from the settings, and whether the weapon in hand
 * aims down sights. With a melee weapon (or none) the fire button then only strikes, because
 * `aim` would raise the guard. The weapon is the last step's, one step behind as all input is.
 */
export const feedTouchFire = (pad: TouchFireTarget, settings: Pick<SettingsVm, "touchFire">, player: Entity | undefined): void => {
  pad.touchFire = settings.touchFire;
  pad.adsWeapon = !!player?.combatant?.stats?.ads;
};
